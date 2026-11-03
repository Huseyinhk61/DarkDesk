const fs = require('node:fs/promises');
const path = require('node:path');
const { JsonStore } = require('./json-store.cjs');
const { classify, categorySegments } = require('../../shared/domain.js');
const identity = (stat) => `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
class ProfileService {
  constructor(desktop, data, adapter) {
    this.desktop = desktop;
    this.adapter = adapter;
    this.store = new JsonStore(path.join(data, 'visibility.json'), {
      activeId: null,
      phase: 'idle',
      entries: [],
    });
    this.busy = false;
  }
  async status() {
    const state = await this.store.read();
    return {
      activeId: state.activeId,
      phase: state.phase,
      hidden: state.entries.filter((e) => e.appliedHidden && !e.baselineHidden).length,
      tracked: state.entries.length,
    };
  }
  async initialize() {
    const state = await this.store.read();
    if (state.entries.length) await this.restore();
  }
  async apply(profile, settings) {
    if (this.busy) throw Error('OPERATION_BUSY');
    this.busy = true;
    try {
      const state = await this.store.read();
      state.activeId = profile.id;
      state.phase = 'applying';
      await this.store.write(state);
      const directory = await fs.readdir(this.desktop, { withFileTypes: true });
      const pending = [],
        unknown = [];
      const byName = new Map(state.entries.map((e) => [e.name, e]));
      const matches = (id) => {
        let category = settings.categories.find((c) => c.id === id);
        while (category) {
          if (profile.categories.includes(category.id)) return true;
          category = category.parentId
            ? settings.categories.find((c) => c.id === category.parentId)
            : null;
        }
        return false;
      };
      for (const entry of directory) {
        if (
          entry.name.startsWith('.') ||
          entry.name.toLowerCase() === 'desktop.ini' ||
          (!entry.isFile() && !entry.isDirectory()) ||
          /[\r\n]/.test(entry.name)
        )
          continue;
        const file = path.join(this.desktop, entry.name);
        const stat = await fs.lstat(file);
        if (stat.isSymbolicLink()) continue;
        let record = byName.get(entry.name);
        if (
          !record ||
          record.identity !== identity(stat) ||
          typeof record.baselineHidden !== 'boolean'
        ) {
          record = { name: entry.name, identity: identity(stat), baselineHidden: null };
          state.entries = state.entries.filter((e) => e.name !== entry.name);
          state.entries.push(record);
          byName.set(entry.name, record);
          unknown.push(file);
        }
        const group = entry.isDirectory()
          ? settings.categories.find(
              (c) => !c.parentId && categorySegments(c.id, settings.categories)[0] === entry.name,
            )
          : null;
        const cid = group?.id || classify({ id: entry.name, name: entry.name }, settings);
        pending.push({
          file,
          record,
          hide:
            !(profile.visibleNames || []).some(
              (name) => name.toLowerCase() === entry.name.toLowerCase(),
            ) && !matches(cid),
        });
      }
      const baseline = await this.adapter.readMany(unknown);
      for (const { path: file, hidden } of baseline)
        byName.get(path.basename(file)).baselineHidden = hidden;
      for (const p of pending) p.record.appliedHidden = p.record.baselineHidden || p.hide;
      await this.store.write(state);
      await this.adapter.setMany(
        pending.map((p) => ({ path: p.file, hidden: p.record.appliedHidden })),
      );
      state.phase = 'active';
      await this.store.write(state);
      return this.status();
    } finally {
      this.busy = false;
    }
  }
  async restore() {
    if (this.busy) throw Error('OPERATION_BUSY');
    this.busy = true;
    try {
      const state = await this.store.read();
      state.phase = 'restoring';
      await this.store.write(state);
      const pending = [];
      for (const entry of state.entries) {
        const file = path.join(this.desktop, entry.name);
        if (path.dirname(file) !== this.desktop || path.basename(file) !== entry.name)
          throw Error('HISTORY_UNSAFE');
        try {
          const stat = await fs.lstat(file);
          if (
            typeof entry.baselineHidden === 'boolean' &&
            !stat.isSymbolicLink() &&
            identity(stat) === entry.identity
          )
            pending.push({ path: file, hidden: entry.baselineHidden });
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
      }
      await this.adapter.setMany(pending);
      await this.store.write({ activeId: null, phase: 'idle', entries: [] });
      return this.status();
    } finally {
      this.busy = false;
    }
  }
}
module.exports = { ProfileService };
