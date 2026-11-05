const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ProfileService } = require('./runtime/profiles.cjs');
const { VisibilityAdapter } = require('./runtime/visibility.cjs');
const { ActivityStore } = require('./runtime/activity.cjs');
const { DesktopRuntime } = require('./runtime/controller.cjs');
const { AutomationService } = require('./runtime/automation.cjs');
const { DesktopService } = require('./service.cjs');
const { defaults, validateSettings } = require('./settings.cjs');
const { classify } = require('../shared/domain.js');
const { suggestTags } = require('../shared/smart-tags.js');
const { regexMatches, compileRule } = require('../shared/regex.js');
const { DeepScanner } = require('./scanner.cjs');
const { searchEntries } = require('../shared/launcher.js');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-runtime-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop'),
    downloads = path.join(root, 'Downloads'),
    data = path.join(root, 'data');
  await fs.mkdir(desktop);
  await fs.mkdir(downloads);
  await fs.writeFile(path.join(desktop, 'main.js'), 'code');
  await fs.writeFile(path.join(desktop, 'Report.pdf'), 'report');
  return { root, desktop, downloads, data };
}
class FakeVisibility {
  constructor(hidden = []) {
    this.values = new Map(hidden.map((file) => [file, true]));
  }
  async readMany(files) {
    return files.map((file) => ({ path: file, hidden: this.values.get(file) || false }));
  }
  async setMany(items) {
    for (const item of items) this.values.set(item.path, item.hidden);
  }
}
test('runtime status reports current activity after asynchronous profile and automation reads', async (t) => {
  const { desktop, downloads, data } = await fixture(t);
  const runtime = new DesktopRuntime({ desktop, downloads, data, platform: 'linux' });
  let release;
  runtime.profiles.status = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  runtime.automation.status = async () => ({ lastRun: null });
  runtime.busy = 'folder-appearance';
  const pending = runtime.status();
  runtime.busy = null;
  release({ activeId: null });
  assert.equal((await pending).busy, null);
});
test('profile focus preserves initially hidden files and restores the original visibility', async (t) => {
  const { desktop, data } = await fixture(t),
    secret = path.join(desktop, 'Report.pdf');
  const adapter = new FakeVisibility([secret]);
  const service = new ProfileService(desktop, data, adapter);
  await service.apply(defaults.profiles[0], defaults);
  assert.equal(adapter.values.get(path.join(desktop, 'main.js')), false);
  assert.equal(adapter.values.get(secret), true);
  await service.apply(defaults.profiles[1], defaults);
  assert.equal(adapter.values.get(path.join(desktop, 'main.js')), true);
  await service.restore();
  assert.equal(adapter.values.get(path.join(desktop, 'main.js')), false);
  assert.equal(adapter.values.get(secret), true);
  assert.equal(await fs.readFile(secret, 'utf8'), 'report');
});
test('an interrupted profile update can be restored by a new service instance', async (t) => {
  const { desktop, data } = await fixture(t);
  const adapter = new FakeVisibility();
  let once = true;
  const original = adapter.setMany.bind(adapter);
  adapter.setMany = async (items) => {
    if (once) {
      once = false;
      await original(items.slice(0, 1));
      throw Error('VISIBILITY_FAILED');
    }
    return original(items);
  };
  const service = new ProfileService(desktop, data, adapter);
  await assert.rejects(service.apply(defaults.profiles[3], defaults));
  await new ProfileService(desktop, data, adapter).initialize();
  assert.equal(adapter.values.get(path.join(desktop, 'main.js')), false);
  assert.equal(adapter.values.get(path.join(desktop, 'Report.pdf')), false);
});
test('restoration never changes a replacement file with a different identity', async (t) => {
  const { root, desktop, data } = await fixture(t);
  const file = path.join(desktop, 'Report.pdf'),
    adapter = new FakeVisibility();
  const service = new ProfileService(desktop, data, adapter);
  await service.apply(defaults.profiles[3], defaults);
  await fs.rename(file, path.join(root, 'original.pdf'));
  await fs.writeFile(file, 'new');
  adapter.values.set(file, false);
  await service.restore();
  assert.equal(adapter.values.get(file), false);
  assert.equal(await fs.readFile(file, 'utf8'), 'new');
});
test('Linux .hidden updates preserve existing names and remove only profile additions', async (t) => {
  const { desktop, data } = await fixture(t);
  await fs.writeFile(path.join(desktop, '.hidden'), 'Report.pdf\n');
  const adapter = new VisibilityAdapter(desktop, 'linux'),
    service = new ProfileService(desktop, data, adapter);
  await service.apply(defaults.profiles[3], defaults);
  assert.ok((await fs.readFile(path.join(desktop, '.hidden'), 'utf8')).includes('main.js'));
  await service.restore();
  assert.equal(await fs.readFile(path.join(desktop, '.hidden'), 'utf8'), 'Report.pdf\n');
});
test('safe regex rules support alternatives, reject unsupported lookaround and handle nested quantifiers', () => {
  assert.ok(regexMatches('setup|installer|driver|update', 'GPU_DRIVER.exe'));
  assert.throws(() => compileRule('(?=secret)'), /RULE_REGEX_INVALID/);
  assert.throws(() => compileRule('(abc)\\1'), /RULE_REGEX_INVALID/);
  assert.equal(regexMatches('(a+)+$', 'a'.repeat(15000) + '!'), false);
  const value = structuredClone(defaults);
  value.rules = [
    {
      id: 'regex',
      match: 'regex',
      pattern: '^Report.*\\.pdf$',
      categoryId: 'archive',
      enabled: true,
    },
  ];
  assert.equal(classify({ name: 'Report.pdf' }, validateSettings(value)), 'archive');
});
test('new subcategories and profile preferences migrate from a v2 category list', () => {
  const value = validateSettings({
    schemaVersion: 2,
    mode: 'copy',
    autoScan: true,
    excludedExtensions: ['.tmp'],
    categories: structuredClone(defaults.categories.slice(0, 6)),
    rules: [],
    overrides: { 'Report.pdf': 3 },
    itemIcons: {},
    theme: 'midnight',
    iconPack: 'lucide',
    language: 'tr',
  });
  assert.ok(value.categories.some((c) => c.id === 'softwareide'));
  assert.ok(value.categories.some((c) => c.id === 'systeminstallers'));
  assert.equal(value.overrides['Report.pdf'], 'office');
  assert.equal(value.profiles.length, 4);
  assert.equal(value.automation.archiveEnabled, false);
});
test('local vectors suggest meaningful unknown files and abstain without evidence', () => {
  const suggestion = suggestTags({ name: 'migration_cluster.blob' }, defaults);
  assert.equal(suggestion.categoryId, 'softwaredatabase');
  assert.ok(suggestion.score > 0);
  assert.equal(suggestTags({ name: 'IMG_1287.blob' }, defaults), null);
  assert.equal(suggestTags({ name: 'migration.blob' }, { ...defaults, smartTagging: false }), null);
});
test('scan noise rules skip system folders and driver updaters while allowing explicit keywords', async (t) => {
  const { root } = await fixture(t);
  const programs = path.join(root, 'Programs');
  await fs.mkdir(programs);
  await fs.mkdir(path.join(programs, 'System32'));
  await fs.writeFile(path.join(programs, 'System32', 'Hidden.exe'), 'system');
  await fs.writeFile(path.join(programs, 'RealApp.exe'), 'app');
  await fs.writeFile(path.join(programs, 'Driver Booster.exe'), 'noise');
  await fs.writeFile(path.join(programs, 'library.dll'), 'library');
  const scanner = new DeepScanner({ roots: [{ path: programs, label: 'test' }] });
  let result = await scanner.scan(defaults);
  assert.equal(result.items.length, 1);
  result = await scanner.scan({
    ...defaults,
    scanFilters: { ...defaults.scanFilters, allowedNames: ['driver booster'] },
  });
  assert.equal(result.items.length, 2);
});
test('Downloads move and undo retain the original bytes and path', async (t) => {
  const { desktop, downloads, data } = await fixture(t);
  const file = path.join(downloads, 'Downloaded.pdf');
  await fs.writeFile(file, 'download bytes');
  const service = new DesktopService(desktop, data, { downloads });
  const [item] = await service.registerPaths([file]);
  const preview = await service.preview([{ id: item.id, category: 'office' }], 'move');
  await service.organize(preview.token);
  await assert.rejects(fs.stat(file));
  await service.undo();
  assert.equal(await fs.readFile(file, 'utf8'), 'download bytes');
  await assert.rejects(service.registerPaths([path.join(data, 'outside')]));
});
test('disabled automation never creates an archive or routes a download', async (t) => {
  const { desktop, downloads, data } = await fixture(t);
  await fs.writeFile(path.join(downloads, 'new.pdf'), 'new');
  const automation = new AutomationService(new DesktopService(desktop, data, { downloads }), data);
  await automation.run(defaults);
  assert.equal(await fs.readFile(path.join(downloads, 'new.pdf'), 'utf8'), 'new');
  assert.ok(!(await fs.readdir(desktop)).includes('Arşiv'));
});
test('archive automation moves old files, preserves recent files and produces an undo journal', async (t) => {
  const { desktop, downloads, data } = await fixture(t);
  const old = path.join(desktop, 'Report.pdf'),
    date = new Date(Date.now() - 90 * 86400000);
  await fs.utimes(old, date, date);
  const service = new DesktopService(desktop, data, { downloads });
  const automation = new AutomationService(service, data);
  const value = structuredClone(defaults);
  value.automation.archiveEnabled = true;
  const preview = await automation.preview(value);
  assert.deepEqual(
    preview.archive.map((i) => i.name),
    ['Report.pdf'],
  );
  await automation.run(value);
  assert.equal(await fs.readFile(path.join(desktop, 'Arşiv', 'Report.pdf'), 'utf8'), 'report');
  assert.equal((await service.history())[0].origin, 'automation-archive');
  await service.undo();
  assert.equal(await fs.readFile(old, 'utf8'), 'report');
});
test('download routing waits for stable files, skips partial/system files and deduplicates copies', async (t) => {
  const { desktop, downloads, data } = await fixture(t);
  const ready = path.join(downloads, 'ready.pdf');
  await fs.writeFile(ready, 'ready');
  const date = new Date(Date.now() - 60000);
  await fs.utimes(ready, date, date);
  for (const name of ['active.pdf', 'part.crdownload', 'library.dll', 'settings.ini'])
    await fs.writeFile(path.join(downloads, name), 'skip');
  const service = new DesktopService(desktop, data, { downloads }),
    automation = new AutomationService(service, data),
    value = structuredClone(defaults);
  value.automation.downloadsEnabled = true;
  value.automation.downloadMode = 'copy';
  const preview = await automation.preview(value);
  assert.deepEqual(
    preview.downloads.map((i) => i.name),
    ['ready.pdf'],
  );
  await automation.run(value);
  assert.equal(await fs.readFile(ready, 'utf8'), 'ready');
  await automation.run(value);
  assert.equal((await service.history()).length, 1);
  await service.undo();
  assert.equal(await fs.readFile(ready, 'utf8'), 'ready');
});
test('activity is unknown initially, tracks successful launches and marks known six-month inactivity', async (t) => {
  const { data } = await fixture(t),
    now = Date.UTC(2026, 10, 3),
    activity = new ActivityStore(data, () => now);
  let [item] = await activity.annotate([{ id: 'unknown' }]);
  assert.equal(item.usage.inactive, false);
  assert.equal(item.usage.lastOpened, null);
  await Promise.all(Array.from({ length: 10 }, () => activity.record('known')));
  let records = await activity.store.read();
  assert.equal(records.known.count, 10);
  records.known.lastOpened = now - 210 * 86400000;
  await activity.store.write(records);
  [item] = await activity.annotate([{ id: 'known' }]);
  assert.equal(item.usage.inactive, true);
  assert.equal(item.usage.scope, 'darkdesk-only');
});
test('fuzzy search ranks prefix matches, supports subsequences and rejects unrelated queries', () => {
  const entries = [
    { id: '1', name: 'Visual Studio Code' },
    { id: '2', name: 'Steam' },
    { id: '3', name: 'Code', command: { type: 'show' } },
  ];
  assert.equal(searchEntries('code', entries)[0].id, '3');
  assert.equal(searchEntries('vsc', entries)[0].id, '1');
  assert.equal(searchEntries('unmatched', entries).length, 0);
});
test('runtime launch is restricted to indexed regular files and records usage', async (t) => {
  const { desktop, downloads, data } = await fixture(t),
    launched = [];
  const runtime = new DesktopRuntime({
    desktop,
    downloads,
    data,
    platform: 'linux',
    launch: async (item) => launched.push(item.source),
  });
  await runtime.scan();
  await runtime.launch('main.js');
  assert.deepEqual(launched, [path.join(desktop, 'main.js')]);
  await assert.rejects(runtime.launch('../outside'), /SOURCE_MISSING/);
  assert.equal((await runtime.activity.store.read())['main.js'].count, 1);
});
test('the coordinator rejects overlapping mutations and clears busy state after failure', async (t) => {
  const { desktop, downloads, data } = await fixture(t);
  const runtime = new DesktopRuntime({ desktop, downloads, data, platform: 'linux' });
  let release;
  const operation = runtime.run('test', () => new Promise((resolve) => (release = resolve)));
  await new Promise((resolve) => setTimeout(resolve, 20));
  await assert.rejects(runtime.applyProfile('coding'), /OPERATION_BUSY/);
  release();
  await operation;
  await assert.rejects(
    runtime.run('test', async () => {
      throw Error('expected');
    }),
  );
  assert.equal(runtime.busy, null);
});
test('file organization suspends focus visibility and remains reversible while a profile is active', async (t) => {
  const { desktop, downloads, data } = await fixture(t);
  const runtime = new DesktopRuntime({ desktop, downloads, data, platform: 'linux' });
  await runtime.applyProfile('coding');
  assert.ok((await fs.readFile(path.join(desktop, '.hidden'), 'utf8')).includes('Report.pdf'));
  const preview = await runtime.preview([{ id: 'Report.pdf', category: 'office' }], 'move');
  await runtime.organize(preview.token);
  await runtime.undo();
  await runtime.restoreProfile();
  assert.equal(await fs.readFile(path.join(desktop, 'Report.pdf'), 'utf8'), 'report');
  await assert.rejects(fs.stat(path.join(desktop, '.hidden')));
});
test('invalid automation, filters, profile accelerators and duplicate assignments are rejected', () => {
  for (const patch of [
    { automation: { ...defaults.automation, archiveDays: 0 } },
    { scanFilters: { ...defaults.scanFilters, maxDepth: 99 } },
    { launcherShortcut: 'arbitrary command' },
    { profiles: [{ ...defaults.profiles[0], shortcut: defaults.launcherShortcut }] },
  ])
    assert.throws(() => validateSettings({ ...structuredClone(defaults), ...patch }));
});
test('visibility-only ctime changes are safely rebased without accepting source content edits', async (t) => {
  const { desktop, downloads, data } = await fixture(t);
  const runtime = new DesktopRuntime({ desktop, downloads, data, platform: 'linux' });
  class AttributeSimulator extends FakeVisibility {
    async setMany(items) {
      await super.setMany(items);
      for (const item of items) {
        const stat = await fs.stat(item.path);
        await fs.chmod(item.path, (stat.mode & 0o777) ^ 0o100);
      }
    }
  }
  runtime.profiles.adapter = new AttributeSimulator();
  await runtime.applyProfile('coding');
  const preview = await runtime.preview([{ id: 'Report.pdf', category: 'office' }], 'move');
  await runtime.organize(preview.token);
  await runtime.undo();
  const changed = await runtime.preview([{ id: 'Report.pdf', category: 'office' }], 'move');
  await fs.writeFile(path.join(desktop, 'Report.pdf'), 'changed');
  await assert.rejects(runtime.organize(changed.token), /SOURCE_CHANGED/);
  assert.equal(await fs.readFile(path.join(desktop, 'Report.pdf'), 'utf8'), 'changed');
  await runtime.restoreProfile();
});
test('shortcut matching respects configurable modifiers and canonicalizes duplicate aliases', () => {
  const { matchesAccelerator } = require('../shared/hotkeys.js');
  assert.ok(
    matchesAccelerator('Alt+Shift+5', { key: '%', code: 'Digit5', altKey: true, shiftKey: true }),
  );
  assert.equal(
    matchesAccelerator('Alt+Shift+5', { key: '5', code: 'Digit5', altKey: true }),
    false,
  );
  const value = structuredClone(defaults);
  value.profiles[1].shortcut = 'Alt+Ctrl+1';
  assert.throws(() => validateSettings(value), /SHORTCUT_DUPLICATE/);
});
test('profile pinned names can keep unrelated existing folders visible', async (t) => {
  const { desktop, data } = await fixture(t);
  const folder = path.join(desktop, 'My Files');
  await fs.mkdir(folder);
  const adapter = new FakeVisibility(),
    profile = { ...defaults.profiles[0], visibleNames: ['My Files'] };
  await new ProfileService(desktop, data, adapter).apply(profile, defaults);
  assert.equal(adapter.values.get(folder), false);
  assert.equal(adapter.values.get(path.join(desktop, 'Report.pdf')), true);
});
test('an explicit Undo suppresses automatic reprocessing of the restored file version', async (t) => {
  const { desktop, downloads, data } = await fixture(t);
  const file = path.join(desktop, 'Report.pdf'),
    date = new Date(Date.now() - 90 * 86400000);
  await fs.utimes(file, date, date);
  const runtime = new DesktopRuntime({ desktop, downloads, data, platform: 'linux' });
  const value = structuredClone(defaults);
  value.automation.archiveEnabled = true;
  await runtime.settings.write(value);
  await runtime.runAutomation();
  await runtime.undo();
  await runtime.runAutomation();
  assert.equal(await fs.readFile(file, 'utf8'), 'report');
  assert.equal((await runtime.service.history()).length, 1);
});

test('new installs use Alt+X while saved custom launcher shortcuts are preserved', () => {
  assert.equal(defaults.launcherShortcut, 'Alt+X');
  assert.equal(validateSettings({}).launcherShortcut, 'Alt+X');
  assert.equal(validateSettings({ launcherShortcut: 'Alt+Q' }).launcherShortcut, 'Alt+Q');
});
