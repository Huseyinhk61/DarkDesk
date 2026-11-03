const path = require('node:path');
const fs = require('node:fs/promises');
const { DesktopService } = require('../service.cjs');
const { DeepScanner } = require('../scanner.cjs');
const { FolderIcons } = require('../folder-icons.cjs');
const { SettingsStore } = require('../settings.cjs');
const { ProfileService } = require('./profiles.cjs');
const { VisibilityAdapter } = require('./visibility.cjs');
const { ActivityStore } = require('./activity.cjs');
const { AutomationService } = require('./automation.cjs');
const { enrichItem } = require('../../shared/domain.js');
class DesktopRuntime {
  constructor({
    desktop,
    downloads,
    data,
    platform = process.platform,
    resolveShortcut,
    emit = () => {},
    launch = async () => {},
  }) {
    this.desktop = desktop;
    this.downloads = downloads;
    this.data = data;
    this.platform = platform;
    this.emit = emit;
    this.launchNative = launch;
    this.busy = null;
    this.stopping = false;
    this.lastError = null;
    this.shortcuts = [];
    this.trayAvailable = false;
    this.desktopDirty = true;
    this.settings = new SettingsStore(data);
    this.scanner = new DeepScanner({
      platform,
      resolveShortcut,
      onProgress: (value) => emit('scanProgress', value),
    });
    this.service = new DesktopService(desktop, data, {
      downloads,
      scanner: this.scanner,
      folderIcons: new FolderIcons(data, platform),
      resolveShortcut,
      platform,
      onProgress: (value) => emit('progress', value),
    });
    this.profiles = new ProfileService(desktop, data, new VisibilityAdapter(desktop, platform));
    this.activity = new ActivityStore(data);
    this.automation = new AutomationService(this.service, data);
    this.catalog = new Map();
  }
  async initialize() {
    try {
      await this.profiles.initialize();
    } catch (e) {
      this.lastError = e.message;
    }
    this.timer = setInterval(() => this.tick(), 5000);
    this.timer.unref?.();
  }
  async status() {
    return {
      busy: this.busy,
      profile: await this.profiles.status(),
      automation: await this.automation.status(),
      shortcuts: this.shortcuts,
      trayAvailable: this.trayAvailable,
      lastError: this.lastError,
      visibilitySupported: ['win32', 'linux'].includes(this.platform),
    };
  }
  async broadcast() {
    this.emit('runtimeChanged', await this.status());
  }
  async run(name, action) {
    if (this.busy || this.stopping) throw Error('OPERATION_BUSY');
    this.busy = name;
    this.lastError = null;
    const operation = (async () => {
      try {
        await this.broadcast();
        return await action();
      } catch (e) {
        this.lastError = e.message;
        throw e;
      } finally {
        this.busy = null;
        await this.broadcast();
      }
    })();
    this.current = operation;
    return operation;
  }

