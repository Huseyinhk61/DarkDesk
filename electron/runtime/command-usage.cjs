const path = require('node:path');
const { JsonStore } = require('./json-store.cjs');
const fixed = new Set([
  'command:show',
  'command:organize',
  'command:restore',
  'system:empty-trash',
  'system:lock',
  'system:shutdown',
  'system:mute',
]);
class CommandUsage {
  constructor(data, { clock = () => Date.now() } = {}) {
    this.store = new JsonStore(path.join(data, 'command-usage.json'), {});
    this.clock = clock;
    this.tail = Promise.resolve();
  }
  allowed(id, settings) {
    return (
      typeof id === 'string' &&
      (fixed.has(id) || settings.profiles.some((profile) => id === 'command:' + profile.id))
    );
  }
  async read(settings) {
    const records = await this.store.read();
    return Object.fromEntries(
      Object.entries(records).filter(
        ([id, value]) =>
          this.allowed(id, settings) &&
          value &&
          Number.isSafeInteger(value.count) &&
          value.count > 0 &&
          Number.isFinite(value.lastUsed) &&
          value.lastUsed > 0 &&
          value.lastUsed <= this.clock(),
      ),
    );
  }
  record(id, settings) {
    if (!this.allowed(id, settings)) return Promise.reject(Error('LAUNCHER_INPUT_INVALID'));
    const next = this.tail.then(async () => {
      const records = await this.read(settings);
      const previous = records[id]?.count || 0;
      records[id] = {
        count: Math.min(Number.MAX_SAFE_INTEGER, previous + 1),
        lastUsed: this.clock(),
      };
      await this.store.write(records);
      return { id, ...records[id] };
    });
    this.tail = next.catch(() => {});
    return next;
  }
}
module.exports = { CommandUsage };
