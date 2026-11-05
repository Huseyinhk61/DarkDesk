const path = require('node:path');
const { JsonStore } = require('./json-store.cjs');
class ActivityStore {
  constructor(data, clock = () => Date.now()) {
    this.store = new JsonStore(path.join(data, 'usage.json'), {});
    this.clock = clock;
    this.tail = Promise.resolve();
  }
  locked(action) {
    const next = this.tail.then(action, action);
    this.tail = next.catch(() => {});
    return next;
  }
  async observe(items) {
    return this.locked(async () => {
      const records = await this.store.read();
      let changed = false;
      for (const item of items) {
        if (!Object.hasOwn(records, item.id)) {
          Object.defineProperty(records, item.id, {
            value: { firstSeen: this.clock(), count: 0, lastOpened: null },
            enumerable: true,
            configurable: true,
            writable: true,
          });
          changed = true;
        }
      }
      if (changed) await this.store.write(records);
      return records;
    });
  }
  async record(id) {
    return this.locked(async () => {
      const records = await this.store.read(),
        previous = Object.hasOwn(records, id) ? records[id] : { firstSeen: this.clock(), count: 0 };
      Object.defineProperty(records, id, {
        value: {
          ...previous,
          count: (Number.isFinite(previous.count) ? Math.max(0, previous.count) : 0) + 1,
          lastOpened: this.clock(),
        },
        enumerable: true,
        configurable: true,
        writable: true,
      });
      await this.store.write(records);
      return records[id];
    });
  }
  async setFavorite(id, favorite) {
    if (typeof id !== 'string' || !id || id.length > 512 || typeof favorite !== 'boolean')
      throw Error('FAVORITE_INVALID');
    return this.locked(async () => {
      const records = await this.store.read();
      const previous = Object.hasOwn(records, id)
        ? records[id]
        : { firstSeen: this.clock(), count: 0, lastOpened: null };
      Object.defineProperty(records, id, {
        value: { ...previous, favorite },
        enumerable: true,
        configurable: true,
        writable: true,
      });
      await this.store.write(records);
      return { id, favorite };
    });
  }
  async annotate(items) {
    const records = await this.observe(items),
      cutoff = new Date(this.clock());
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
    return items.map((item) => {
      const usage = records[item.id];
      return {
        ...item,
        usage: {
          ...usage,
          scope: 'darkdesk-only',
          inactive: !!usage.lastOpened && usage.lastOpened < cutoff.getTime(),
        },
      };
    });
  }
}
module.exports = { ActivityStore };
