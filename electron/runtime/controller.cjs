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
const { ItemDetailsService } = require('./item-details.cjs');
const { enrichItem } = require('../../shared/domain.js');
const { applyFolderAppearance } = require('../folder-appearance.cjs');
const { LauncherCatalog } = require('./launcher-catalog.cjs');
class DesktopRuntime {
  constructor({
    desktop,
    downloads,
    sharedDesktop,
    data,
    platform = process.platform,
    resolveShortcut,
    getFileIcon,
    emit = () => {},
    launch = async () => {},
  }) {
    this.desktop = desktop;
    this.downloads = downloads;
    this.sharedDesktop = sharedDesktop;
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
      sharedDesktop,
      scanner: this.scanner,
      folderIcons: new FolderIcons(data, platform),
      resolveShortcut,
      platform,
      onProgress: (value) => emit('progress', value),
    });
    this.profiles = new ProfileService(desktop, data, new VisibilityAdapter(desktop, platform));
    this.activity = new ActivityStore(data);
    this.details = new ItemDetailsService({ platform, resolveShortcut, getFileIcon });
    this.automation = new AutomationService(this.service, data);
    this.catalog = new Map();
    this.launcherCatalog = new LauncherCatalog(this.service);
    this.catalogGeneration = 0;
    this.catalogRevision = 0;
    this.catalogRefresh = null;
    this.catalogMutating = false;
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
    const [profile, automation] = await Promise.all([
      this.profiles.status(),
      this.automation.status(),
    ]);
    return {
      busy: this.busy,
      desktopScanReport: structuredClone(this.service.scanReport),
      profile,
      automation,
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
    if (['organize', 'undo', 'deep', 'settings'].includes(name)) {
      this.catalogGeneration++;
      this.catalogMutating = true;
    }
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
        this.catalogMutating = false;
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
    const generation = this.catalogGeneration,
      revision = this.catalogRevision;
    const settings = await this.settings.read();
    this.service.settings = settings;
    const data =
      scope === 'system'
        ? [...this.scanner.catalog.values()].map((i) => enrichItem(i, settings))
        : scope === 'downloads'
          ? await this.service.scanDownloads()
          : await this.service.scan(settings);
    const items = await this.activity.annotate(data);
    this.acceptScanned(items, scope, generation, revision);
    return items;
  }
  acceptScanned(items, scope, generation, revision) {
    if (generation !== this.catalogGeneration || revision !== this.catalogRevision) return;
    const ids = new Set(items.map((item) => item.id));
    for (const [id, item] of this.catalog) {
      const belongs = scope === 'system' ? item.kind === 'installed' : item.scope === scope;
      if (belongs && !ids.has(id)) this.catalog.delete(id);
    }
    for (const item of items) {
      this.catalog.set(item.id, item);
      const managed = this.launcherCatalog.managed.get(item.id);
      if (managed && !this.service.samePath(managed.source, item.source))
        this.launcherCatalog.managed.delete(item.id);
    }
  }
  async scanSystem() {
    return this.run('deep', async () => {
      const generation = this.catalogGeneration,
        revision = this.catalogRevision;
      const settings = await this.settings.read();
      const result = await this.scanner.scan(settings);
      result.items = await this.activity.annotate(result.items.map((i) => enrichItem(i, settings)));
      this.acceptScanned(result.items, 'system', generation, revision);
      return result;
    });
  }
  async preview(items, mode) {
    this.service.settings = await this.settings.read();
    return this.service.preview(items, mode);
  }
  async organize(token) {
    return this.run('organize', () =>
      this.suspendVisibility(async () => {
        const batch = await this.service.organize(token);
        await this.refreshAfterFileOperation();
        return batch;
      }, token),
    );
  }
  async undo() {
    return this.run('undo', () =>
      this.suspendVisibility(async () => {
        const batch = await this.service.undo();
        await this.automation.suppress(batch);
        await this.refreshAfterFileOperation();
        return batch;
      }),
    );
  }
  async applyFolderAppearance() {
    return this.run('folder-appearance', async () =>
      applyFolderAppearance(this.service, await this.settings.read()),
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
    if (this.catalogMutating || this.stopping) throw Error('OPERATION_BUSY');
    const result = await this.refreshLauncherCatalog();
    if (this.catalogMutating || this.stopping) throw Error('OPERATION_BUSY');
    return result;
  }
  async refreshLauncherCatalog() {
    const generation = this.catalogGeneration;
    const previous = this.catalogRefresh;
    if (previous) {
      try {
        const result = await previous.promise;
        if (generation === previous.generation && generation === this.catalogGeneration)
          return result;
      } catch (error) {
        if (generation === previous.generation) throw error;
      }
    }
    if (generation !== this.catalogGeneration) throw Error('OPERATION_BUSY');
    const refresh = { generation };
    refresh.promise = (async () => {
      const settings = await this.settings.read();
      this.service.settings = settings;
      const desktop = await this.service.scan(settings);
      const history = await this.service.history().catch(() => []);
      const result = await this.launcherCatalog.rebuild({
        desktop,
        installed: [...this.scanner.catalog.values()],
        external: [...this.service.externalCatalog.values()],
        settings,
        history,
      });
      const items = await this.activity.annotate(
        result.items.map((item) => {
          const enriched = enrichItem(item, settings);
          const managed = result.managed.get(item.id);
          if (managed && settings.categories.some((category) => category.id === managed.category))
            enriched.category = managed.category;
          return enriched;
        }),
      );
      if (generation !== this.catalogGeneration || this.stopping) throw Error('OPERATION_BUSY');
      this.catalog = new Map(items.map((item) => [item.id, item]));
      this.launcherCatalog.managed = result.managed;
      this.catalogRevision++;
      return { items, settings };
    })();
    this.catalogRefresh = refresh;
    try {
      return await refresh.promise;
    } finally {
      if (this.catalogRefresh === refresh) this.catalogRefresh = null;
    }
  }
  async refreshAfterFileOperation() {
    try {
      await this.refreshLauncherCatalog();
    } catch {
      // A catalog refresh failure must not turn a completed file transaction
      // into an apparent failure. Drop stale paths; the next open can rebuild.
      this.catalog.clear();
      this.launcherCatalog.managed.clear();
      this.catalogRevision++;
    }
  }
  trustedItem(id) {
    if (typeof id !== 'string' || id.length > 512) throw Error('SOURCE_MISSING');
    const item =
      this.catalog.get(id) || this.scanner.catalog.get(id) || this.service.externalCatalog.get(id);
    if (!item) throw Error('SOURCE_MISSING');
    return item;
  }
  async setFavorite(id, favorite) {
    await this.resolveTrustedItem(id);
    return this.activity.setFavorite(id, favorite);
  }
  async itemIcon(id, refresh = false) {
    if (typeof refresh !== 'boolean') throw Error('ICON_INVALID');
    return this.details.icon(await this.resolveTrustedItem(id), { refresh });
  }
  async itemDetails(id) {
    const item = await this.resolveTrustedItem(id);
    const details = await this.details.details(item);
    const [current] = await this.activity.annotate([item]);
    return { ...details, lastOpened: current.usage.lastOpened, usageScope: 'darkdesk-only' };
  }
  async launch(id) {
    return this.run('launch', async () => {
      const item = await this.resolveTrustedItem(id);
      await this.launchNative(item);
      await this.activity.record(id);
      return { id };
    });
  }
  async resolveTrustedItem(id) {
    const item = this.trustedItem(id);
    try {
      return await this.launcherCatalog.resolve(item);
    } catch {
      this.catalog.delete(id);
      this.launcherCatalog.managed.delete(id);
      throw Error('SOURCE_MISSING');
    }
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
      if (hasWork) {
        this.catalogGeneration++;
        this.catalogMutating = true;
      }
      const result = hasWork ? await this.suspendVisibility(act) : await act();
      if (result.batches?.length) {
        await this.refreshAfterFileOperation();
        this.emit('desktopChanged');
      }
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
