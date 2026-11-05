const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { safeSegment } = require('../../shared/domain.js');
const { readInternetShortcut } = require('../internet-shortcut.cjs');

const fingerprint = (stat) => [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
const fail = () => {
  throw Error('SOURCE_MISSING');
};
const validId = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\0\r\n]/.test(value);
const validName = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  !/[\\/\0:]/.test(value) &&
  !['.', '..'].includes(value) &&
  path.basename(value) === value;
const validPath = (value) =>
  typeof value === 'string' &&
  value.length <= 32768 &&
  path.isAbsolute(value) &&
  !/[\0\r\n]/.test(value);
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
async function regular(file) {
  if (!validPath(file)) return null;
  try {
    const stat = await fs.lstat(file);
    return stat.isFile() && !stat.isSymbolicLink() ? stat : null;
  } catch {
    return null;
  }
}

class LauncherCatalog {
  constructor(service) {
    this.service = service;
    this.managed = new Map();
    this.cache = new Map();
  }
  permitted(name, settings) {
    return (
      validName(name) &&
      !name.startsWith('.') &&
      !new Set(['.ini', '.dll', '.sys', ...(settings.excludedExtensions || [])]).has(
        path.extname(name).toLowerCase(),
      )
    );
  }
  canonical(file) {
    const resolved = path.resolve(file);
    return this.service.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }
  async safeParents(file, paths) {
    const root = await fs.lstat(this.service.desktop);
    if (!root.isDirectory() || root.isSymbolicLink()) fail();
    await this.service.safeDirectory(path.dirname(file), false, paths);
    // safeDirectory permits not-yet-created directories for previews. Here all
    // ancestors must exist before a journal-owned file enters the launch index.
    let directory = path.dirname(file);
    while (!this.service.samePath(directory, this.service.desktop)) {
      const stat = await fs.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail();
      directory = path.dirname(directory);
    }
  }
  async verify(record) {
    await this.safeParents(record.source, record.paths);
    const stat = await regular(record.source);
    if (!stat) fail();
    const key = this.canonical(record.source) + '\0' + record.checksum;
    const mark = fingerprint(stat);
    if (this.cache.get(key) !== mark) {
      const handle = await fs.open(record.source, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      try {
        const opened = await handle.stat();
        if (!opened.isFile() || fingerprint(opened) !== mark) fail();
        const hash = crypto.createHash('sha256');
        for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
        if (hash.digest('hex') !== record.checksum || fingerprint(await handle.stat()) !== mark)
          fail();
      } finally {
        await handle.close();
      }
      const after = await regular(record.source);
      if (!after || fingerprint(after) !== mark) fail();
      await this.safeParents(record.source, record.paths);
      this.cache.delete(key);
      this.cache.set(key, mark);
      while (this.cache.size > 512) this.cache.delete(this.cache.keys().next().value);
    }
    return stat;
  }
  validEntry(entry, batch) {
    if (
      !entry ||
      !validId(entry.id) ||
      !validPath(entry.source) ||
      !validPath(entry.target) ||
      !['move', 'copy', 'shortcut'].includes(entry.action) ||
      entry.verified !== true ||
      entry.undone ||
      !['moved', 'copied'].includes(entry.stage) ||
      !isHash(entry.checksum) ||
      !Number.isFinite(entry.size) ||
      entry.size < 0 ||
      !Array.isArray(batch.categoryPaths) ||
      batch.categoryPaths.length > 5000
    )
      return false;
    if (
      !batch.categoryPaths.every(
        (value) =>
          typeof value === 'string' &&
          !path.isAbsolute(value) &&
          value.split(path.sep).length <= 16 &&
          value.split(path.sep).every(safeSegment),
      )
    )
      return false;
    const relative = path.relative(this.service.desktop, entry.target);
    if (
      !relative ||
      relative.startsWith('..') ||
      path.isAbsolute(relative) ||
      !batch.categoryPaths.includes(path.dirname(relative)) ||
      entry.categoryPath !== path.dirname(relative)
    )
      return false;
    try {
      this.service.validateJournal(entry, batch);
    } catch {
      return false;
    }
    if (entry.action !== 'shortcut') {
      if (entry.action !== batch.mode) return false;
      const scope = entry.sourceScope || 'desktop';
      const expected =
        scope === 'shared'
          ? this.service.sharedId(entry.source)
          : scope === 'downloads'
            ? 'download:' +
              crypto
                .createHash('sha256')
                .update(path.resolve(entry.source))
                .digest('hex')
                .slice(0, 24)
            : scope === 'desktop'
              ? path.basename(entry.source)
              : null;
      return expected === entry.id;
    }
    const item = entry.installed;
    if (
      !item ||
      item.id !== entry.id ||
      !/^app:[a-f0-9]{24}$/.test(entry.id) ||
      !validPath(item.source) ||
      !this.service.samePath(item.source, entry.source) ||
      !validName(item.name) ||
      !validPath(item.target || item.source) ||
      typeof (item.arguments || '') !== 'string' ||
      (item.arguments || '').length > 16384
    )
      return false;
    const identity =
      this.canonical(item.target || item.source) + '\0' + (item.arguments || '').trim();
    if (
      entry.id !==
      'app:' + crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24)
    )
      return false;
    const ext =
      this.service.platform === 'win32'
        ? path.extname(item.source).toLowerCase() === '.url'
          ? '.url'
          : '.lnk'
        : '.desktop';
    return path.basename(entry.target) === path.basename(item.name, path.extname(item.name)) + ext;
  }
  async sourceItem(entry, settings) {
    if (entry.action === 'shortcut' || !this.permitted(path.basename(entry.source), settings))
      return null;
    if (entry.sourceScope === 'shared') {
      try {
        await this.service.assertSharedSource(entry.source);
      } catch {
        return null;
      }
    }
    const stat = await regular(entry.source);
    if (!stat) return null;
    return this.item(
      entry,
      entry.source,
      stat,
      entry.sourceScope === 'downloads' ? 'downloads' : 'desktop',
    );
  }
  async item(entry, source, stat, scope = 'managed') {
    const name = path.basename(source),
      extension = path.extname(name).toLowerCase();
    let detail = {};
    if (extension === '.lnk' && this.service.resolveShortcut) {
      try {
        detail = (await this.service.resolveShortcut(source)) || {};
      } catch {}
    }
    if (extension === '.url') {
      try {
        detail = await readInternetShortcut(source);
      } catch {}
    }
    return {
      id: entry.id,
      name,
      source,
      scope,
      sourceScope: scope === 'managed' ? 'managed' : entry.sourceScope || scope,
      category: entry.category,
      target: detail.target || '',
      arguments: detail.args || '',
      launchUrl: detail.launchUrl || '',
      workingDirectory: detail.cwd || '',
      kind: ['.lnk', '.url', '.desktop', '.webloc'].includes(extension) ? 'shortcut' : 'file',
      extension,
      size: stat.size,
      modified: stat.mtimeMs,
      ...(scope === 'managed' ? { managed: true } : {}),
    };
  }
  async rebuild({ desktop, installed, external, settings, history }) {
    const items = new Map(),
      managed = new Map();
    for (const item of [...installed, ...external, ...desktop]) {
      if (!item || !validId(item.id) || !this.permitted(path.basename(item.source || ''), settings))
        continue;
      const stat = await regular(item.source);
      if (!stat) continue;
      // Copies and generated shortcuts must never displace a currently indexed
      // executable or the original user file.
      items.set(item.id, { ...item, size: stat.size, modified: stat.mtimeMs });
    }
    const seen = new Set(items.keys());
    for (const batch of [...history].reverse()) {
      if (
        !batch ||
        batch.status !== 'completed' ||
        !['move', 'copy'].includes(batch.mode) ||
        ![3, 4].includes(batch.version) ||
        !Array.isArray(batch.entries) ||
        batch.entries.length > 5000
      )
        continue;
      for (const entry of [...batch.entries].reverse()) {
        if (
          !this.validEntry(entry, batch) ||
          seen.has(entry.id) ||
          !this.permitted(path.basename(entry.target), settings)
        )
          continue;
        seen.add(entry.id);
        const original = await this.sourceItem(entry, settings);
        if (original) {
          items.set(entry.id, original);
          continue;
        }
        const record = {
          source: entry.target,
          checksum: entry.checksum,
          paths: batch.categoryPaths,
          category: entry.category,
          batchId: batch.id,
        };
        try {
          const stat = await this.verify(record);
          const item = await this.item(entry, entry.target, stat);
          items.set(item.id, item);
          managed.set(item.id, record);
        } catch {}
      }
    }
    return { items: [...items.values()], managed };
  }
  async resolve(item) {
    const record = this.managed.get(item.id);
    if (record) {
      if (!this.service.samePath(item.source, record.source)) fail();
      await this.verify(record);
    } else if (!(await regular(item.source))) fail();
    return item;
  }
}
module.exports = { LauncherCatalog };
