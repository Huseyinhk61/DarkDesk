const path = require('node:path');
const { JsonStore } = require('./json-store.cjs');
const validTime = (value, now) => Number.isFinite(value) && value > 0 && value <= now;
function normalizedRecord(value, now) {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    ...record,
    firstSeen: validTime(record.firstSeen, now) ? record.firstSeen : now,
    count: Number.isSafeInteger(record.count) && record.count >= 0 ? record.count : 0,
    lastOpened: validTime(record.lastOpened, now) ? record.lastOpened : null,
    favorite: record.favorite === true,
  };
}
const assign = (records, id, value) =>
  Object.defineProperty(records, id, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
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
        const previous = Object.hasOwn(records, item.id) ? records[item.id] : undefined;
        const value = normalizedRecord(previous, this.clock());
        if (JSON.stringify(previous) !== JSON.stringify(value)) {
          assign(records, item.id, value);
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
        previous = normalizedRecord(
          Object.hasOwn(records, id) ? records[id] : undefined,
          this.clock(),
        );
      assign(records, id, {
        ...previous,
        count: Math.min(Number.MAX_SAFE_INTEGER, previous.count + 1),
        lastOpened: this.clock(),
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
      const previous = normalizedRecord(
        Object.hasOwn(records, id) ? records[id] : undefined,
        this.clock(),
      );
      assign(records, id, { ...previous, favorite });
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
