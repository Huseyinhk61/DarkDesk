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
        if (!records[item.id]) {
          records[item.id] = { firstSeen: this.clock(), count: 0, lastOpened: null };
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
        previous = records[id] || { firstSeen: this.clock(), count: 0 };
      records[id] = { ...previous, count: previous.count + 1, lastOpened: this.clock() };
      await this.store.write(records);
      return records[id];
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
