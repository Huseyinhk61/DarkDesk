const path = require('node:path');
const { JsonStore } = require('./json-store.cjs');
const {
  defaultWidgetState,
  widgetIds,
  normalizeWidgetState,
  validateWidgetPatch,
  restoreWidgetBounds,
} = require('../../shared/widget-model.js');
const { attachDesktop: nativeAttach } = require('./widget-desktop.cjs');

class WidgetManager {
  constructor({
    data,
    platform = process.platform,
    createWindow,
    loadWindow,
    getDisplays = () => [],
    getSettings = async () => ({}),
    emit = () => {},
    attachDesktop = nativeAttach,
  } = {}) {
    this.platform = platform;
    this.createWindow =
      createWindow || ((options) => new (require('electron').BrowserWindow)(options));
    this.loadWindow = loadWindow;
    this.getDisplays = getDisplays;
    this.getSettings = getSettings;
    this.emit = emit;
    this.attachDesktop = attachDesktop;
    this.store = new JsonStore(path.join(data, 'widgets.json'), defaultWidgetState);
    this.model = null;
    this.tail = Promise.resolve();
    this.open = new Map();
    this.placements = new Map();
    this.loading = new Map();
    this.moveTimers = new Map();
    this.stopping = false;
  }
  async read() {
    if (!this.model) this.model = normalizeWidgetState(await this.store.read());
    return this.model;
  }
  locked(action) {
    const work = this.tail.then(action, action);
    this.tail = work.catch(() => {});
    return work;
  }
  async state() {
    const model = await this.read();
    return {
      ...structuredClone(model),
      platform: this.platform,
      placements: Object.fromEntries([...this.placements].map(([id, value]) => [id, { ...value }])),
    };
  }
  async publish() {
    const state = await this.state();
    this.emit('widgetsChanged', state);
    return state;
  }
  async persist(next) {
    await this.store.write(next);
    this.model = next;
    return this.publish();
  }
  async save(patch) {
    const layout =
      patch && typeof patch === 'object' && ('placement' in patch || 'resetPositions' in patch);
    // Content flushes are required during stop; layout mutations can destroy
    // those same renderer windows and must wait until normal operation resumes.
    if (layout && this.stopping) throw Error('WIDGETS_UNAVAILABLE');
    // Flush renderer drafts before taking the write lock: the flush itself uses
    // saveWidgets IPC and must be able to acquire that same lock.
    if (
      patch &&
      typeof patch === 'object' &&
      'placement' in patch &&
      patch.placement !== (await this.read()).placement
    ) {
      await Promise.all(this.windows().map((window) => this.flushWindow(window)));
    }
    return this.locked(async () => {
      if (layout && this.stopping) throw Error('WIDGETS_UNAVAILABLE');
      const previous = await this.read();
      const next = validateWidgetPatch(previous, patch);
      await this.persist(next);
      if (patch.resetPositions)
        for (const [id, window] of this.open)
          if (!window.isDestroyed())
            window.setBounds(restoreWidgetBounds(id, null, this.getDisplays()));
      if ('placement' in patch && previous.placement !== next.placement) {
        // Recreate only visible windows after their content is persisted. Native
        // reparenting cannot safely be undone by merely toggling always-on-top.
        for (const [id, window] of [...this.open]) {
          if (!window.isDestroyed()) window.destroy();
          this.open.delete(id);
          this.placements.delete(id);
        }
        for (const id of widgetIds) if (next.widgets[id].enabled) await this.create(id, next);
      }
      return this.publish();
    });
  }
  windows() {
    return [...this.open.values()].filter((window) => !window.isDestroyed());
  }
  async initialize() {
    const model = await this.read();
    for (const id of widgetIds) if (model.widgets[id].enabled) await this.show(id);
    return this.state();
  }
  async create(id, model) {
    if (this.stopping) throw Error('WIDGETS_UNAVAILABLE');
    // A second show request must await the first renderer load, rather than
    // exposing an unfinished window and persisting it as enabled prematurely.
    if (this.loading.has(id)) return this.loading.get(id);
    const existing = this.open.get(id);
    if (existing && !existing.isDestroyed()) return existing;
    const task = (async () => {
      const bounds = restoreWidgetBounds(id, model.widgets[id].bounds, this.getDisplays());
      const window = this.createWindow({
        ...bounds,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        show: false,
        skipTaskbar: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        hasShadow: true,
        alwaysOnTop: false,
        title: 'DarkDesk ' + id,
        webPreferences: {
          preload: path.join(__dirname, '../preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          backgroundThrottling: false,
        },
      });
      this.open.set(id, window);
      window.setAlwaysOnTop?.(false);
      window.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: false });
      window.on?.('close', (event) => {
        if (!this.stopping) {
          event.preventDefault();
          this.hide(id).catch(() => {});
        }
      });
      window.on?.('closed', () => {
        if (this.open.get(id) === window) {
          this.open.delete(id);
          this.placements.delete(id);
        }
        this.publish().catch(() => {});
      });
      const moved = () => {
        clearTimeout(this.moveTimers.get(id));
        this.moveTimers.set(
          id,
          setTimeout(() => this.saveBounds(id, window).catch(() => {}), 180),
        );
      };
      window.on?.('move', moved);
      window.on?.('resize', moved);
      try {
        if (typeof this.loadWindow !== 'function') throw Error('WIDGETS_UNAVAILABLE');
        await this.loadWindow(window, id);
        if (this.stopping) throw Error('WIDGETS_UNAVAILABLE');
        let placement = {
          mode: 'floating',
          supported: false,
          reason: model.placement === 'floating' ? 'requested' : 'platform',
        };
        if (model.placement === 'desktop')
          placement = await this.attachDesktop(window, { platform: this.platform });
        if (window.isDestroyed()) throw Error('WIDGETS_UNAVAILABLE');
        this.placements.set(id, placement);
        window.showInactive?.();
        if (!window.showInactive) window.show();
        return window;
      } catch (error) {
        this.open.delete(id);
        if (!window.isDestroyed()) window.destroy();
        throw error;
      }
    })();
    this.loading.set(id, task);
    try {
      return await task;
    } finally {
      this.loading.delete(id);
    }
  }
  async show(id) {
    if (!widgetIds.includes(id) || this.stopping) throw Error('WIDGETS_INVALID');
    const model = await this.read();
    const window = await this.create(id, model);
    window.showInactive?.();
    if (!window.showInactive) window.show();
    return this.locked(async () => {
      const next = structuredClone(await this.read());
      next.widgets[id].enabled = true;
      next.widgets[id].bounds = restoreWidgetBounds(id, window.getBounds(), this.getDisplays());
      return this.persist(next);
    });
  }
  async flushWindow(window) {
    if (window.isDestroyed() || !window.webContents?.executeJavaScript) return;
    let timer;
    try {
      await Promise.race([
        window.webContents.executeJavaScript('window.__darkdeskWidgetFlush?.()'),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error('WIDGETS_SAVE_TIMEOUT')), 2000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async hide(id) {
    if (!widgetIds.includes(id)) throw Error('WIDGETS_INVALID');
    const window = this.open.get(id);
    if (window && !window.isDestroyed()) {
      await this.flushWindow(window);
      window.hide();
    }
    return this.locked(async () => {
      const next = structuredClone(await this.read());
      next.widgets[id].enabled = false;
      return this.persist(next);
    });
  }
  async saveBounds(id, window) {
    if (this.stopping || window.isDestroyed()) return;
    const bounds = restoreWidgetBounds(id, window.getBounds(), this.getDisplays());
    return this.locked(async () => {
      const next = structuredClone(await this.read());
      next.widgets[id].bounds = bounds;
      return this.persist(next);
    });
  }
  async stop() {
    this.stopping = true;
    for (const timer of this.moveTimers.values()) clearTimeout(timer);
    this.moveTimers.clear();
    try {
      await Promise.all(this.windows().map((window) => this.flushWindow(window)));
      await this.tail;
    } catch (error) {
      // The caller can keep the app open and retry. Never destroy a note window
      // whose renderer explicitly reported that its draft could not be saved.
      this.stopping = false;
      throw error;
    }
    // Keep enabled flags so explicitly enabled widgets return next launch.
    for (const window of this.windows()) window.destroy();
    this.open.clear();
    this.placements.clear();
  }
}
module.exports = { WidgetManager };
