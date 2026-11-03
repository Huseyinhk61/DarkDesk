const fs = require('node:fs/promises');
const path = require('node:path');
class JsonStore {
  constructor(file, initial) {
    this.file = file;
    this.initial = initial;
  }
  async read() {
    try {
      const value = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) !== Array.isArray(this.initial)
      )
        throw Error('invalid');
      for (const [key, initial] of Object.entries(this.initial))
        if (Array.isArray(initial) && !Array.isArray(value[key])) throw Error('invalid');
      return value;
    } catch (e) {
      if (e.code === 'ENOENT') return structuredClone(this.initial);
      throw Error('RUNTIME_STATE_READ: ' + path.basename(this.file));
    }
  }
  async write(value) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temporary = this.file + '.' + require('node:crypto').randomUUID() + '.tmp';
    const handle = await fs.open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(value, null, 2));
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await fs.rename(temporary, this.file);
    } catch (error) {
      await fs.unlink(temporary).catch(() => {});
      throw error;
    }
    return value;
  }
}
module.exports = { JsonStore };
