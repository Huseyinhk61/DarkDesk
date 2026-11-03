const fs = require('node:fs/promises');
const { createReadStream, constants } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  defaultCategories,
  defaultSettings,
  categorySegments,
  categoryId,
  classify,
  defaultCategory,
} = require('../shared/domain.js');
const folders = defaultCategories.map((c) => c.folder);
const shortcutExtensions = new Set(['.lnk', '.url', '.desktop', '.webloc']);
function category(name, target = '') {
  return defaultCategories.findIndex((c) => c.id === defaultCategory(name, target));
}
const exists = async (file) => {
  try {
    return await fs.lstat(file);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
};
const fingerprint = (stat) =>
  `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
async function digest(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function validId(id) {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id !== '.' &&
    id !== '..' &&
    !/[\\/\0:]/.test(id) &&
    path.basename(id) === id
  );
}

class DesktopService {
  constructor(desktop, data, options = {}) {
    this.desktop = path.resolve(desktop);
    this.log = path.join(data, 'history.json');
    this.resolveShortcut = options.resolveShortcut;
    this.onProgress = options.onProgress || (() => {});
    this.previews = new Map();
    this.busy = false;
    this.settings = structuredClone(defaultSettings);
    this.scanner = options.scanner;
    this.folderIcons = options.folderIcons;
    this.platform = options.platform || process.platform;
  }
  async exclusive(action) {
    if (this.busy) throw Error('OPERATION_BUSY');
    this.busy = true;
    try {
      return await action();
    } finally {
      this.busy = false;
    }
  }
  async history() {
    try {
      const log = JSON.parse(await fs.readFile(this.log, 'utf8'));
      if (!Array.isArray(log)) throw Error('HISTORY_INVALID');
      return log;
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw Error('HISTORY_READ');
    }
  }
  async save(log) {
    await fs.mkdir(path.dirname(this.log), { recursive: true });
    await fs.writeFile(this.log + '.tmp', JSON.stringify(log, null, 2), { mode: 0o600 });
    await fs.rename(this.log + '.tmp', this.log);
  }
  async scan(settings = this.settings) {
    this.settings = { ...structuredClone(defaultSettings), ...settings };
    settings = this.settings;
    const ignored = new Set(settings.excludedExtensions || ['.ini', '.tmp']);
    let entries;
    try {
      entries = await fs.readdir(this.desktop, { withFileTypes: true });
    } catch (e) {
      throw Error('DESKTOP_READ: ' + (e.code || ''));
    }
    const result = [];
    // Sequential metadata reads avoid exhausting handles on large desktops.
    for (const entry of entries) {
      const extension = path.extname(entry.name).toLowerCase();
      if (!entry.isFile() || entry.name.startsWith('.') || ignored.has(extension)) continue;
      const source = path.join(this.desktop, entry.name);
      try {
        const stat = await fs.lstat(source);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        let target = '';
        if (extension === '.lnk' && this.resolveShortcut) {
          try {
            target = (await this.resolveShortcut(source))?.target || '';
          } catch {
            /* Unresolvable shortcuts remain usable files. */
          }
        }
        const override = settings.overrides?.[entry.name];
        result.push({
          id: entry.name,
          name: entry.name,
          source,
          target,
          category: classify({ id: entry.name, name: entry.name, target }, settings),
          scope: 'desktop',
          size: stat.size,
          modified: stat.mtimeMs,
          kind: shortcutExtensions.has(extension) ? 'shortcut' : 'file',
          extension,
        });
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }
  async safeDirectory(directory, create = false, allowedPaths = []) {
    const relative = path.relative(this.desktop, directory);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
      throw Error('TARGET_INVALID');
    const permitted = [
      ...this.settings.categories.map((c) =>
        categorySegments(c.id, this.settings.categories).join(path.sep),
      ),
      ...allowedPaths,
    ];
    if (!permitted.some((p) => p === relative || p.startsWith(relative + path.sep)))
      throw Error('TARGET_INVALID');
    let current = this.desktop,
      created = false;
    for (const part of relative.split(path.sep)) {
      current = path.join(current, part);
      if (create) {
        try {
          await fs.mkdir(current);
          if (current === directory) created = true;
        } catch (e) {
          if (e.code !== 'EEXIST') throw e;
        }
      }
      const stat = await exists(current);
      if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw Error('TARGET_UNSAFE');
    }
    return created;
  }
  async preview(items, mode) {
    if (
      !['move', 'copy'].includes(mode) ||
      !Array.isArray(items) ||
      !items.length ||
      items.length > 5000
    )
      throw Error('SELECTION_INVALID');
    if (new Set(items.map((i) => i?.id)).size !== items.length) throw Error('DUPLICATE_ITEM');
    const entries = [];
    for (const item of items) {
      if (
        !(
          validId(item?.id) ||
          (typeof item?.id === 'string' && this.scanner?.catalog.has(item.id))
        ) ||
        !this.settings.categories.some((c) => c.id === categoryId(item.category))
      )
        throw Error('CATEGORY_INVALID');
      const installed = this.scanner?.catalog.get(item.id);
      const source = installed ? installed.source : path.join(this.desktop, item.id);
      const cid = categoryId(item.category);
      const segments = categorySegments(cid, this.settings.categories);
      const targetName = installed
        ? path.basename(installed.name, path.extname(installed.name)) +
          (this.platform === 'win32' ? '.lnk' : '.desktop')
        : item.id;
      const target = path.join(this.desktop, ...segments, targetName);
      const stat = await exists(source);
      if (!stat?.isFile() || stat.isSymbolicLink()) throw Error(`SOURCE_MISSING: ${item.id}`);
      let conflict = '';
      try {
        await this.safeDirectory(path.dirname(target));
        if (await exists(target)) conflict = 'TARGET_EXISTS';
      } catch (e) {
        conflict = e.message;
      }
      entries.push({
        id: item.id,
        category: cid,
        categoryPath: segments.join(path.sep),
        name: installed?.name || item.id,
        action: installed ? 'shortcut' : mode,
        installed: installed || null,
        source,
        target,
        size: stat.size,
        modified: stat.mtimeMs,
        fingerprint: fingerprint(stat),
        conflict,
      });
    }
    const targets = new Set();
    for (const entry of entries) {
      const key = this.platform === 'win32' ? entry.target.toLowerCase() : entry.target;
      if (targets.has(key)) entry.conflict = 'TARGET_DUPLICATE';
      targets.add(key);
    }
    // Only the main process retains trusted paths and fingerprints.
    this.previews.clear();
    const token = crypto.randomUUID();
    this.previews.set(token, {
      entries,
      mode,
      settings: structuredClone(this.settings),
      expires: Date.now() + 5 * 60_000,
    });
    return {
      token,
      mode,
      entries,
      ready: entries.filter((e) => !e.conflict).length,
      conflicts: entries.filter((e) => e.conflict).length,
      bytes: entries.filter((e) => !e.conflict).reduce((n, e) => n + e.size, 0),
    };
  }
  async organize(token) {
    return this.exclusive(async () => {
      const plan = this.previews.get(token);
      this.previews.delete(token);
      if (!plan || plan.expires < Date.now()) throw Error('PREVIEW_EXPIRED');
      const entries = plan.entries.filter((e) => !e.conflict);
      if (!entries.length) throw Error('NO_READY');
      // Preflight every selected source before changing any files.
      for (const entry of entries) {
        const stat = await exists(entry.source);
        if (!stat?.isFile() || stat.isSymbolicLink() || fingerprint(stat) !== entry.fingerprint)
          throw Error(`SOURCE_CHANGED: ${entry.id}`);
        await this.safeDirectory(
          path.dirname(entry.target),
          false,
          plan.entries.map((e) => e.categoryPath),
        );
        if (await exists(entry.target)) throw Error(`TARGET_EXISTS: ${entry.id}`);
      }
      const log = await this.history();
      const batch = {
        version: 3,
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        mode: plan.mode,
        status: 'running',
        entries: [],
        directories: [],
        metadata: [],
        categoryPaths: entries.map((e) => e.categoryPath),
        skipped: plan.entries.filter((e) => e.conflict).map((e) => e.id),
      };
      log.push(batch);
      await this.save(log);
      try {
        for (const entry of entries) {
          const stat = await fs.lstat(entry.source);
          if (!stat.isFile() || stat.isSymbolicLink() || fingerprint(stat) !== entry.fingerprint)
            throw Error(`SOURCE_CHANGED: ${entry.id}`);
          const checksum = entry.action === 'shortcut' ? null : await digest(entry.source);
          const journal = { ...entry, checksum, stage: 'planned' };
          batch.entries.push(journal);
          await this.save(log); // Record intention before creating a file or removing a source.
          const directory = path.dirname(entry.target);
          const missing = [];
          let ancestor = directory;
          while (ancestor !== this.desktop) {
            if (!(await exists(ancestor))) missing.unshift(ancestor);
            ancestor = path.dirname(ancestor);
          }
          if (await this.safeDirectory(directory, true, batch.categoryPaths)) {
            batch.directories.push(...missing.filter((p) => !batch.directories.includes(p)));
            await this.save(log);
            if (this.folderIcons) {
              for (const createdDirectory of missing) {
                const group = plan.settings.categories.find(
                  (c) =>
                    path.join(this.desktop, ...categorySegments(c.id, plan.settings.categories)) ===
                    createdDirectory,
                );
                if (group)
                  await this.folderIcons.decorate(
                    createdDirectory,
                    group,
                    plan.settings,
                    async (record) => {
                      batch.metadata.push(record);
                      await this.save(log);
                    },
                  );
              }
            }
          }
          if (entry.action === 'shortcut') {
            if (!this.folderIcons) throw Error('SHORTCUT_UNSUPPORTED');
            const iconName =
              plan.settings.itemIcons[entry.id] ||
              plan.settings.categories.find((c) => c.id === entry.category).icon;
            const icon = await this.folderIcons.iconFile(iconName, plan.settings.iconPack);
            // Reserve the destination exclusively before invoking the native shortcut writer.
            const reservation = await fs.open(entry.target, 'wx');
            await reservation.close();
            await this.folderIcons.shortcut(entry.target, entry.installed, icon);
            journal.checksum = await digest(entry.target);
          } else await fs.copyFile(entry.source, entry.target, constants.COPYFILE_EXCL);
          journal.stage = 'copied';
          await this.save(log);
          if ((await digest(entry.target)) !== journal.checksum)
            throw Error(`COPY_VERIFY: ${entry.id}`);
          await fs.utimes(entry.target, stat.atime, stat.mtime);
          if (plan.mode === 'move' && entry.action !== 'shortcut') {
            const current = await fs.lstat(entry.source);
            if (
              !current.isFile() ||
              current.isSymbolicLink() ||
              fingerprint(current) !== entry.fingerprint ||
              (await digest(entry.source)) !== checksum
            )
              throw Error(`SOURCE_CHANGED: ${entry.id}`);
            await fs.unlink(entry.source);
            journal.stage = 'moved';
            await this.save(log);
          }
          this.onProgress({
            completed: batch.entries.length,
            total: entries.length,
            name: entry.id,
          });
        }
        batch.status = 'completed';
        await this.save(log);
        return batch;
      } catch (error) {
        batch.status = 'interrupted';
        batch.error = error.message;
        await this.save(log);
        throw Error('OPERATION_INTERRUPTED: ' + error.message);
      }
    });
  }
  validateJournal(entry, batch) {
    const relative = path.relative(this.desktop, entry.target);
    const parent = path.dirname(relative);
    const permitted = batch.categoryPaths || folders;
    if (
      !relative ||
      relative.startsWith('..') ||
      path.isAbsolute(relative) ||
      !permitted.includes(parent) ||
      !validId(path.basename(entry.target))
    )
      throw Error('HISTORY_UNSAFE');
    if (
      entry.action !== 'shortcut' &&
      (!validId(entry.id || path.basename(entry.source)) ||
        path.dirname(entry.source) !== this.desktop ||
        path.basename(entry.source) !== path.basename(entry.target))
    )
      throw Error('HISTORY_UNSAFE');
  }
  async undo() {
    return this.exclusive(async () => {
      const log = await this.history();
      const batch = [...log].reverse().find((b) => b.status !== 'undone');
      if (!batch) throw Error('NO_UNDO');
      const pending = [...batch.entries].reverse().filter((e) => !e.undone && e.stage !== 'undone');
      // Validate all entries before undoing the first one.
      for (const entry of pending) {
        this.validateJournal(entry, batch);
        await this.safeDirectory(path.dirname(entry.target), false, batch.categoryPaths || folders);
        const target = await exists(entry.target);
        if (entry.stage === 'planned') {
          if (target) throw Error(`UNCERTAIN_TARGET: ${path.basename(entry.target)}`);
          continue;
        }
        if (entry.stage === 'deleting' && batch.mode === 'move' && entry.action !== 'shortcut') {
          const restored = await exists(entry.source);
          if (
            !restored?.isFile() ||
            restored.isSymbolicLink() ||
            (entry.checksum && (await digest(entry.source)) !== entry.checksum)
          )
            throw Error('RESTORE_CHANGED');
        }
        if (!target && entry.stage === 'deleting') continue;
        if (!target?.isFile() || target.isSymbolicLink()) throw Error('TARGET_MISSING');
        if (
          entry.checksum
            ? (await digest(entry.target)) !== entry.checksum
            : target.size !== entry.size || target.mtimeMs !== entry.mtime
        )
          throw Error('TARGET_CHANGED');
        const source = await exists(entry.source);
        if (
          batch.mode === 'move' &&
          entry.action !== 'shortcut' &&
          entry.stage === 'copied' &&
          source &&
          (!source.isFile() ||
            source.isSymbolicLink() ||
            (await digest(entry.source)) !== entry.checksum)
        )
          throw Error('SOURCE_CHANGED_RETAINED');
        const needsRestore =
          batch.mode === 'move' &&
          entry.action !== 'shortcut' &&
          (entry.stage === 'moved' ||
            entry.removed ||
            !source ||
            ['restoring', 'restored'].includes(entry.stage));
        if (needsRestore && source) {
          if (
            !['restoring', 'restored'].includes(entry.stage) ||
            !source.isFile() ||
            source.isSymbolicLink() ||
            (await digest(entry.source)) !== entry.checksum
          )
            throw Error('SOURCE_EXISTS');
        }
      }
      batch.status = 'undoing';
      await this.save(log);
      for (const entry of pending) {
        if (entry.stage === 'planned') {
          entry.stage = 'undone';
          await this.save(log);
          continue;
        }
        const source = await exists(entry.source);
        if (
          batch.mode === 'move' &&
          entry.action !== 'shortcut' &&
          (entry.stage === 'moved' ||
            entry.removed ||
            !source ||
            ['restoring', 'restored'].includes(entry.stage))
        ) {
          if (!source) {
            entry.stage = 'restoring';
            await this.save(log);
            await fs.copyFile(entry.target, entry.source, constants.COPYFILE_EXCL);
            if (Number.isFinite(entry.modified))
              await fs.utimes(entry.source, new Date(entry.modified), new Date(entry.modified));
          }
          entry.stage = 'restored';
          await this.save(log);
        }
        const currentTarget = await exists(entry.target);
        if (
          currentTarget &&
          (!currentTarget.isFile() ||
            currentTarget.isSymbolicLink() ||
            (entry.checksum && (await digest(entry.target)) !== entry.checksum))
        )
          throw Error('TARGET_CHANGED');
        if (
          batch.mode === 'move' &&
          entry.action !== 'shortcut' &&
          entry.checksum &&
          (await digest(entry.source)) !== entry.checksum
        )
          throw Error('RESTORE_VERIFY');
        entry.stage = 'deleting';
        await this.save(log);
        try {
          await fs.unlink(entry.target);
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
        entry.stage = 'undone';
        entry.undone = true;
        await this.save(log);
      }
      for (const meta of batch.metadata || []) {
        const parent = path.dirname(meta.path);
        if (
          !batch.directories.includes(parent) ||
          !['desktop.ini', '.darkdesk.ico'].includes(path.basename(meta.path))
        )
          throw Error('TARGET_INVALID');
        await this.safeDirectory(parent, false, batch.categoryPaths || folders);
        const stat = await exists(meta.path);
        if (stat?.isFile() && !stat.isSymbolicLink() && (await digest(meta.path)) === meta.checksum)
          await fs.unlink(meta.path);
      }
      for (const directory of [...(batch.directories || [])].sort((a, b) => b.length - a.length)) {
        await this.safeDirectory(directory, false, batch.categoryPaths || folders);
        await this.folderIcons?.removeAttributes(directory);
        try {
          await fs.rmdir(directory);
        } catch (e) {
          if (!['ENOTEMPTY', 'ENOENT', 'EEXIST'].includes(e.code)) throw e;
        }
      }
      batch.status = 'undone';
      batch.undoneAt = new Date().toISOString();
      await this.save(log);
      return batch;
    });
  }
}
module.exports = { DesktopService, folders, category, digest };
