const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const unavailable = () => Error('UPDATE_ACCESS_UNAVAILABLE');
const validToken = (token) =>
  typeof token === 'string' &&
  token.length >= 20 &&
  token.length <= 512 &&
  !/[\s\p{C}]/u.test(token);

// Only the main process owns this store. Its status method never returns the
// credential; Windows safeStorage/DPAPI must be available before any use.
class UpdateAccessStore {
  constructor({ directory, safeStorage, platform = process.platform }) {
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw unavailable();
    this.directory = directory;
    this.file = path.join(directory, 'update-access.bin');
    this.safeStorage = safeStorage;
    this.platform = platform;
    this.pending = Promise.resolve();
  }

  supported() {
    try {
      return (
        this.platform === 'win32' &&
        this.safeStorage?.isEncryptionAvailable() === true &&
        typeof this.safeStorage.encryptString === 'function' &&
        typeof this.safeStorage.decryptString === 'function'
      );
    } catch {
      return false;
    }
  }

  run(action) {
    const operation = this.pending.catch(() => {}).then(action);
    this.pending = operation.catch(() => {});
    return operation;
  }

  async guardDirectory(create = false) {
    if (create) await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    try {
      const stat = await fs.lstat(this.directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw unavailable();
      return true;
    } catch (error) {
      if (!create && error.code === 'ENOENT') return false;
      throw unavailable();
    }
  }

  async existingFile() {
    try {
      const stat = await fs.lstat(this.file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw unavailable();
      return stat;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw unavailable();
    }
  }

  async readStored() {
    if (!this.supported()) throw unavailable();
    let handle;
    try {
      if (!(await this.guardDirectory())) return null;
      const before = await this.existingFile();
      if (!before) return null;
      if (before.size < 1 || before.size > 64 * 1024) throw unavailable();
      handle = await fs.open(this.file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      const opened = await handle.stat();
      if (!opened.isFile() || before.dev !== opened.dev || before.ino !== opened.ino)
        throw unavailable();
      const ciphertext = await handle.readFile();
      if (!ciphertext.length || ciphertext.length > 64 * 1024) throw unavailable();
      const token = this.safeStorage.decryptString(ciphertext);
      if (!validToken(token)) throw unavailable();
      return token;
    } catch {
      // Never forward crypto, filesystem or credential data to the renderer.
      throw unavailable();
    } finally {
      await handle?.close().catch(() => {});
    }
  }

  read() {
    return this.run(() => this.readStored());
  }

  save(token) {
    return this.run(async () => {
      if (!this.supported()) throw unavailable();
      if (!validToken(token)) throw Error('UPDATE_AUTH_FAILED');
      let temporary;
      let handle;
      try {
        await this.guardDirectory(true);
        await this.existingFile();
        const ciphertext = this.safeStorage.encryptString(token);
        if (!Buffer.isBuffer(ciphertext) || !ciphertext.length || ciphertext.length > 64 * 1024)
          throw unavailable();
        temporary = path.join(this.directory, '.update-access.' + randomUUID() + '.tmp');
        handle = await fs.open(temporary, 'wx', 0o600);
        await handle.writeFile(ciphertext);
        await handle.sync();
        await handle.close();
        handle = null;
        // Refuse a newly substituted link as well as a link seen before writing.
        await this.existingFile();
        await fs.rename(temporary, this.file);
        temporary = null;
      } catch {
        throw unavailable();
      } finally {
        await handle?.close().catch(() => {});
        if (temporary) await fs.unlink(temporary).catch(() => {});
      }
    });
  }

  clear() {
    return this.run(async () => {
      try {
        // Deleting an owned credential does not need decryption to work.
        if (!(await this.guardDirectory())) return;
        if (await this.existingFile()) await fs.unlink(this.file);
      } catch {
        throw unavailable();
      }
    });
  }

  status() {
    return this.run(async () => {
      if (!this.supported()) return { supported: false, configured: false };
      const token = await this.readStored();
      return { supported: true, configured: token !== null };
    });
  }
}

module.exports = { UpdateAccessStore };
