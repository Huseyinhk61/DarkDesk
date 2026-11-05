const fs = require('node:fs/promises');
const { createReadStream, constants } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readInternetShortcut } = require('./internet-shortcut.cjs');
const {
  defaultCategories,
  defaultSettings,
  categorySegments,
  categoryId,
  classify,
  defaultCategory,
  enrichItem,
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
    this.downloads = options.downloads ? path.resolve(options.downloads) : null;
    this.externalCatalog = new Map();
    this.folderIcons = options.folderIcons;
    this.platform = options.platform || process.platform;
    this.sharedDesktop = options.sharedDesktop ? path.resolve(options.sharedDesktop) : null;
    if (this.sharedDesktop && this.samePath(this.sharedDesktop, this.desktop))
      this.sharedDesktop = null;
    this.sharedCatalog = new Map();
    this.scanReport = {
      sources: [],
      excluded: { folders: 0, hidden: 0, extensions: 0 },
      warnings: [],
      total: 0,
    };
    this.preserveTimestamp =
      options.preserveTimestamp || ((file, atime, mtime) => fs.utimes(file, atime, mtime));
    this.removeSource = options.removeSource || ((file) => fs.unlink(file));
  }
  samePath(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') return false;
    const normalize = (value) => {
      const resolved = path.resolve(value);
      return this.platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    return normalize(left) === normalize(right);
  }
  sharedId(source) {
    const canonical =
      this.platform === 'win32' ? path.resolve(source).toLowerCase() : path.resolve(source);
    return 'shared:' + crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24);
  }
  async assertSharedSource(source) {
    if (
      !this.sharedDesktop ||
      (source &&
        (!this.samePath(path.dirname(source), this.sharedDesktop) ||
          !validId(path.basename(source))))
    )
      throw Error('SHARED_DESKTOP_ACCESS');
    const parsed = path.parse(this.sharedDesktop);
    let current = parsed.root;
    for (const part of this.sharedDesktop
      .slice(parsed.root.length)
      .split(path.sep)
      .filter(Boolean)) {
      current = path.join(current, part);
      const stat = await fs.lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw Object.assign(Error('SHARED_DESKTOP_ACCESS'), { code: 'SOURCE_UNSAFE' });
    }
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
    const ignored = new Set([...(settings.excludedExtensions || []), '.ini', '.dll', '.sys']);
    const report = {
      sources: [],
      excluded: { folders: 0, hidden: 0, extensions: 0 },
      warnings: [],
      total: 0,
    };
    const result = [],
      sharedCatalog = new Map();
    for (const root of [
      { path: this.desktop, scope: 'desktop' },
      ...(this.sharedDesktop ? [{ path: this.sharedDesktop, scope: 'shared' }] : []),
    ]) {
      const sourceReport = { ...root, status: 'ready', count: 0 };
      report.sources.push(sourceReport);
      let entries;
      try {
        if (root.scope === 'shared') await this.assertSharedSource();
        entries = await fs.readdir(root.path, { withFileTypes: true });
      } catch (error) {
        if (root.scope === 'desktop') throw Error('DESKTOP_READ: ' + (error.code || ''));
        sourceReport.status =
          error.code === 'ENOENT'
            ? 'missing'
            : ['EPERM', 'EACCES'].includes(error.code)
              ? 'denied'
              : 'error';
        report.warnings.push({ code: 'SHARED_DESKTOP_ACCESS', scope: root.scope });
        continue;
      }
      // Sequential metadata reads keep large desktops within the handle limit.
      for (const entry of entries) {
        const extension = path.extname(entry.name).toLowerCase();
        if (entry.name.startsWith('.')) {
          report.excluded.hidden++;
          continue;
        }
        if (entry.isDirectory()) {
          report.excluded.folders++;
          continue;
        }
        if (!entry.isFile()) continue;
        if (ignored.has(extension)) {
          report.excluded.extensions++;
          continue;
        }
        const source = path.join(root.path, entry.name);
        try {
          const stat = await fs.lstat(source);
          if (!stat.isFile() || stat.isSymbolicLink()) continue;
          let target = '',
            launchUrl = '';
          if (extension === '.lnk' && this.resolveShortcut) {
            try {
              target = (await this.resolveShortcut(source))?.target || '';
            } catch {}
          }
          if (extension === '.url') {
            try {
              launchUrl = (await readInternetShortcut(source)).launchUrl || '';
            } catch {}
          }
          const item = enrichItem(
            {
              id: root.scope === 'shared' ? this.sharedId(source) : entry.name,
              name: entry.name,
              source,
              target,
              launchUrl,
              sourceScope: root.scope,
              shared: root.scope === 'shared',
              scope: 'desktop',
              size: stat.size,
              modified: stat.mtimeMs,
              kind: shortcutExtensions.has(extension) ? 'shortcut' : 'file',
              extension,
            },
            settings,
          );
          if (item.shared) sharedCatalog.set(item.id, item);
          result.push(item);
          sourceReport.count++;
        } catch (error) {
          if (error.code !== 'ENOENT')
            report.warnings.push({
              code: 'DESKTOP_ITEM_ACCESS',
              scope: root.scope,
              name: entry.name,
            });
        }
      }
    }
    report.total = result.length;
    this.scanReport = report;
    this.sharedCatalog = sharedCatalog;
    return result.sort((a, b) => a.name.localeCompare(b.name, settings.language || 'tr'));
  }

  async registerPaths(paths) {
    if (!Array.isArray(paths) || paths.length > 500) throw Error('DROP_INVALID');
    const results = [];
    for (const file of paths) {
      if (typeof file !== 'string') throw Error('DROP_INVALID');
      const source = path.resolve(file);
      if (
        this.samePath(path.dirname(source), this.desktop) ||
        (this.sharedDesktop && this.samePath(path.dirname(source), this.sharedDesktop))
      ) {
        const name = path.basename(source);
        if (!validId(name)) throw Error('DROP_INVALID');
        const item = (await this.scan()).find((i) => this.samePath(i.source, source));
        if (!item) throw Error('SOURCE_MISSING');
        results.push(item);
        continue;
      }
      if (!this.downloads || path.dirname(source) !== this.downloads) throw Error('DROP_INVALID');
      const stat = await fs.lstat(source);
      if (!stat.isFile() || stat.isSymbolicLink() || !validId(path.basename(source)))
        throw Error('DROP_INVALID');
      const name = path.basename(source),
        id = 'download:' + crypto.createHash('sha256').update(source).digest('hex').slice(0, 24);
      const item = enrichItem(
        {
          id,
          name,
          source,
          scope: 'downloads',
          kind: 'file',
          size: stat.size,
          modified: stat.mtimeMs,
          extension: path.extname(name).toLowerCase(),
        },
        this.settings,
      );
      this.externalCatalog.set(id, item);
      results.push(item);
    }
    return results;
  }
  async scanDownloads() {
    if (!this.downloads) return [];
    let entries;
    try {
      entries = await fs.readdir(this.downloads, { withFileTypes: true });
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
    const paths = entries
      .filter(
        (e) =>
          e.isFile() &&
          !e.name.startsWith('.') &&
          !/\.(crdownload|part|download|tmp|dll|sys|ini)$/i.test(e.name) &&
          !this.settings.excludedExtensions.includes(path.extname(e.name).toLowerCase()),
      )
      .map((e) => path.join(this.downloads, e.name));
    const result = [];
    for (let i = 0; i < paths.length; i += 500)
      result.push(...(await this.registerPaths(paths.slice(i, i + 500))));
    return result;
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
          (typeof item?.id === 'string' &&
            (this.scanner?.catalog.has(item.id) ||
              this.externalCatalog.has(item.id) ||
              this.sharedCatalog.has(item.id)))
        ) ||
        !this.settings.categories.some((c) => c.id === categoryId(item.category))
      )
        throw Error('CATEGORY_INVALID');
      const installed = this.scanner?.catalog.get(item.id);
      const shared = this.sharedCatalog.get(item.id);
      if (shared) await this.assertSharedSource(shared.source);
      const external = shared || this.externalCatalog.get(item.id);
      const source = installed
        ? installed.source
        : external
          ? external.source
          : path.join(this.desktop, item.id);
      const cid = categoryId(item.category);
      const segments = categorySegments(cid, this.settings.categories);
      const targetName = installed
        ? path.basename(installed.name, path.extname(installed.name)) +
          (this.platform === 'win32'
            ? path.extname(installed.source).toLowerCase() === '.url'
              ? '.url'
              : '.lnk'
            : '.desktop')
        : external
          ? external.name
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
        name: installed?.name || external?.name || item.id,
        sourceScope: shared ? 'shared' : external ? 'downloads' : 'desktop',
        shared: !!shared,
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
  async rebaseVisibility(token, restore) {
    const plan = this.previews.get(token);
    if (!plan || plan.expires < Date.now()) throw Error('PREVIEW_EXPIRED');
    const snapshots = [];
    for (const entry of plan.entries.filter(
      (e) => !e.conflict && path.dirname(e.source) === this.desktop,
    )) {
      const stat = await fs.lstat(entry.source);
      if (!stat.isFile() || stat.isSymbolicLink() || fingerprint(stat) !== entry.fingerprint)
        throw Error('SOURCE_CHANGED');
      snapshots.push({
        entry,
        stable: `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}`,
        checksum: await digest(entry.source),
      });
    }
    await restore();
    for (const snapshot of snapshots) {
      const stat = await fs.lstat(snapshot.entry.source);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}` !== snapshot.stable ||
        (await digest(snapshot.entry.source)) !== snapshot.checksum
      )
        throw Error('SOURCE_CHANGED');
      snapshot.entry.fingerprint = fingerprint(stat);
    }
  }
  async organize(token, origin = 'manual') {
    return this.exclusive(async () => {
      const plan = this.previews.get(token);
      this.previews.delete(token);
      if (!plan || plan.expires < Date.now()) throw Error('PREVIEW_EXPIRED');
      const entries = plan.entries.filter((e) => !e.conflict);
      if (origin !== 'manual' && entries.some((entry) => entry.sourceScope === 'shared'))
        throw Error('SHARED_DESKTOP_MANUAL_ONLY');
      if (!entries.length) throw Error('NO_READY');
      // Preflight every selected source before changing any files.
      for (const entry of entries) {
        if (entry.sourceScope === 'shared') await this.assertSharedSource(entry.source);
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
        version: 4,
        origin,
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        mode: plan.mode,
        status: 'running',
        entries: [],
        directories: [],
        metadata: [],
        categoryPaths: entries.map((e) => e.categoryPath),
        skipped: plan.entries.filter((e) => e.conflict).map((e) => e.id),
        skippedDetails: plan.entries
          .filter((e) => e.conflict)
          .map((e) => ({ id: e.id, code: e.conflict, target: e.target })),
        warnings: [],
        outputDirectories: [],
        summary: {
          moved: 0,
          copied: 0,
          shortcuts: 0,
          skipped: plan.entries.filter((e) => e.conflict).length,
          failed: 0,
          pending: entries.length,
        },
      };
      const summarize = () => {
        batch.outputDirectories = [
          ...new Set(
            batch.entries
              .filter((e) => e.verified === true && ['copied', 'moved'].includes(e.stage))
              .map((e) => path.dirname(e.target)),
          ),
        ];
        batch.summary = {
          moved: batch.entries.filter((e) => e.verified === true && e.stage === 'moved').length,
          copied: batch.entries.filter(
            (e) => e.verified === true && e.stage === 'copied' && e.action !== 'shortcut',
          ).length,
          shortcuts: batch.entries.filter(
            (e) => e.verified === true && e.stage === 'copied' && e.action === 'shortcut',
          ).length,
          skipped: batch.skipped.length,
          failed: Math.max(batch.entries.filter((e) => e.error).length, batch.error ? 1 : 0),
          pending:
            entries.length -
            batch.entries.filter(
              (e) => e.verified === true && ['copied', 'moved'].includes(e.stage),
            ).length,
        };
      };
      log.push(batch);
      await this.save(log);
      let currentJournal = null;
      try {
        for (const entry of entries) {
          try {
            const stat = await fs.lstat(entry.source);
            if (!stat.isFile() || stat.isSymbolicLink() || fingerprint(stat) !== entry.fingerprint)
              throw Error(`SOURCE_CHANGED: ${entry.id}`);
            const checksum = entry.action === 'shortcut' ? null : await digest(entry.source);
            const journal = { ...entry, checksum, stage: 'planned', verified: false };
            currentJournal = journal;
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
                      path.join(
                        this.desktop,
                        ...categorySegments(c.id, plan.settings.categories),
                      ) === createdDirectory,
                  );
                  if (group) {
                    let journalFailure = null;
                    try {
                      await this.folderIcons.decorate(
                        createdDirectory,
                        group,
                        plan.settings,
                        async (record) => {
                          batch.metadata.push(record);
                          try {
                            await this.save(log);
                          } catch (error) {
                            journalFailure = error;
                            throw error;
                          }
                        },
                      );
                    } catch (error) {
                      // Visual folder decoration is optional. A journal failure is not.
                      if (journalFailure) throw journalFailure;
                      batch.warnings.push({
                        code: 'FOLDER_ICON_FAILED',
                        id: entry.id,
                        path: createdDirectory,
                        detail: error.code || error.message,
                      });
                      await this.save(log);
                    }
                  }
                }
              }
            }
            if (entry.action === 'shortcut') {
              if (!this.folderIcons) throw Error('SHORTCUT_UNSUPPORTED');
              const customIcon = plan.settings.itemIcons[entry.id];
              let icon;
              // Preserve the application's own logo unless the user explicitly overrides it.
              if (customIcon || this.platform !== 'win32') {
                const iconName =
                  customIcon || plan.settings.categories.find((c) => c.id === entry.category).icon;
                try {
                  icon = await this.folderIcons.iconFile(iconName, plan.settings.iconPack);
                } catch (error) {
                  batch.warnings.push({
                    code: 'SHORTCUT_ICON_FALLBACK',
                    id: entry.id,
                    path: entry.target,
                    detail: error.code || error.message,
                  });
                  await this.save(log);
                }
              }
              // Reserve the destination exclusively before invoking the native shortcut writer.
              const reservation = await fs.open(entry.target, 'wx');
              await reservation.close();
              await this.folderIcons.shortcut(entry.target, entry.installed, icon);
              journal.checksum = await digest(entry.target);
            } else {
              try {
                await fs.copyFile(entry.source, entry.target, constants.COPYFILE_EXCL);
              } catch (error) {
                if (entry.shared && ['EPERM', 'EACCES'].includes(error.code))
                  throw Object.assign(Error('SHARED_DESKTOP_ACCESS'), {
                    code: 'SHARED_DESKTOP_ACCESS',
                  });
                throw error;
              }
            }
            journal.stage = 'copied';
            await this.save(log);
            if ((await digest(entry.target)) !== journal.checksum)
              throw Error(`COPY_VERIFY: ${entry.id}`);
            journal.verified = true;
            await this.save(log);
            try {
              await this.preserveTimestamp(entry.target, stat.atime, stat.mtime);
            } catch (error) {
              batch.warnings.push({
                code: 'TIMESTAMP_NOT_PRESERVED',
                id: entry.id,
                path: entry.target,
                detail: error.code || error.message,
              });
              await this.save(log);
            }
            if (plan.mode === 'move' && entry.action !== 'shortcut') {
              const current = await fs.lstat(entry.source);
              if (
                !current.isFile() ||
                current.isSymbolicLink() ||
                fingerprint(current) !== entry.fingerprint ||
                (await digest(entry.source)) !== checksum
              )
                throw Error(`SOURCE_CHANGED: ${entry.id}`);
              try {
                await this.removeSource(entry.source);
              } catch (error) {
                if (entry.shared && ['EPERM', 'EACCES'].includes(error.code))
                  throw Object.assign(Error('SHARED_DESKTOP_ACCESS'), {
                    code: 'SHARED_DESKTOP_ACCESS',
                  });
                throw Error(`SOURCE_REMOVE_FAILED: ${entry.id}: ${error.code || error.message}`);
              }
              journal.stage = 'moved';
              await this.save(log);
            }
            summarize();
            currentJournal = null;
            this.onProgress({
              completed: batch.entries.length,
              total: entries.length,
              name: entry.id,
            });
          } catch (error) {
            if (error.code !== 'SHARED_DESKTOP_ACCESS') throw error;
            if (currentJournal) currentJournal.error = 'SHARED_DESKTOP_ACCESS';
            batch.error = 'SHARED_DESKTOP_ACCESS';
            summarize();
            await this.save(log);
            currentJournal = null;
          }
        }
        if (batch.error) throw Error(batch.error);

        batch.status = 'completed';
        summarize();
        await this.save(log);
        return batch;
      } catch (error) {
        if (currentJournal) currentJournal.error = error.message;
        batch.status = 'interrupted';
        batch.error = error.message;
        summarize();
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
      (!validId(path.basename(entry.source)) ||
        path.dirname(entry.source) !==
          (entry.sourceScope === 'shared'
            ? this.sharedDesktop
            : entry.sourceScope === 'downloads'
              ? this.downloads
              : this.desktop) ||
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
        if (entry.sourceScope === 'shared') await this.assertSharedSource(entry.source);
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
            if (Number.isFinite(entry.modified)) {
              try {
                await this.preserveTimestamp(
                  entry.source,
                  new Date(entry.modified),
                  new Date(entry.modified),
                );
              } catch (error) {
                (batch.warnings ||= []).push({
                  code: 'TIMESTAMP_NOT_PRESERVED',
                  id: entry.id,
                  path: entry.source,
                  detail: error.code || error.message,
                });
              }
            }
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
        if (
          stat?.isFile() &&
          !stat.isSymbolicLink() &&
          (await digest(meta.path)) === meta.checksum
        ) {
          try {
            await fs.unlink(meta.path);
          } catch (error) {
            if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
            (batch.warnings ||= []).push({
              code: 'FOLDER_ICON_FAILED',
              path: meta.path,
              detail: error.code,
            });
          }
        }
      }
      for (const directory of [...(batch.directories || [])].sort((a, b) => b.length - a.length)) {
        await this.safeDirectory(directory, false, batch.categoryPaths || folders);
        // Later appearance choices or user files keep this folder alive. Do
        // not clear Explorer's icon attributes unless it can actually be removed.
        const remaining = await fs.readdir(directory).catch((error) => {
          if (error.code === 'ENOENT') return [];
          throw error;
        });
        if (remaining.length) continue;
        try {
          await this.folderIcons?.removeAttributes(directory);
        } catch (error) {
          (batch.warnings ||= []).push({
            code: 'FOLDER_ICON_FAILED',
            path: directory,
            detail: error.code || error.message,
          });
        }
        try {
          await fs.rmdir(directory);
        } catch (e) {
          if (['EPERM', 'EACCES'].includes(e.code))
            (batch.warnings ||= []).push({
              code: 'FOLDER_ICON_FAILED',
              path: directory,
              detail: e.code,
            });
          else if (!['ENOTEMPTY', 'ENOENT', 'EEXIST'].includes(e.code)) throw e;
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
