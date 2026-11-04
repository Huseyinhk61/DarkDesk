const path = require('node:path');
const fs = require('node:fs/promises');
const version = (item) => `${item.size}:${Math.floor(item.modified)}`;
const { JsonStore } = require('./json-store.cjs');
class AutomationService {
  constructor(service, data, clock = () => Date.now()) {
    this.service = service;
    this.clock = clock;
    this.store = new JsonStore(path.join(data, 'automation.json'), {
      lastRun: null,
      lastError: null,
      routed: {},
      lastBatches: [],
    });
  }
  async status() {
    return this.store.read();
  }
  async preview(settings) {
    const config = settings.automation;
    this.service.settings = settings;
    const state = await this.store.read();
    const desktop = await this.service.scan(settings);
    const archive = desktop.filter(
      (i) =>
        i.sourceScope !== 'shared' &&
        !i.shared &&
        i.modified < this.clock() - config.archiveDays * 86400000 &&
        state.routed[i.id] !== version(i),
    );
    let downloads = [];
    if (this.service.downloads) {
      downloads = (await this.service.scanDownloads()).filter(
        (i) =>
          i.modified < this.clock() - config.settleSeconds * 1000 &&
          state.routed[i.id] !== version(i),
      );
    }
    return { archive, downloads };
  }
  async suppress(batch) {
    const state = await this.store.read();
    for (const entry of batch.entries) {
      if (
        entry.action === 'shortcut' ||
        ![this.service.desktop, this.service.downloads].includes(path.dirname(entry.source))
      )
        continue;
      try {
        const stat = await fs.lstat(entry.source);
        if (stat.isFile() && !stat.isSymbolicLink())
          state.routed[entry.id] = version({ size: stat.size, modified: stat.mtimeMs });
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    await this.store.write(state);
  }
  async run(settings, prepared) {
    const config = settings.automation;
    if (!config.archiveEnabled && !config.downloadsEnabled) return this.status();
    const state = await this.store.read();
    state.lastRun = new Date(this.clock()).toISOString();
    state.lastError = null;
    const batches = [];
    try {
      const candidates = prepared || (await this.preview(settings));
      const groups = [];
      if (config.archiveEnabled)
        groups.push({
          items: candidates.archive
            .filter((i) => i.sourceScope !== 'shared' && !i.shared)
            .map((i) => ({ ...i, category: config.archiveCategoryId })),
          mode: 'move',
          origin: 'automation-archive',
        });
      if (config.downloadsEnabled)
        groups.push({
          items: candidates.downloads.filter((i) => state.routed[i.id] !== version(i)),
          mode: config.downloadMode,
          origin: 'automation-downloads',
        });
      for (const group of groups) {
        if (!group.items.length) continue;
        const selected = group.items.slice(0, 5000);
        const plan = await this.service.preview(
          selected.map(({ id, category }) => ({ id, category })),
          group.mode,
        );
        if (!plan.ready) continue;
        const batch = await this.service.organize(plan.token, group.origin);
        batches.push(batch.id);
        for (const item of selected)
          if (batch.entries.some((e) => e.id === item.id)) state.routed[item.id] = version(item);
      }
      state.lastBatches = batches;
      await this.store.write(state);
      return { ...state, batches };
    } catch (e) {
      state.lastError = e.message;
      state.lastBatches = batches;
      await this.store.write(state);
      throw e;
    }
  }
}
module.exports = { AutomationService };
