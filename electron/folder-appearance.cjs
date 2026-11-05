const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { categorySegments } = require('../shared/domain.js');
const { validateSettings } = require('./settings.cjs');
const { JsonStore } = require('./runtime/json-store.cjs');

const names = ['.darkdesk.ico', 'desktop.ini'];
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const coded = (code) => Object.assign(Error(code), { code });
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

async function snapshot(file, limit = 1024 * 1024) {
  let before;
  try {
    before = await fs.lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!before.isFile() || before.isSymbolicLink() || before.size > limit)
    throw coded('FOLDER_CUSTOMIZED');
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino)
      throw coded('FOLDER_CHANGED');
    const buffer = Buffer.alloc(limit + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const result = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    if (offset > limit) throw coded('FOLDER_CUSTOMIZED');
    const bytes = buffer.subarray(0, offset);
    return { bytes, checksum: hash(bytes) };
  } finally {
    await handle.close();
  }
}

async function replace(service, directory, name, contents, previous) {
  await service.safeDirectory(directory);
  const destination = path.join(directory, name);
  const temporary = path.join(directory, '.darkdesk-style-' + crypto.randomUUID() + '.tmp');
  let created = false;
  try {
    const handle = await fs.open(temporary, 'wx', 0o600);
    created = true;
    let writeFailure;
    try {
      await handle.writeFile(contents);
      await handle.sync();
    } catch (error) {
      writeFailure = error;
      throw error;
    } finally {
      try {
        await handle.close();
      } catch (error) {
        if (!writeFailure) throw error;
      }
    }
    await service.safeDirectory(directory);
    const current = await snapshot(destination);
    if ((current?.checksum || null) !== (previous?.checksum || null)) throw coded('FOLDER_CHANGED');
    if (previous) {
      await service.folderIcons.clearFileAttributes(destination);
      const checked = await snapshot(destination);
      if (checked?.checksum !== previous.checksum) throw coded('FOLDER_CHANGED');
      await service.safeDirectory(directory);
      await fs.rename(temporary, destination);
    } else {
      // Publishing a new file by an exclusive hard link cannot overwrite a file
      // another application created after the preceding check.
      try {
        await fs.link(temporary, destination);
      } catch (error) {
        if (error.code === 'EEXIST') throw coded('FOLDER_CHANGED');
        if (!['ENOTSUP', 'EOPNOTSUPP', 'EXDEV', 'EPERM', 'EINVAL', 'ENOSYS'].includes(error.code))
          throw error;
        // Some redirected/cloud-backed desktops do not support hard links.
        // Exclusive copying preserves the no-overwrite guarantee there.
        try {
          await fs.copyFile(temporary, destination, constants.COPYFILE_EXCL);
        } catch (copyError) {
          if (copyError.code === 'EEXIST') throw coded('FOLDER_CHANGED');
          throw copyError;
        }
      }
    }
  } finally {
    if (created) await fs.unlink(temporary).catch(() => {});
  }
}

async function readManifest(file) {
  const contents = await snapshot(file, 8 * 1024 * 1024);
  if (!contents) return { version: 1, folders: {} };
  try {
    const value = JSON.parse(contents.bytes.toString('utf8'));
    if (
      value.version !== 1 ||
      !value.folders ||
      typeof value.folders !== 'object' ||
      Array.isArray(value.folders)
    )
      throw Error();
    return value;
  } catch {
    throw coded('FOLDER_OWNERSHIP_READ');
  }
}

function historicalOwnership(history, directory) {
  const result = Object.fromEntries(names.map((name) => [name, new Set()]));
  for (const batch of history) {
    if (batch.status === 'undone' || !batch.directories?.includes(directory)) continue;
    for (const record of batch.metadata || []) {
      const name = path.basename(record.path || '');
      if (
        names.includes(name) &&
        path.dirname(record.path) === directory &&
        isHash(record.checksum)
      )
        result[name].add(record.checksum);
    }
  }
  return result;
}

