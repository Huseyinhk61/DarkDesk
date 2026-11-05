const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { FolderIcons } = require('./folder-icons.cjs');
const { DesktopService } = require('./service.cjs');
const { applyFolderAppearance } = require('./folder-appearance.cjs');
const { defaultSettings, categorySegments, icons } = require('../shared/domain.js');
const { folderColorIds, folderThemes, folderSvg } = require('../shared/folder-appearance.js');
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-folder-appearance-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop'),
    data = path.join(root, 'data');
  await fs.mkdir(desktop);
  const calls = [];
  const folderIcons = new FolderIcons(data, 'win32', {
    run: async (...args) => calls.push(args),
    ...options,
  });
  const service = new DesktopService(desktop, data, { platform: 'win32', folderIcons });
  const settings = structuredClone(defaultSettings);
  const group = settings.categories.find((c) => c.id === 'software');
  const directory = path.join(desktop, ...categorySegments(group.id, settings.categories));
  return { root, desktop, data, service, folderIcons, settings, group, directory, calls };
}
test('all folder colors and themes have safe previews and distinct valid Windows ICO artwork', async () => {
  assert.equal(folderColorIds.length, 10);
  assert.deepEqual(folderThemes, ['gradient', 'solid', 'outline']);
  const images = new Set();
  for (const theme of folderThemes)
    for (const color of folderColorIds)
      for (const icon of icons) {
        const file = path.join(
          __dirname,
          '../build/folder-icons/themes',
          theme,
          color,
          icon + '.ico',
        );
        const bytes = await fs.readFile(file);
        assert.equal(bytes.readUInt16LE(2), 1);
        assert.equal(bytes.readUInt16LE(4), 1);
        assert.deepEqual([...bytes.subarray(22, 30)], [137, 80, 78, 71, 13, 10, 26, 10]);
        images.add(digest(bytes));
        const svg = folderSvg({ theme, color, icon });
        assert.ok(svg.startsWith('<svg'));
        assert.equal(/https?:\/\/[^w]/.test(svg), false);
      }
  assert.equal(images.size, folderColorIds.length * folderThemes.length * icons.length);
  for (const value of [{ color: '../blue' }, { theme: 'url(injected)' }, { icon: '<script>' }])
    assert.throws(() => folderSvg(value), /FOLDER_APPEARANCE_INVALID/);
});
test('new Windows category folders use the selected category color and folder theme', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(f.directory);
  f.group.color = 'cyan';
  f.settings.folderTheme = 'solid';
  const records = await f.folderIcons.decorate(f.directory, f.group, f.settings);
  const expected = await fs.readFile(
    await f.folderIcons.folderIconFile(f.group.icon, 'cyan', 'solid'),
  );
  assert.deepEqual(await fs.readFile(path.join(f.directory, '.darkdesk.ico')), expected);
  assert.match(
    await fs.readFile(path.join(f.directory, 'desktop.ini'), 'utf16le'),
    /DarkDesk=solid\/cyan\/code/,
  );
  assert.equal(records.length, 2);
  assert.ok(f.calls.some((call) => call[0] === 'attrib.exe'));
});
test('legacy history proves metadata ownership and explicit refresh is idempotent', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(f.directory);
  const legacy = {
    '.darkdesk.ico': await fs.readFile(
      await f.folderIcons.iconFile(f.group.icon, f.settings.iconPack),
    ),
    'desktop.ini': Buffer.concat([
      Buffer.from([255, 254]),
      Buffer.from('[.ShellClassInfo]\r\nIconResource=.darkdesk.ico,0\r\n', 'utf16le'),
    ]),
  };
  const metadata = [];
  for (const [name, bytes] of Object.entries(legacy)) {
    const file = path.join(f.directory, name);
    await fs.writeFile(file, bytes);
    metadata.push({ path: file, checksum: digest(bytes) });
  }
  await f.service.save([
    { status: 'completed', directories: [f.directory], metadata, entries: [] },
  ]);
  f.group.color = 'red';
  f.settings.folderTheme = 'outline';
  const result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.updated, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(
    await fs.readFile(path.join(f.directory, '.darkdesk.ico')),
    await fs.readFile(await f.folderIcons.folderIconFile(f.group.icon, 'red', 'outline')),
  );
  const manifest = JSON.parse(
    await fs.readFile(path.join(f.data, 'folder-appearance.json'), 'utf8'),
  );
  assert.equal(manifest.folders[path.resolve(f.directory).toLowerCase()].color, 'red');
  assert.equal((await applyFolderAppearance(f.service, f.settings)).unchanged, 1);
  assert.ok(f.calls.some((call) => call[0] === 'powershell.exe'));
});
test('user desktop.ini and customized owned icons are preserved rather than overwritten', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(f.directory);
  const custom = Buffer.from('[.ShellClassInfo]\r\nIconResource=C:\\My Icons\\personal.ico,0');
  await fs.writeFile(path.join(f.directory, 'desktop.ini'), custom);
  let result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.details.find((d) => d.categoryId === f.group.id).code, 'FOLDER_CUSTOMIZED');
  assert.deepEqual(await fs.readFile(path.join(f.directory, 'desktop.ini')), custom);
  await assert.rejects(fs.stat(path.join(f.directory, '.darkdesk.ico')), { code: 'ENOENT' });
  await fs.unlink(path.join(f.directory, 'desktop.ini'));
  await applyFolderAppearance(f.service, f.settings);
  const ini = await fs.readFile(path.join(f.directory, 'desktop.ini'));
  await fs.writeFile(path.join(f.directory, '.darkdesk.ico'), 'user replacement');
  f.settings.folderTheme = 'solid';
  result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.details.find((d) => d.categoryId === f.group.id).code, 'FOLDER_CUSTOMIZED');
  assert.equal(
    await fs.readFile(path.join(f.directory, '.darkdesk.ico'), 'utf8'),
    'user replacement',
  );
  assert.deepEqual(await fs.readFile(path.join(f.directory, 'desktop.ini')), ini);
});
test('metadata and directory symlinks cannot redirect appearance changes', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(f.directory);
  const outside = path.join(f.root, 'outside.ico');
  await fs.writeFile(outside, 'outside unchanged');
  try {
    await fs.symlink(outside, path.join(f.directory, '.darkdesk.ico'), 'file');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('File symlink privilege is unavailable');
    throw error;
  }
  let result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.details.find((d) => d.categoryId === f.group.id).code, 'FOLDER_CUSTOMIZED');
  assert.equal(await fs.readFile(outside, 'utf8'), 'outside unchanged');
  await fs.unlink(path.join(f.directory, '.darkdesk.ico'));
  await fs.rmdir(f.directory);
  const outsideDir = path.join(f.root, 'outside directory');
  await fs.mkdir(outsideDir);
  await fs.symlink(outsideDir, f.directory, process.platform === 'win32' ? 'junction' : 'dir');
  result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.details.find((d) => d.categoryId === f.group.id).code, 'FOLDER_UNSAFE');
  assert.deepEqual(await fs.readdir(outsideDir), []);
});
test('a partial folder failure rolls back its metadata and other categories still update', async (t) => {
  const f = await fixture(t);
  const second = f.settings.categories.find((c) => c.id === 'design'),
    other = path.join(f.desktop, ...categorySegments(second.id, f.settings.categories));
  await fs.mkdir(f.directory);
  await fs.mkdir(other);
  await fs.writeFile(path.join(f.directory, 'keep.txt'), 'user bytes');
  const original = f.folderIcons.applyAttributes.bind(f.folderIcons);
  let fail = true;
  f.folderIcons.applyAttributes = async (directory) => {
    if (fail && directory === f.directory) throw Object.assign(Error('denied'), { code: 'EPERM' });
    return original(directory);
  };
  let result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.failed, 1);
  assert.equal(result.updated, 1);
  assert.equal(await fs.readFile(path.join(f.directory, 'keep.txt'), 'utf8'), 'user bytes');
  assert.deepEqual(await fs.readdir(f.directory), ['keep.txt']);
  fail = false;
  result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.failed, 0);
  assert.equal(result.updated, 1);
  assert.equal(result.unchanged, 1);
});
test('later appearance choices survive an older file-move undo while original user data is restored', async (t) => {
  const f = await fixture(t);
  const source = path.join(f.desktop, 'main.js');
  await fs.writeFile(source, 'original code');
  const plan = await f.service.preview([{ id: 'main.js', category: f.group.id }], 'move');
  await f.service.organize(plan.token);
  f.group.color = 'pink';
  f.settings.folderTheme = 'solid';
  assert.equal((await applyFolderAppearance(f.service, f.settings)).updated, 1);
  const before = await fs.readFile(path.join(f.directory, '.darkdesk.ico'));
  let attributesCleared = false;
  f.folderIcons.removeAttributes = async () => {
    attributesCleared = true;
  };
  await f.service.undo();
  assert.equal(attributesCleared, false, 'A retained styled folder keeps its Explorer attributes');
  assert.equal(await fs.readFile(source, 'utf8'), 'original code');
  assert.deepEqual(await fs.readFile(path.join(f.directory, '.darkdesk.ico')), before);
  assert.match(await fs.readFile(path.join(f.directory, 'desktop.ini'), 'utf16le'), /solid\/pink/);
});
test('unsupported platforms do not create metadata or an ownership store', async (t) => {
  const f = await fixture(t);
  f.service.platform = 'linux';
  await fs.mkdir(f.directory);
  const result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.unsupported, true);
  assert.equal(result.updated, 0);
  assert.deepEqual(await fs.readdir(f.directory), []);
  await assert.rejects(fs.stat(path.join(f.data, 'folder-appearance.json')), { code: 'ENOENT' });
});

