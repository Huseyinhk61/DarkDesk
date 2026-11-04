const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { DesktopService } = require('./service.cjs');
const { DeepScanner } = require('./scanner.cjs');
const { readInternetShortcut } = require('./internet-shortcut.cjs');
const { AutomationService } = require('./runtime/automation.cjs');
const { defaults } = require('./settings.cjs');
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-coverage-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop'),
    sharedDesktop = path.join(root, 'Public Desktop'),
    data = path.join(root, 'data');
  await fs.mkdir(desktop);
  await fs.mkdir(sharedDesktop);
  const service = new DesktopService(desktop, data, { sharedDesktop, ...options });
  return { root, desktop, sharedDesktop, data, service };
}
test('personal and common desktop discovery categorizes the reported applications and keeps identities distinct', async (t) => {
  const { desktop, sharedDesktop, service } = await fixture(t);
  const apps = [
    ['DaVinci Resolve', 'design'],
    ['AnyDesk', 'systemnetwork'],
    ['FlutterFlow', 'softwareide'],
    ['VMware Workstation Pro', 'softwaredevops'],
    ['Epic Games Launcher', 'games'],
    ['Windhawk', 'systemutilities'],
    ['OBS Studio', 'design'],
  ];
  for (const [name] of apps)
    await fs.writeFile(path.join(sharedDesktop, name + '.lnk'), 'shortcut');
  await fs.writeFile(path.join(desktop, 'AnyDesk.lnk'), 'personal shortcut');
  const items = await service.scan();
  assert.equal(items.length, 8);
  for (const [name, category] of apps) {
    const item = items.find((i) => i.shared && i.name === name + '.lnk');
    assert.equal(item.category, category, name);
    assert.equal(item.insight.confidence, 'known', name);
    assert.ok(item.insight.description.tr);
    assert.ok(item.insight.description.en);
  }
  const duplicates = items.filter((i) => i.name === 'AnyDesk.lnk');
  assert.notEqual(duplicates[0].id, duplicates[1].id);
  assert.equal(service.scanReport.sources.find((s) => s.scope === 'shared').count, 7);
  assert.equal(service.scanReport.total, 8);
  const plan = await service.preview(
    duplicates.map((i) => ({ id: i.id, category: i.category })),
    'move',
  );
  assert.equal(plan.ready, 1);
  assert.equal(plan.conflicts, 1);
  await assert.rejects(
    service.preview([{ id: 'shared:forged', category: 'system' }], 'move'),
    /CATEGORY_INVALID/,
  );
});
test('common desktop move and undo preserve shortcut bytes and copies leave the original intact', async (t) => {
  const { sharedDesktop, service } = await fixture(t);
  const source = path.join(sharedDesktop, 'FlutterFlow.lnk');
  await fs.writeFile(source, 'real shortcut bytes');
  let [item] = await service.scan();
  let plan = await service.preview([{ id: item.id, category: item.category }], 'move');
  assert.equal(plan.entries[0].sourceScope, 'shared');
  assert.equal(plan.entries[0].action, 'move');
  await service.organize(plan.token);
  await assert.rejects(fs.stat(source), { code: 'ENOENT' });
  await service.scan();
  await service.undo();
  assert.equal(await fs.readFile(source, 'utf8'), 'real shortcut bytes');
  [item] = await service.scan();
  plan = await service.preview([{ id: item.id, category: item.category }], 'copy');
  await service.organize(plan.token);
  assert.equal(await fs.readFile(source, 'utf8'), 'real shortcut bytes');
  await service.undo();
  assert.equal(await fs.readFile(source, 'utf8'), 'real shortcut bytes');
});
test('denied common-source removal is reported while later personal files still move and undo safely', async (t) => {
  let blocked;
  const { desktop, sharedDesktop, service } = await fixture(t, {
    removeSource: async (source) => {
      if (source === blocked) throw Object.assign(Error('denied'), { code: 'EPERM' });
      await fs.unlink(source);
    },
  });
  blocked = path.join(sharedDesktop, 'A shared.lnk');
  const personal = path.join(desktop, 'Z report.pdf');
  await fs.writeFile(blocked, 'shared original');
  await fs.writeFile(personal, 'personal original');
  const items = await service.scan();
  const plan = await service.preview(
    items.map((i) => ({ id: i.id, category: 'office' })),
    'move',
  );
  await assert.rejects(service.organize(plan.token), /SHARED_DESKTOP_ACCESS/);
  assert.equal(await fs.readFile(blocked, 'utf8'), 'shared original');
  await assert.rejects(fs.stat(personal), { code: 'ENOENT' });
  const [batch] = await service.history();
  assert.equal(batch.status, 'interrupted');
  assert.equal(batch.summary.moved, 1);
  assert.equal(batch.summary.copied, 1);
  assert.equal(batch.summary.failed, 1);
  await service.undo();
  assert.equal(await fs.readFile(personal, 'utf8'), 'personal original');
  assert.equal(await fs.readFile(blocked, 'utf8'), 'shared original');
});
test('missing common desktop preserves user results and exclusions are reported', async (t) => {
  const { desktop, sharedDesktop, service } = await fixture(t);
  await fs.rm(sharedDesktop, { recursive: true });
  await fs.writeFile(path.join(desktop, 'Report.pdf'), 'document');
  await fs.writeFile(path.join(desktop, 'desktop.ini'), 'config');
  await fs.mkdir(path.join(desktop, 'Existing folder'));
  assert.equal((await service.scan()).length, 1);
  assert.equal(service.scanReport.sources[1].status, 'missing');
  assert.equal(service.scanReport.excluded.folders, 1);
  assert.equal(service.scanReport.excluded.extensions, 1);
});
test('common sources are excluded from automatic archiving and a forged automatic shared plan is refused', async (t) => {
  const { desktop, sharedDesktop, service, data } = await fixture(t);
  const old = new Date(Date.now() - 90 * 86400000);
  for (const root of [desktop, sharedDesktop]) {
    const file = path.join(root, 'old.txt');
    await fs.writeFile(file, 'old');
    await fs.utimes(file, old, old);
  }
  const automation = new AutomationService(service, data);
  const settings = structuredClone(defaults);
  const candidates = await automation.preview(settings);
  assert.equal(candidates.archive.length, 1);
  assert.equal(candidates.archive[0].shared, false);
  const shared = (await service.scan()).find((i) => i.shared);
  const plan = await service.preview([{ id: shared.id, category: 'archive' }], 'move');
  await assert.rejects(
    service.organize(plan.token, 'automation-archive'),
    /SHARED_DESKTOP_MANUAL_ONLY/,
  );
  assert.equal(await fs.readFile(shared.source, 'utf8'), 'old');
});
test('a substituted common desktop symlink cannot redirect scan, an existing preview, or undo', async (t) => {
  const { root, sharedDesktop, service } = await fixture(t);
  const source = path.join(sharedDesktop, 'App.lnk');
  await fs.writeFile(source, 'original');
  const [item] = await service.scan();
  const plan = await service.preview([{ id: item.id, category: 'games' }], 'move');
  const moved = path.join(root, 'original common');
  await fs.rename(sharedDesktop, moved);
  try {
    await fs.symlink(moved, sharedDesktop, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (e) {
    if (e.code === 'EPERM') return t.skip('Symlink privilege unavailable');
    throw e;
  }
  assert.equal((await service.scan()).length, 0);
  assert.equal(service.scanReport.sources[1].status, 'error');
  await assert.rejects(service.organize(plan.token), /SHARED_DESKTOP_ACCESS/);
  assert.equal(await fs.readFile(path.join(moved, 'App.lnk'), 'utf8'), 'original');
});
test('UTF-8 and UTF-16 game InternetShortcuts are read locally by desktop and deep scanners with bounded input', async (t) => {
  const { desktop, service } = await fixture(t);
  for (const [name, body] of [
    ['Counter-Strike 2.url', Buffer.from('[InternetShortcut]\r\nURL=steam://rungameid/730\r\n')],
    [
      'Fortnite.url',
      Buffer.concat([
        Buffer.from([255, 254]),
        Buffer.from(
          '[InternetShortcut]\r\nURL=com.epicgames.launcher://apps/Fortnite?action=launch&silent=true\r\n',
          'utf16le',
        ),
      ]),
    ],
  ])
    await fs.writeFile(path.join(desktop, name), body);
  const items = await service.scan();
  assert.equal(items.length, 2);
  for (const item of items) {
    assert.equal(item.category, 'games');
    assert.ok(item.launchUrl);
    assert.equal(item.insight.confidence, 'inferred');
  }
  const scanner = new DeepScanner({
    platform: 'win32',
    roots: [{ path: desktop, label: 'startUser' }],
  });
  assert.ok((await scanner.scan(defaults)).items.every((i) => i.category === 'games'));
  const huge = path.join(desktop, 'huge.url');
  await fs.writeFile(huge, Buffer.alloc(65537));
  await assert.rejects(readInternetShortcut(huge), /SHORTCUT_TOO_LARGE/);
  const malformed = path.join(desktop, 'invalid.url');
  await fs.writeFile(malformed, 'URL=steam://rungameid/730');
  assert.deepEqual(await readInternetShortcut(malformed), {});
});