async function applyFolderAppearance(service, input) {
  const settings = validateSettings(input);
  const result = { updated: 0, unchanged: 0, skipped: 0, failed: 0, details: [] };
  if (service.platform !== 'win32' || !service.folderIcons) {
    return {
      ...result,
      unsupported: true,
      skipped: settings.categories.length,
      details: settings.categories.map((category) => ({
        categoryId: category.id,
        status: 'skipped',
        code: 'FOLDER_PLATFORM_UNSUPPORTED',
      })),
    };
  }
  return service.exclusive(async () => {
    service.settings = settings;
    const data = path.dirname(service.log),
      file = path.join(data, 'folder-appearance.json');
    const manifest = await readManifest(file),
      store = new JsonStore(file, { version: 1, folders: {} });
    const history = await service.history(),
      changed = [];
    for (const category of settings.categories) {
      const directory = path.join(
        service.desktop,
        ...categorySegments(category.id, settings.categories),
      );
      const key = path.resolve(directory).toLowerCase();
      let ownershipVerified = false,
        previous,
        desired,
        written = [];
      try {
        await service.safeDirectory(directory);
        const stat = await fs.lstat(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded('FOLDER_UNSAFE');
        previous = Object.fromEntries(
          await Promise.all(
            names.map(async (name) => [name, await snapshot(path.join(directory, name))]),
          ),
        );
        const owned = historicalOwnership(history, directory),
          record = manifest.folders[key];
        for (const name of names) {
          for (const candidate of [
            record?.files?.[name],
            record?.pending?.previous?.[name],
            record?.pending?.desired?.[name],
          ])
            if (isHash(candidate)) owned[name].add(candidate);
          if (previous[name] && !owned[name].has(previous[name].checksum))
            throw coded('FOLDER_CUSTOMIZED');
        }
        ownershipVerified = true;
        desired = await service.folderIcons.folderContents(category, settings);
        if (names.every((name) => previous[name]?.checksum === hash(desired[name]))) {
          // A previous interruption can leave completed bytes without Explorer
          // attributes. Explicit application repairs those flags even when the
          // image content itself is already correct.
          await service.folderIcons.applyAttributes(directory);
          if (record?.pending) {
            manifest.folders[key] = {
              categoryId: category.id,
              color: category.color,
              theme: settings.folderTheme,
              files: Object.fromEntries(names.map((name) => [name, hash(desired[name])])),
            };
            try {
              await store.write(manifest);
            } catch (error) {
              manifest.folders[key] = record;
              throw error;
            }
            result.updated++;
            result.details.push({ categoryId: category.id, status: 'updated' });
          } else {
            result.unchanged++;
            result.details.push({ categoryId: category.id, status: 'unchanged' });
          }
          changed.push(directory);
          continue;
        }
        // Persist ownership intention before replacing a byte. If interrupted,
        // both previous and intended checksums remain recognizable on retry.
        const pendingRecord = {
          files: record?.files || {},
          pending: {
            previous: Object.fromEntries(
              names.map((name) => [name, previous[name]?.checksum || null]),
            ),
            desired: Object.fromEntries(names.map((name) => [name, hash(desired[name])])),
          },
        };
        manifest.folders[key] = pendingRecord;
        await store.write(manifest);
        for (const name of names) {
          if (previous[name]?.checksum === hash(desired[name])) continue;
          await replace(service, directory, name, desired[name], previous[name]);
          written.push(name);
        }
        await service.folderIcons.applyAttributes(directory);
        manifest.folders[key] = {
          categoryId: category.id,
          color: category.color,
          theme: settings.folderTheme,
          files: Object.fromEntries(names.map((name) => [name, hash(desired[name])])),
        };
        try {
          await store.write(manifest);
        } catch (error) {
          manifest.folders[key] = pendingRecord;
          throw error;
        }
        changed.push(directory);
        result.updated++;
        result.details.push({ categoryId: category.id, status: 'updated' });
      } catch (error) {
        // Restore only our just-written content. A concurrent customization is
        // never overwritten during failure recovery.
        for (const name of written.reverse()) {
          try {
            const current = await snapshot(path.join(directory, name));
            if (current?.checksum !== hash(desired[name])) continue;
            if (previous[name])
              await replace(service, directory, name, previous[name].bytes, current);
            else {
              await service.safeDirectory(directory);
              await service.folderIcons.clearFileAttributes(path.join(directory, name));
              await fs.unlink(path.join(directory, name));
            }
          } catch {}
        }
        if (ownershipVerified && names.every((name) => previous[name])) {
          try {
            await service.safeDirectory(directory);
            const restored = await Promise.all(
              names.map((name) => snapshot(path.join(directory, name))),
            );
            if (
              names.every((name, index) => restored[index]?.checksum === previous[name].checksum)
            ) {
              await service.folderIcons.applyAttributes(directory);
              changed.push(directory);
            }
          } catch {}
        }
        const reason = error.code || error.message;
        const code =
          reason === 'ENOENT'
            ? 'FOLDER_NOT_CREATED'
            : ['TARGET_UNSAFE', 'TARGET_INVALID', 'FOLDER_UNSAFE'].includes(reason)
              ? 'FOLDER_UNSAFE'
              : ['FOLDER_CUSTOMIZED', 'FOLDER_CHANGED'].includes(reason)
                ? reason
                : ['EPERM', 'EACCES'].includes(reason)
                  ? 'FOLDER_ACCESS'
                  : 'FOLDER_APPLY_FAILED';
        const status = [
          'FOLDER_NOT_CREATED',
          'FOLDER_CUSTOMIZED',
          'FOLDER_UNSAFE',
          'FOLDER_CHANGED',
        ].includes(code)
          ? 'skipped'
          : 'failed';
        result[status]++;
        result.details.push({ categoryId: category.id, status, code });
      }
    }
    try {
      await service.folderIcons.notifyChanged(changed);
    } catch {
      result.refreshPending = true;
    }
    return result;
  });
}
module.exports = { applyFolderAppearance };
