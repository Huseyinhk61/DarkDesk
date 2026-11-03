const fs = require('node:fs/promises');
const { createReadStream, constants } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const folders = [
  'Yazılım & Geliştirme',
  'Video & Tasarım',
  'Oyunlar',
  'Ofis & Dokümanlar',
  'Araçlar & Sistem',
];
const shortcutExtensions = new Set(['.lnk', '.url', '.desktop', '.webloc']);
function category(name, target = '') {
  const text = `${name} ${target}`;
  if (
    /figma|adobe|photoshop|premiere|blender|after effects|davinci|\.(jpe?g|png|svg|mp4|mov|psd|ai|webp|gif|wav|mp3)$/i.test(
      name,
    ) ||
    /figma|photoshop|premiere|blender/i.test(target)
  )
    return 1;
  if (/steam|epic|game|oyun|valorant|discord|minecraft/i.test(text)) return 2;
  if (
    /code|visual studio|android studio|git|docker|python|node|terminal|\.(jsx?|tsx?|py|json|html|css|go|rs|sql|sh)$/i.test(
      name,
    ) ||
    /code|visual studio|docker|python/i.test(target)
  )
    return 0;
  if (/word|excel|notion|office|obsidian|\.(docx?|xlsx?|pptx?|pdf|txt|csv|md)$/i.test(name))
    return 3;
  return 4;
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
  }
  async exclusive(action) {
    if (this.busy) throw Error('Bir dosya işlemi sürüyor. Tamamlanmasını bekleyin.');
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
      if (!Array.isArray(log)) throw Error('Geçersiz geçmiş biçimi.');
      return log;
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw Error('İşlem geçmişi okunamadı; dosyalar değiştirilmedi. ' + e.message);
    }
  }
  async save(log) {
    await fs.mkdir(path.dirname(this.log), { recursive: true });
    await fs.writeFile(this.log + '.tmp', JSON.stringify(log, null, 2), { mode: 0o600 });
    await fs.rename(this.log + '.tmp', this.log);
  }
  async scan(settings = {}) {
    const ignored = new Set(settings.excludedExtensions || ['.ini', '.tmp']);
    let entries;
    try {
      entries = await fs.readdir(this.desktop, { withFileTypes: true });
    } catch (e) {
      throw Error(
        'Masaüstü dizini okunamadı. OneDrive/masaüstü konumunu ve erişim iznini kontrol edin. ' +
          e.message,
      );
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
          category: Number.isInteger(override) ? override : category(entry.name, target),
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
  async safeDirectory(directory, create = false) {
    if (path.dirname(directory) !== this.desktop || !folders.includes(path.basename(directory)))
      throw Error('Geçersiz hedef klasör.');
    let created = false;
    if (create) {
      try {
        await fs.mkdir(directory);
        created = true;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
    }
    const stat = await exists(directory);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
      throw Error('Hedef klasör sembolik bağlantı veya geçersiz bir dosya.');
    return created;
  }
  async preview(items, mode) {
    if (
      !['move', 'copy'].includes(mode) ||
      !Array.isArray(items) ||
      !items.length ||
      items.length > 5000
    )
      throw Error('Düzenlemek için 1–5000 öğe seçin.');
    if (new Set(items.map((i) => i?.id)).size !== items.length) throw Error('Yinelenen dosya.');
    const entries = [];
    for (const item of items) {
      if (!validId(item?.id) || !Number.isInteger(item.category) || !folders[item.category])
        throw Error('Geçersiz dosya veya kategori.');
      const source = path.join(this.desktop, item.id);
      const target = path.join(this.desktop, folders[item.category], item.id);
      const stat = await exists(source);
      if (!stat?.isFile() || stat.isSymbolicLink())
        throw Error(
          `${item.id}: Dosya artık mevcut değil veya güvenli bir normal dosya değil. Yeniden tarayın.`,
        );
      let conflict = '';
      try {
        await this.safeDirectory(path.dirname(target));
        if (await exists(target)) conflict = 'Hedefte aynı isimde bir dosya var.';
      } catch (e) {
        conflict = e.message;
      }
      entries.push({
        id: item.id,
        category: item.category,
        source,
        target,
        size: stat.size,
        modified: stat.mtimeMs,
        fingerprint: fingerprint(stat),
        conflict,
      });
    }
    // Only the main process retains trusted paths and fingerprints.
    this.previews.clear();
    const token = crypto.randomUUID();
    this.previews.set(token, { entries, mode, expires: Date.now() + 5 * 60_000 });
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
      if (!plan || plan.expires < Date.now())
        throw Error('Önizleme süresi dolmuş. Düzenlemeyi yeniden önizleyin.');
      const entries = plan.entries.filter((e) => !e.conflict);
      if (!entries.length) throw Error('Çakışmasız dosya bulunamadı.');
      // Preflight every selected source before changing any files.
      for (const entry of entries) {
        const stat = await exists(entry.source);
        if (!stat?.isFile() || stat.isSymbolicLink() || fingerprint(stat) !== entry.fingerprint)
          throw Error(`${entry.id}: Önizlemeden sonra dosya değişti. Yeniden tarayın.`);
        await this.safeDirectory(path.dirname(entry.target));
        if (await exists(entry.target))
          throw Error(`${entry.id}: Hedefte yeni bir dosya oluştu. Önizlemeyi yenileyin.`);
      }
      const log = await this.history();
      const batch = {
        version: 2,
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        mode: plan.mode,
        status: 'running',
        entries: [],
        directories: [],
        skipped: plan.entries.filter((e) => e.conflict).map((e) => e.id),
      };
      log.push(batch);
      await this.save(log);
      try {
        for (const entry of entries) {
          const stat = await fs.lstat(entry.source);
          if (!stat.isFile() || stat.isSymbolicLink() || fingerprint(stat) !== entry.fingerprint)
            throw Error(`${entry.id}: Kaynak dosya değişti.`);
          const checksum = await digest(entry.source);
          const journal = { ...entry, checksum, stage: 'planned' };
          batch.entries.push(journal);
          await this.save(log); // Record intention before creating a file or removing a source.
          const directory = path.dirname(entry.target);
          if (await this.safeDirectory(directory, true)) {
            batch.directories.push(directory);
            await this.save(log);
          }
          await fs.copyFile(entry.source, entry.target, constants.COPYFILE_EXCL);
          journal.stage = 'copied';
          await this.save(log);
          if ((await digest(entry.target)) !== checksum)
            throw Error(`${entry.id}: Kopya doğrulanamadı. Kaynak korunuyor.`);
          await fs.utimes(entry.target, stat.atime, stat.mtime);
          if (plan.mode === 'move') {
            const current = await fs.lstat(entry.source);
            if (
              !current.isFile() ||
              current.isSymbolicLink() ||
              fingerprint(current) !== entry.fingerprint ||
              (await digest(entry.source)) !== checksum
            )
              throw Error(`${entry.id}: Kopyalama sırasında kaynak değişti. Kaynak korunuyor.`);
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
        throw Error(
          'Düzenleme durdu: ' +
            error.message +
            ' Geçmişten tamamlanan adımları geri alabilirsiniz.',
        );
      }
    });
  }
  validateJournal(entry) {
    if (
      !validId(entry.id || path.basename(entry.source)) ||
      path.dirname(entry.source) !== this.desktop ||
      path.basename(entry.source) !== path.basename(entry.target) ||
      !folders.some((folder) => path.dirname(entry.target) === path.join(this.desktop, folder))
    )
      throw Error('Geçmişte güvenli olmayan dosya yolu var. İşlem durduruldu.');
  }
  async undo() {
    return this.exclusive(async () => {
      const log = await this.history();
      const batch = [...log].reverse().find((b) => b.status !== 'undone');
      if (!batch) throw Error('Geri alınacak işlem yok.');
      const pending = [...batch.entries].reverse().filter((e) => !e.undone && e.stage !== 'undone');
      // Validate all entries before undoing the first one.
      for (const entry of pending) {
        this.validateJournal(entry);
        await this.safeDirectory(path.dirname(entry.target));
        const target = await exists(entry.target);
        if (entry.stage === 'planned') {
          if (target)
            throw Error(
              `${path.basename(entry.target)}: Kesinti sonrası hedefin sahipliği belirsiz. Kaynak ve hedefi elle kontrol edin.`,
            );
          continue;
        }
        if (entry.stage === 'deleting' && batch.mode === 'move') {
          const restored = await exists(entry.source);
          if (
            !restored?.isFile() ||
            restored.isSymbolicLink() ||
            (entry.checksum && (await digest(entry.source)) !== entry.checksum)
          )
            throw Error('Geri yüklenen kaynak değişmiş veya kayıp. Hedef korunuyor.');
        }
        if (!target && entry.stage === 'deleting') continue;
        if (!target?.isFile() || target.isSymbolicLink())
          throw Error('Hedef dosya bulunamadı veya değişti; geri alma durduruldu.');
        if (
          entry.checksum
            ? (await digest(entry.target)) !== entry.checksum
            : target.size !== entry.size || target.mtimeMs !== entry.mtime
        )
          throw Error('Hedef dosyanın içeriği değişmiş; geri alma durduruldu.');
        const source = await exists(entry.source);
        if (
          batch.mode === 'move' &&
          entry.stage === 'copied' &&
          source &&
          (!source.isFile() ||
            source.isSymbolicLink() ||
            (await digest(entry.source)) !== entry.checksum)
        )
          throw Error('Kaynak değişmiş; kurtarma kopyası korunuyor.');
        const needsRestore =
          batch.mode === 'move' &&
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
            throw Error('Orijinal konumda başka bir dosya var; üzerine yazılmadı.');
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
          throw Error('Geri alma sırasında hedef değişti. Dosya korunuyor.');
        if (
          batch.mode === 'move' &&
          entry.checksum &&
          (await digest(entry.source)) !== entry.checksum
        )
          throw Error('Geri yüklenen kaynak doğrulanamadı. Hedef korunuyor.');
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
      for (const directory of batch.directories || []) {
        await this.safeDirectory(directory);
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