test('a failed final manifest commit preserves old ownership across later folder writes and retry', async (t) => {
  const { JsonStore } = require('./runtime/json-store.cjs');
  const f = await fixture(t);
  const design = f.settings.categories.find((c) => c.id === 'design'),
    other = path.join(f.desktop, ...categorySegments(design.id, f.settings.categories));
  await fs.mkdir(f.directory);
  await fs.mkdir(other);
  await applyFolderAppearance(f.service, f.settings);
  f.settings.folderTheme = 'solid';
  let count = 0;
  const write = JsonStore.prototype.write;
  t.mock.method(JsonStore.prototype, 'write', async function (value) {
    if (this.file.endsWith('folder-appearance.json') && ++count === 2)
      throw Error('final manifest commit failed');
    return write.call(this, value);
  });
  let result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.failed, 1);
  assert.equal(result.updated, 1);
  result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.updated, 1);
  assert.equal(result.unchanged, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.details.find((d) => d.categoryId === f.group.id).status, 'updated');
});
test('temporary metadata is removed after a write error and other folders continue', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(f.directory);
  const design = f.settings.categories.find((c) => c.id === 'design');
  await fs.mkdir(path.join(f.desktop, ...categorySegments(design.id, f.settings.categories)));
  const open = fs.open;
  let fail = true;
  t.mock.method(fs, 'open', async function (file, ...args) {
    const handle = await open.call(this, file, ...args);
    if (fail && path.basename(file).startsWith('.darkdesk-style-')) {
      fail = false;
      return {
        writeFile: async () => {
          throw Object.assign(Error('disk full'), { code: 'ENOSPC' });
        },
        sync: handle.sync.bind(handle),
        close: handle.close.bind(handle),
      };
    }
    return handle;
  });
  const result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.failed, 1);
  assert.equal(result.updated, 1);
  assert.deepEqual(await fs.readdir(f.directory), []);
});
test('redirected filesystems without hard links use exclusive copies without replacing a concurrent file', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(f.directory);
  const link = fs.link;
  t.mock.method(fs, 'link', async () => {
    throw Object.assign(Error('unsupported'), { code: 'ENOTSUP' });
  });
  assert.equal((await applyFolderAppearance(f.service, f.settings)).updated, 1);
  const design = f.settings.categories.find((c) => c.id === 'design'),
    other = path.join(f.desktop, ...categorySegments(design.id, f.settings.categories));
  await fs.mkdir(other);
  let once = true;
  t.mock.method(fs, 'link', async (source, target) => {
    if (once && path.dirname(target) === other) {
      once = false;
      await fs.writeFile(target, 'concurrent user metadata', { flag: 'wx' });
    }
    throw Object.assign(Error('unsupported'), { code: 'ENOTSUP' });
  });
  const result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.details.find((d) => d.categoryId === design.id).code, 'FOLDER_CHANGED');
  assert.equal(
    await fs.readFile(path.join(other, '.darkdesk.ico'), 'utf8'),
    'concurrent user metadata',
  );
  await assert.rejects(fs.stat(path.join(other, 'desktop.ini')), { code: 'ENOENT' });
});
test('completed pending metadata repairs native attributes and finalizes ownership on retry', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(f.directory);
  await fs.mkdir(f.data);
  const desired = await f.folderIcons.folderContents(f.group, f.settings);
  for (const [name, bytes] of Object.entries(desired))
    await fs.writeFile(path.join(f.directory, name), bytes);
  const key = path.resolve(f.directory).toLowerCase();
  await fs.writeFile(
    path.join(f.data, 'folder-appearance.json'),
    JSON.stringify({
      version: 1,
      folders: {
        [key]: {
          files: {},
          pending: {
            previous: {},
            desired: Object.fromEntries(
              Object.entries(desired).map(([name, bytes]) => [name, digest(bytes)]),
            ),
          },
        },
      },
    }),
  );
  const result = await applyFolderAppearance(f.service, f.settings);
  assert.equal(result.updated, 1);
  assert.equal(result.failed, 0);
  assert.ok(f.calls.some((call) => call[0] === 'attrib.exe'));
  const manifest = JSON.parse(
    await fs.readFile(path.join(f.data, 'folder-appearance.json'), 'utf8'),
  );
  assert.equal(manifest.folders[key].pending, undefined);
  assert.equal(manifest.folders[key].files['.darkdesk.ico'], digest(desired['.darkdesk.ico']));
});

