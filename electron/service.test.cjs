const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DesktopService, folders, category } = require('./service.cjs');
const { SettingsStore, defaults } = require('./settings.cjs');
async function fixture(t, options) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop'),
    data = path.join(root, 'data');
  await fs.mkdir(desktop);
  await fs.writeFile(path.join(desktop, 'notes.pdf'), 'important');
  return { root, desktop, data, service: new DesktopService(desktop, data, options) };
}
async function organize(service, mode = 'move', items) {
  const plan = await service.preview(items || (await service.scan()), mode);
  return service.organize(plan.token);
}
test('scan detects supported shortcuts, sizes and ignored files without traversing folders', async (t) => {
  const { desktop, service } = await fixture(t);
  await fs.writeFile(path.join(desktop, '.hidden'), 'secret');
  await fs.writeFile(path.join(desktop, 'desktop.ini'), 'system');
  await fs.writeFile(path.join(desktop, 'game.url'), 'shortcut');
  await fs.mkdir(path.join(desktop, 'folder'));
  const items = await service.scan();
  assert.equal(items.length, 2);
  assert.equal(items.find((i) => i.name === 'game.url').kind, 'shortcut');
  assert.equal(items.find((i) => i.name === 'notes.pdf').size, 9);
});
test('category rules distinguish Android Studio, Photoshop and typed documents', () => {
  assert.equal(category('Visual Studio Code.lnk'), 0);
  assert.equal(category('Adobe Photoshop.lnk'), 1);
  assert.equal(category('play.lnk', 'C:\\Steam\\steam.exe'), 2);
  assert.equal(category('report.xlsx'), 3);
  assert.equal(category('backup.zip'), 4);
});
test('Windows shortcut targets contribute to classification and preferences override it', async (t) => {
  const { desktop, service } = await fixture(t, {
    resolveShortcut: async () => ({ target: 'C:\\Steam\\steam.exe' }),
  });
  await fs.writeFile(path.join(desktop, 'Play.lnk'), 'link');
  let items = await service.scan();
  assert.equal(items.find((i) => i.id === 'Play.lnk').category, 2);
  items = await service.scan({ overrides: { 'Play.lnk': 0 } });
  assert.equal(items.find((i) => i.id === 'Play.lnk').category, 0);
});
test('preview does not create a folder or modify a source', async (t) => {
  const { desktop, service } = await fixture(t);
  const plan = await service.preview(await service.scan(), 'move');
  assert.equal(plan.ready, 1);
  assert.equal(plan.bytes, 9);
  assert.deepEqual(await fs.readdir(desktop), ['notes.pdf']);
  assert.deepEqual(await service.history(), []);
});
test('move and undo restore original bytes and retain auditable history', async (t) => {
  const { desktop, service } = await fixture(t);
  await organize(service);
  assert.equal((await service.scan()).length, 0);
  assert.equal(await fs.readFile(path.join(desktop, folders[3], 'notes.pdf'), 'utf8'), 'important');
  await service.undo();
  assert.equal(await fs.readFile(path.join(desktop, 'notes.pdf'), 'utf8'), 'important');
  assert.equal((await service.history())[0].status, 'undone');
  await assert.rejects(service.undo(), /Geri alınacak/);
});
test('copy keeps original and undo removes only copy', async (t) => {
  const { desktop, service } = await fixture(t);
  await organize(service, 'copy');
  assert.equal(await fs.readFile(path.join(desktop, 'notes.pdf'), 'utf8'), 'important');
  await fs.writeFile(path.join(desktop, 'notes.pdf'), 'updated original');
  await service.undo();
  assert.equal(await fs.readFile(path.join(desktop, 'notes.pdf'), 'utf8'), 'updated original');
});
test('collision appears in preview and conflicting files are skipped', async (t) => {
  const { desktop, service } = await fixture(t);
  await fs.mkdir(path.join(desktop, folders[3]));
  await fs.writeFile(path.join(desktop, folders[3], 'notes.pdf'), 'existing');
  await fs.writeFile(path.join(desktop, 'other.txt'), 'other');
  const plan = await service.preview(await service.scan(), 'move');
  assert.equal(plan.conflicts, 1);
  assert.equal(plan.ready, 1);
  const batch = await service.organize(plan.token);
  assert.deepEqual(batch.skipped, ['notes.pdf']);
  assert.equal(await fs.readFile(path.join(desktop, folders[3], 'notes.pdf'), 'utf8'), 'existing');
  assert.equal(await fs.readFile(path.join(desktop, 'notes.pdf'), 'utf8'), 'important');
});
test('all-conflict plan cannot execute or create history', async (t) => {
  const { desktop, service } = await fixture(t);
  await organize(service, 'copy');
  const plan = await service.preview(await service.scan(), 'move');
  await assert.rejects(service.organize(plan.token), /Çakışmasız/);
  assert.equal((await service.history()).length, 1);
});
test('path traversal, backslash, duplicates and invalid categories are rejected', async (t) => {
  const { service } = await fixture(t);
  for (const item of [
    { id: '../outside', category: 3 },
    { id: '..\\outside', category: 3 },
    { id: 'notes.pdf', category: 99 },
    { id: 'notes.pdf', category: '3' },
  ])
    await assert.rejects(service.preview([item], 'move'));
  await assert.rejects(
    service.preview(
      [
        { id: 'notes.pdf', category: 3 },
        { id: 'notes.pdf', category: 0 },
      ],
      'move',
    ),
  );
  await assert.rejects(service.preview(await service.scan(), 'delete'));
});
test(
  'symlink sources are excluded and symlink category directories are never used',
  {
    skip:
      process.platform === 'win32'
        ? 'Requires Windows symlink privileges; covered on Linux'
        : false,
  },
  async (t) => {
    const { desktop, root, service } = await fixture(t);
    await fs.symlink(path.join(desktop, 'notes.pdf'), path.join(desktop, 'link.pdf'));
    assert.equal((await service.scan()).length, 1);
    await assert.rejects(service.preview([{ id: 'link.pdf', category: 3 }], 'move'));
    await fs.symlink(root, path.join(desktop, folders[3]));
    const plan = await service.preview(await service.scan(), 'move');
    assert.equal(plan.conflicts, 1);
    await assert.rejects(service.organize(plan.token));
  },
);
test('a changed source invalidates the complete plan before mutation', async (t) => {
  const { desktop, service } = await fixture(t);
  const plan = await service.preview(await service.scan(), 'move');
  await fs.writeFile(path.join(desktop, 'notes.pdf'), 'new content');
  await assert.rejects(service.organize(plan.token), /değişti/);
  assert.deepEqual(await service.history(), []);
});
test('a target created after preview is preserved', async (t) => {
  const { desktop, service } = await fixture(t);
  const plan = await service.preview(await service.scan(), 'move');
  await fs.mkdir(path.join(desktop, folders[3]));
  await fs.writeFile(path.join(desktop, folders[3], 'notes.pdf'), 'new target');
  await assert.rejects(service.organize(plan.token), /yeni bir dosya/);
  assert.equal(await fs.readFile(path.join(desktop, 'notes.pdf'), 'utf8'), 'important');
});
test('expired and consumed preview tokens cannot run', async (t) => {
  const { service } = await fixture(t);
  const plan = await service.preview(await service.scan(), 'copy');
  service.previews.get(plan.token).expires = 0;
  await assert.rejects(service.organize(plan.token), /süresi/);
  const next = await service.preview(await service.scan(), 'copy');
  await service.organize(next.token);
  await assert.rejects(service.organize(next.token), /süresi/);
});
test('undo refuses to overwrite a newly created original', async (t) => {
  const { desktop, service } = await fixture(t);
  await organize(service);
  await fs.writeFile(path.join(desktop, 'notes.pdf'), 'new');
  await assert.rejects(service.undo(), /Orijinal/);
  assert.equal(await fs.readFile(path.join(desktop, 'notes.pdf'), 'utf8'), 'new');
});
test('undo detects same-size content changes even with restored timestamps', async (t) => {
  const { desktop, service } = await fixture(t);
  await organize(service);
  const target = path.join(desktop, folders[3], 'notes.pdf');
  const stat = await fs.stat(target);
  await fs.writeFile(target, 'different');
  await fs.utimes(target, stat.atime, stat.mtime);
  await assert.rejects(service.undo(), /içeriği değişmiş/);
});
test('undo validates the whole batch before restoring its first file', async (t) => {
  const { desktop, service } = await fixture(t);
  await fs.writeFile(path.join(desktop, 'second.pdf'), 'second');
  await organize(service);
  await fs.writeFile(path.join(desktop, folders[3], 'notes.pdf'), 'edited');
  await assert.rejects(service.undo());
  assert.equal((await service.scan()).length, 0);
});
test('history survives a new service instance and undo remains functional', async (t) => {
  const { desktop, data, service } = await fixture(t);
  await organize(service);
  const restarted = new DesktopService(desktop, data);
  await restarted.undo();
  assert.equal(await fs.readFile(path.join(desktop, 'notes.pdf'), 'utf8'), 'important');
});
test('interrupted move after source removal recovers from the copied journal stage', async (t) => {
  const { desktop, service } = await fixture(t);
  await organize(service);
  const log = await service.history();
  log[0].entries[0].stage = 'copied';
  log[0].status = 'running';
  await service.save(log);
  await service.undo();
  assert.equal(await fs.readFile(path.join(desktop, 'notes.pdf'), 'utf8'), 'important');
});
test('interrupted restore resumes without overwriting the restored source', async (t) => {
  const { desktop, service } = await fixture(t);
  await organize(service);
  const log = await service.history();
  log[0].entries[0].stage = 'restoring';
  log[0].status = 'undoing';
  await service.save(log);
  await fs.copyFile(log[0].entries[0].target, log[0].entries[0].source);
  await service.undo();
  assert.equal(await fs.readFile(path.join(desktop, 'notes.pdf'), 'utf8'), 'important');
});
test(
  'undo cannot follow a replaced category directory symlink',
  {
    skip:
      process.platform === 'win32'
        ? 'Requires Windows symlink privileges; covered on Linux'
        : false,
  },
  async (t) => {
    const { desktop, root, service } = await fixture(t);
    await organize(service);
    await fs.rename(path.join(desktop, folders[3]), path.join(root, 'moved'));
    await fs.symlink(path.join(root, 'moved'), path.join(desktop, folders[3]));
    await assert.rejects(service.undo(), /sembolik/);
  },
);
test('malformed history and out-of-root journal paths block operations', async (t) => {
  const { desktop, data, service } = await fixture(t);
  await fs.mkdir(data);
  await fs.writeFile(service.log, '{bad');
  await assert.rejects(organize(service), /geçmişi/);
  await fs.writeFile(service.log, '[]');
  await organize(service);
  const log = await service.history();
  log[0].entries[0].source = path.join(desktop, '..', 'outside.pdf');
  await service.save(log);
  await assert.rejects(service.undo(), /güvenli olmayan/);
});
test('legacy v1 history can still be undone', async (t) => {
  const { desktop, service } = await fixture(t);
  const directory = path.join(desktop, folders[3]);
  await fs.mkdir(directory);
  const source = path.join(desktop, 'notes.pdf'),
    target = path.join(directory, 'notes.pdf');
  await fs.rename(source, target);
  const stat = await fs.stat(target);
  await service.save([
    {
      id: 'legacy',
      mode: 'move',
      entries: [{ source, target, size: stat.size, mtime: stat.mtimeMs, removed: true }],
      directories: [directory],
    },
  ]);
  await service.undo();
  assert.equal(await fs.readFile(source, 'utf8'), 'important');
});
test('progress reports completed files and overlapping mutations are rejected', async (t) => {
  const progress = [];
  const { service } = await fixture(t, { onProgress: (value) => progress.push(value) });
  service.busy = true;
  await assert.rejects(service.undo(), /sürüyor/);
  service.busy = false;
  await organize(service);
  assert.deepEqual(
    progress.map((p) => [p.completed, p.total]),
    [[1, 1]],
  );
});
test('settings persist without unknown fields and invalid values are rejected', async (t) => {
  const { data } = await fixture(t);
  const store = new SettingsStore(data);
  assert.deepEqual(await store.read(), defaults);
  await store.write({
    ...defaults,
    mode: 'copy',
    excludedExtensions: ['.TMP', '.tmp'],
    overrides: { 'notes.pdf': 0 },
    surprise: 'discard',
  });
  const saved = await new SettingsStore(data).read();
  assert.equal(saved.mode, 'copy');
  assert.deepEqual(saved.excludedExtensions, ['.tmp']);
  assert.equal(saved.overrides['notes.pdf'], 0);
  assert.equal(saved.surprise, undefined);
  await assert.rejects(store.write({ ...defaults, excludedExtensions: ['../bad'] }));
  await assert.rejects(store.write({ ...defaults, overrides: { '../file': 0 } }));
});
test('an uncertain copied-stage move never discards its only original-content backup', async (t) => {
  const { desktop, service } = await fixture(t);
  await organize(service);
  const log = await service.history();
  log[0].entries[0].stage = 'copied';
  log[0].status = 'interrupted';
  await service.save(log);
  await fs.writeFile(path.join(desktop, 'notes.pdf'), 'recreated');
  await assert.rejects(service.undo(), /kurtarma kopyası/);
  assert.equal(await fs.readFile(path.join(desktop, folders[3], 'notes.pdf'), 'utf8'), 'important');
});
test('a resumed deletion requires a verified restored source', async (t) => {
  const { desktop, service } = await fixture(t);
  await organize(service);
  const log = await service.history();
  log[0].entries[0].stage = 'deleting';
  log[0].status = 'undoing';
  await service.save(log);
  await assert.rejects(service.undo(), /kaynak değişmiş veya kayıp/);
  assert.equal(await fs.readFile(path.join(desktop, folders[3], 'notes.pdf'), 'utf8'), 'important');
});
test('moving and undoing preserve original modification time', async (t) => {
  const { desktop, service } = await fixture(t);
  const original = path.join(desktop, 'notes.pdf');
  const modified = new Date('2024-01-02T12:00:00.000Z');
  await fs.utimes(original, modified, modified);
  await organize(service);
  assert.ok(
    Math.abs(
      (await fs.stat(path.join(desktop, folders[3], 'notes.pdf'))).mtimeMs - modified.getTime(),
    ) < 2,
  );
  await service.undo();
  assert.ok(Math.abs((await fs.stat(original)).mtimeMs - modified.getTime()) < 2);
});
test('multiple batches undo in reverse order while retaining completed history', async (t) => {
  const { desktop, service } = await fixture(t);
  await organize(service, 'copy');
  await fs.writeFile(path.join(desktop, 'second.txt'), 'second');
  await organize(service, 'move', [{ id: 'second.txt', category: 3 }]);
  await service.undo();
  assert.equal(await fs.readFile(path.join(desktop, 'second.txt'), 'utf8'), 'second');
  await service.undo();
  assert.equal(await fs.readFile(path.join(desktop, 'notes.pdf'), 'utf8'), 'important');
  assert.ok((await service.history()).every((batch) => batch.status === 'undone'));
});