  async suspendVisibility(action, token) {
    const status = await this.profiles.status();
    const settings = await this.settings.read();
    const profile = settings.profiles.find((p) => p.id === status.activeId);
    try {
      if (profile) {
        if (token) await this.service.rebaseVisibility(token, () => this.profiles.restore());
        else await this.profiles.restore();
      }
      return await action();
    } finally {
      if (profile) await this.profiles.apply(profile, await this.settings.read());
    }
  }
  async scan(scope = 'desktop') {
    const settings = await this.settings.read();
    this.service.settings = settings;
    const data =
      scope === 'system'
        ? [...this.scanner.catalog.values()].map((i) => enrichItem(i, settings))
        : scope === 'downloads'
          ? await this.service.scanDownloads()
          : await this.service.scan(settings);
    const items = await this.activity.annotate(data);
    items.forEach((item) => this.catalog.set(item.id, item));
    return items;
  }
  async scanSystem() {
    return this.run('deep', async () => {
      const settings = await this.settings.read();
      const result = await this.scanner.scan(settings);
      result.items = await this.activity.annotate(result.items.map((i) => enrichItem(i, settings)));
      result.items.forEach((i) => this.catalog.set(i.id, i));
      return result;
    });
  }
  async preview(items, mode) {
    this.service.settings = await this.settings.read();
    return this.service.preview(items, mode);
  }
  async organize(token) {
    return this.run('organize', () =>
      this.suspendVisibility(() => this.service.organize(token), token),
    );
  }
  async undo() {
    return this.run('undo', () =>
      this.suspendVisibility(async () => {
        const batch = await this.service.undo();
        await this.automation.suppress(batch);
        return batch;
      }),
    );
  }
  async applyProfile(id) {
    return this.run('profile', async () => {
      const settings = await this.settings.read();
      const profile = settings.profiles.find((p) => p.id === id);
      if (!profile) throw Error('PROFILE_INVALID');
      return this.profiles.apply(profile, settings);
    });
  }
  async restoreProfile() {
    return this.run('profile', () => this.profiles.restore());
  }
  async saveSettings(value) {
    return this.run('settings', async () => {
      const saved = await this.settings.write(value);
      const current = await this.profiles.status();
      if (current.activeId) {
        const profile = saved.profiles.find((p) => p.id === current.activeId);
        if (profile) await this.profiles.apply(profile, saved);
        else await this.profiles.restore();
      }
      return saved;
    });
  }
  async entries() {
    await this.scan('desktop');
    for (const item of this.scanner.catalog.values()) this.catalog.set(item.id, item);
    const settings = await this.settings.read();
    const items = await this.activity.annotate(
      [...this.catalog.values()].map((i) => enrichItem(i, settings)),
    );
    items.forEach((i) => this.catalog.set(i.id, i));
    return { items, settings };
  }
  async launch(id) {
    return this.run('launch', async () => {
      const item =
        this.catalog.get(id) ||
        this.scanner.catalog.get(id) ||
        this.service.externalCatalog.get(id);
      if (!item) throw Error('SOURCE_MISSING');
      const stat = await fs.lstat(item.source);
      if (!stat.isFile() || stat.isSymbolicLink()) throw Error('SOURCE_MISSING');
      await this.launchNative(item);
      await this.activity.record(id);
      return { id };
    });
  }
  async registerDrop(paths) {
    this.service.settings = await this.settings.read();
    const items = await this.service.registerPaths(paths);
    items.forEach((i) => this.catalog.set(i.id, i));
    return items;
  }
  async previewAutomation(draft) {
    const { validateSettings } = require('../../shared/validate.js');
    return this.automation.preview(validateSettings(draft || (await this.settings.read())));
  }
  async runAutomation() {
    return this.run('automation', async () => {
      const settings = await this.settings.read(),
        prepared = await this.automation.preview(settings),
        hasWork =
          (settings.automation.archiveEnabled && prepared.archive.length) ||
          (settings.automation.downloadsEnabled && prepared.downloads.length);
      const act = () => this.automation.run(settings, prepared);
      const result = hasWork ? await this.suspendVisibility(act) : await act();
      if (result.batches?.length) this.emit('desktopChanged');
      return result;
    });
  }

  async tick() {
    if (this.busy || this.stopping) return;
    try {
      const settings = await this.settings.read();
      if (settings.automation.archiveEnabled || settings.automation.downloadsEnabled)
        await this.runAutomation();
      else {
        const state = await this.profiles.status();
        if (state.activeId && this.desktopDirty) {
          this.desktopDirty = false;
          const profile = settings.profiles.find((p) => p.id === state.activeId);
          if (profile) await this.run('profile', () => this.profiles.apply(profile, settings));
        }
      }
    } catch (e) {
      this.lastError = e.message;
      await this.broadcast().catch(() => {});
    }
  }
  async prepareQuit() {
    this.stopping = true;
    clearInterval(this.timer);
    this.scanner.cancel();
    if (this.current) await this.current.catch(() => {});
    await this.activity.tail;
    await this.profiles.restore();
  }
}
module.exports = { DesktopRuntime };