test('a first metadata rename failure restores owned native attributes even before any write completes', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(f.directory);
  await applyFolderAppearance(f.service, f.settings);
  const previousIcon = await fs.readFile(path.join(f.directory, '.darkdesk.ico'));
  let cleared = false,
    repaired = false;
  const originalClear = f.folderIcons.clearFileAttributes.bind(f.folderIcons);
  f.folderIcons.clearFileAttributes = async (file) => {
    cleared = true;
    await originalClear(file);
  };
  const originalApply = f.folderIcons.applyAttributes.bind(f.folderIcons);
  f.folderIcons.applyAttributes = async (directory) => {
    if (cleared) repaired = true;
    await originalApply(directory);
  };
  const originalRename = fs.rename;
  fs.rename = async (source, destination) => {
    if (destination === path.join(f.directory, '.darkdesk.ico'))
      throw Object.assign(Error('locked metadata'), { code: 'EPERM' });
    return originalRename(source, destination);
  };
  try {
    f.settings.folderTheme = 'outline';
    const result = await applyFolderAppearance(f.service, f.settings);
    assert.equal(result.failed, 1);
    assert.equal(cleared, true);
    assert.equal(repaired, true);
    assert.deepEqual(await fs.readFile(path.join(f.directory, '.darkdesk.ico')), previousIcon);
    assert.equal(
      (await fs.readdir(f.directory)).some((name) => name.startsWith('.darkdesk-style-')),
      false,
    );
  } finally {
    fs.rename = originalRename;
  }
});
