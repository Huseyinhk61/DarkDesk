const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { DeepScanner, windowsRoots } = require('./scanner.cjs');
const { DesktopService, folders } = require('./service.cjs');
const { FolderIcons } = require('./folder-icons.cjs');
const { validateSettings, defaults, SettingsStore } = require('./settings.cjs');
const { classify, categorySegments } = require('../shared/domain.js');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-advanced-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop'),
    programs = path.join(root, 'Program Files'),
    data = path.join(root, 'data');
  await fs.mkdir(desktop);
  await fs.mkdir(programs);
  return { root, desktop, programs, data };
}
function custom() {
  return {
    ...structuredClone(defaults),
    categories: [
      ...structuredClone(defaults.categories),
      {
        id: 'custom',
        name: 'Projects',
        folder: 'Projects',
        parentId: 'software',
        icon: 'rocket',
        color: 'purple',
      },
      {
        id: 'nested',
        name: 'Client',
        folder: 'Client',
        parentId: 'custom',
        icon: 'star',
        color: 'blue',
      },
    ],
  };
}
test('v1 preferences migrate numeric category overrides without losing mode or exclusions', () => {
  const value = validateSettings({
    mode: 'copy',
    autoScan: false,
    excludedExtensions: ['.bak'],
    overrides: { 'a.pdf': 3 },
  });
  assert.equal(value.overrides['a.pdf'], 'office');
  assert.equal(value.theme, 'midnight');
  assert.equal(value.categories.length, 6);
  assert.equal(value.mode, 'copy');
});
test('theme, language, packs, item icons, rules and subgroups survive settings reload', async (t) => {
  const { data } = await fixture(t);
  const value = custom();
  Object.assign(value, {
    theme: 'slate',
    language: 'en',
    iconPack: 'tabler',
    itemIcons: { 'app:sample': 'heart' },
    rules: [
      { id: 'rule', pattern: 'game', match: 'contains', categoryId: 'nested', enabled: true },
    ],
  });
  await new SettingsStore(data).write(value);
  assert.deepEqual(await new SettingsStore(data).read(), validateSettings(value));
});
test('category cycles, duplicate folder paths, Windows device names and traversal are rejected', () => {
  for (const folder of ['../outside', 'CON', 'AUX.txt', 'ends.', 'bad:name', 'bad\\name']) {
    const value = custom();
    value.categories.at(-1).folder = folder;
    assert.throws(() => validateSettings(value));
  }
  let value = custom();
  value.categories.find((c) => c.id === 'custom').parentId = 'nested';
  assert.throws(() => validateSettings(value), /CATEGORY_CYCLE/);
  value = custom();
  value.categories.at(-1).folder = 'Projects';
  value.categories.at(-1).parentId = 'software';
  assert.throws(() => validateSettings(value), /CATEGORY_DUPLICATE/);
});
test('matching rules are ordered, normalized and lower priority than manual assignments', () => {
  const value = custom();
  value.rules = [
    { id: '1', pattern: 'GAME', match: 'contains', categoryId: 'custom', enabled: true },
    { id: '2', pattern: '.exe', match: 'extension', categoryId: 'office', enabled: true },
  ];
  const item = { id: 'a', name: 'My Game.exe' };
  assert.equal(classify(item, value), 'custom');
  value.rules[0].enabled = false;
  assert.equal(classify(item, value), 'office');
  value.overrides.a = 'nested';
  assert.equal(classify(item, value), 'nested');
  assert.equal(classify({ name: 'Spotify.exe' }, defaults), 'media');
});
test('nested categories create real safe folders and remain undoable after category removal', async (t) => {
  const { desktop, data } = await fixture(t);
  await fs.writeFile(path.join(desktop, 'project.txt'), 'keep');
  const service = new DesktopService(desktop, data);
  service.settings = custom();
  const plan = await service.preview([{ id: 'project.txt', category: 'nested' }], 'move');
  assert.equal(
    plan.entries[0].target,
    path.join(desktop, 'Yazılım & Geliştirme', 'Projects', 'Client', 'project.txt'),
  );
  await service.organize(plan.token);
  service.settings = structuredClone(defaults);
  await service.undo();
  assert.equal(await fs.readFile(path.join(desktop, 'project.txt'), 'utf8'), 'keep');
  assert.deepEqual(await fs.readdir(desktop), ['project.txt']);
});
test(
  'a symlink in any ancestor blocks nested organization',
  { skip: process.platform === 'win32' ? 'Requires symlink privilege; covered on Linux' : false },
  async (t) => {
    const { root, desktop, data } = await fixture(t);
    await fs.writeFile(path.join(desktop, 'a.txt'), 'a');
    await fs.symlink(root, path.join(desktop, 'Yazılım & Geliştirme'));
    const service = new DesktopService(desktop, data);
    service.settings = custom();
    const plan = await service.preview([{ id: 'a.txt', category: 'nested' }], 'move');
    assert.equal(plan.conflicts, 1);
    assert.match(plan.entries[0].conflict, /TARGET_UNSAFE/);
  },
);
test('deep scanner visits nested app roots, ignores helpers and symlinks and deduplicates shortcut targets', async (t) => {
  const { programs } = await fixture(t);
  const nested = path.join(programs, 'Product');
  await fs.mkdir(nested);
  const exe = path.join(nested, 'VLC.exe');
  await fs.writeFile(exe, 'app');
  await fs.writeFile(path.join(programs, 'VLC.lnk'), 'link');
  await fs.writeFile(path.join(programs, 'Uninstall.exe'), 'helper');
  await fs.writeFile(path.join(programs, 'readme.txt'), 'doc');
  const scanner = new DeepScanner({
    platform: 'win32',
    roots: [{ path: programs, label: 'programFiles' }],
    resolveShortcut: async () => ({ target: exe }),
  });
  const result = await scanner.scan(defaults);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].category, 'media');
  assert.equal(result.items[0].kind, 'installed');
  assert.equal(await fs.readFile(exe, 'utf8'), 'app');
  assert.equal(scanner.catalog.size, 1);
});
test('registered executable paths outside Program Files are discovered without writes', async (t) => {
  const { root, programs } = await fixture(t);
  const external = path.join(root, 'Registered.exe');
  await fs.writeFile(external, 'registered');
  const scanner = new DeepScanner({
    platform: 'win32',
    roots: [{ path: programs, label: 'programFiles' }],
    registryEnabled: true,
    registry: async () => [{ executable: external }],
  });
  const result = await scanner.scan(defaults);
  assert.equal(result.items[0].origin, 'registry');
  assert.equal(result.items[0].source, external);
});
test('deep scanner reports missing roots and registry failure while keeping available results', async (t) => {
  const { programs, root } = await fixture(t);
  await fs.writeFile(path.join(programs, 'App.exe'), 'app');
  const scanner = new DeepScanner({
    platform: 'win32',
    roots: [
      { path: programs, label: 'programFiles' },
      { path: path.join(root, 'missing'), label: 'startUser' },
    ],
    registryEnabled: true,
    registry: async () => {
      throw Error('unavailable');
    },
  });
  const result = await scanner.scan(defaults);
  assert.equal(result.items.length, 1);
  assert.ok(result.warnings.some((w) => w.origin === 'registry'));
  assert.ok(result.warnings.some((w) => w.origin === 'startUser'));
});
test('deep scan bounds are explicit, and cancellation retains a partial catalog', async (t) => {
  const { programs } = await fixture(t);
  await fs.writeFile(path.join(programs, 'A.exe'), 'a');
  await fs.writeFile(path.join(programs, 'B.exe'), 'b');
  const limited = new DeepScanner({ roots: [{ path: programs, label: 'test' }], maxResults: 1 });
  const result = await limited.scan(defaults);
  assert.equal(result.items.length, 1);
  assert.equal(result.limited, true);
  const cancelled = new DeepScanner({
    roots: [{ path: programs, label: 'test' }],
    onProgress: () => cancelled.cancel(),
  });
  const partial = await cancelled.scan(defaults);
  assert.equal(partial.cancelled, true);
  assert.equal(partial.items.length, 2);
});
test('Windows roots include user/common Start Menu and both Program Files locations', () => {
  const roots = windowsRoots({
    APPDATA: 'user',
    ProgramData: 'shared',
    ProgramFiles: 'programs',
    'ProgramFiles(x86)': 'x86',
  });
  assert.deepEqual(
    roots.map((r) => r.label),
    ['startUser', 'startCommon', 'programFiles', 'programFilesX86'],
  );
});
test('installed app creates a native shortcut and undo never moves or deletes its executable', async (t) => {
  const { desktop, programs, data } = await fixture(t);
  const executable = path.join(programs, 'My Game.appimage');
  await fs.writeFile(executable, 'application stays here');
  const scanner = new DeepScanner({
    platform: 'linux',
    roots: [{ path: programs, label: 'linuxOpt' }],
  });
  const result = await scanner.scan(defaults);
  const service = new DesktopService(desktop, data, {
    scanner,
    platform: 'linux',
    folderIcons: new FolderIcons(data, 'linux'),
  });
  const plan = await service.preview([{ id: result.items[0].id, category: 'games' }], 'move');
  assert.equal(plan.entries[0].action, 'shortcut');
  await service.organize(plan.token);
  assert.equal(await fs.readFile(executable, 'utf8'), 'application stays here');
  const shortcut = path.join(desktop, folders[2], 'My Game.desktop');
  assert.match(await fs.readFile(shortcut, 'utf8'), /\[Desktop Entry\]/);
  await service.undo();
  assert.equal(await fs.readFile(executable, 'utf8'), 'application stays here');
  assert.deepEqual(await fs.readdir(desktop), []);
});
test('same-named installed apps produce a visible duplicate-target conflict', async (t) => {
  const { desktop, programs, data } = await fixture(t);
  await fs.mkdir(path.join(programs, 'Other'));
  await fs.writeFile(path.join(programs, 'App.exe'), 'a');
  await fs.writeFile(path.join(programs, 'Other', 'App.exe'), 'b');
  const scanner = new DeepScanner({ roots: [{ path: programs, label: 'test' }] });
  const result = await scanner.scan(defaults);
  const service = new DesktopService(desktop, data, { scanner });
  const plan = await service.preview(
    result.items.map((i) => ({ id: i.id, category: 'system' })),
    'copy',
  );
  assert.equal(plan.ready, 1);
  assert.equal(plan.conflicts, 1);
  assert.equal(plan.entries[1].conflict, 'TARGET_DUPLICATE');
});
test('installed sources cannot be supplied by a renderer without a discovered catalog entry', async (t) => {
  const { desktop, data } = await fixture(t);
  const service = new DesktopService(desktop, data);
  await assert.rejects(
    service.preview([{ id: 'app:unknown', source: '/outside/exe', category: 'system' }], 'move'),
    /CATEGORY_INVALID/,
  );
});
test('both locale dictionaries have identical keys and interpolation variables', () => {
  const tr = require('../src/locales/tr.json'),
    en = require('../src/locales/en.json');
  assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort());
  for (const key of Object.keys(tr))
    assert.deepEqual(tr[key].match(/\{\w+\}/g) || [], en[key].match(/\{\w+\}/g) || [], key);
});
test('resuming a shortcut undo never compares or deletes the original executable', async (t) => {
  const { desktop, programs, data } = await fixture(t);
  const executable = path.join(programs, 'App.appimage');
  await fs.writeFile(executable, 'original');
  const scanner = new DeepScanner({ roots: [{ path: programs, label: 'test' }] });
  const result = await scanner.scan(defaults);
  const service = new DesktopService(desktop, data, {
    scanner,
    platform: 'linux',
    folderIcons: new FolderIcons(data, 'linux'),
  });
  const plan = await service.preview([{ id: result.items[0].id, category: 'system' }], 'move');
  await service.organize(plan.token);
  const log = await service.history();
  const entry = log[0].entries[0];
  entry.stage = 'deleting';
  log[0].status = 'undoing';
  await service.save(log);
  await fs.unlink(entry.target);
  await fs.writeFile(executable, 'updated app');
  await service.undo();
  assert.equal(await fs.readFile(executable, 'utf8'), 'updated app');
});
test('registry script uses literal PowerShell provider paths and explicit UTF-8 output', () => {
  const { REGISTRY_SCRIPT } = require('./scanner.cjs');
  assert.ok(REGISTRY_SCRIPT.includes('HKLM:\\SOFTWARE\\Microsoft'));
  assert.ok(!REGISTRY_SCRIPT.includes('HKLM:\\\\SOFTWARE'));
  assert.ok(REGISTRY_SCRIPT.includes('UTF8Encoding'));
});
test('shortcuts with different launch arguments remain distinct installed applications', async (t) => {
  const { programs } = await fixture(t);
  const exe = path.join(programs, 'Steam.exe');
  await fs.writeFile(exe, 'launcher');
  await fs.writeFile(path.join(programs, 'Game One.lnk'), 'link');
  await fs.writeFile(path.join(programs, 'Game Two.lnk'), 'link');
  const scanner = new DeepScanner({
    platform: 'win32',
    roots: [{ path: programs, label: 'programFiles' }],
    resolveShortcut: async (file) => ({
      target: exe,
      args: file.endsWith('One.lnk') ? '-applaunch 1' : '-applaunch 2',
    }),
  });
  const result = await scanner.scan(defaults);
  assert.equal(result.items.length, 3);
  assert.equal(new Set(result.items.map((item) => item.id)).size, 3);
});
test('reaching the scan depth limit is reported as partial results', async (t) => {
  const { programs } = await fixture(t);
  const nested = path.join(programs, 'Nested');
  await fs.mkdir(nested);
  await fs.writeFile(path.join(nested, 'App.exe'), 'app');
  const scanner = new DeepScanner({ roots: [{ path: programs, label: 'test' }], maxDepth: 0 });
  const result = await scanner.scan(defaults);
  assert.equal(result.items.length, 0);
  assert.equal(result.limited, true);
});
