const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DesktopRuntime } = require('./runtime/controller.cjs');
const { DeepScanner } = require('./scanner.cjs');
const { classify, defaultSettings } = require('../shared/domain.js');
const { classificationReason } = require('../shared/grouping.js');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-location-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop'),
    system = path.join(root, 'Installed'),
    custom = path.join(root, 'My apps');
  await Promise.all([desktop, system, custom].map((p) => fs.mkdir(p)));
  await fs.mkdir(path.join(custom, 'node_modules'));
  await fs.mkdir(path.join(custom, 'nested'));
  await fs.writeFile(path.join(system, 'Firefox.exe'), 'system app');
  await fs.writeFile(path.join(custom, 'Krita.exe'), 'selected app');
  await fs.writeFile(path.join(custom, 'nested', 'HeidiSQL.exe'), 'nested app');
  await fs.writeFile(path.join(custom, 'node_modules', 'ignored.exe'), 'noise');
  await fs.writeFile(path.join(custom, 'ignored.dll'), 'not application');
  const runtime = new DesktopRuntime({
    desktop,
    downloads: path.join(root, 'Downloads'),
    data: path.join(root, 'data'),
    platform: 'linux',
  });
  runtime.scanner = new DeepScanner({
    roots: [{ path: system, label: 'programFiles' }],
    platform: 'linux',
  });
  return { root, desktop, system, custom, runtime };
}
test('a selected location is isolated from installed/desktop results, filters noise, and only previews shortcuts', async (t) => {
  const f = await fixture(t);
  await f.runtime.scanSystem();
  const result = await f.runtime.scanLocation(f.custom);
  assert.equal(result.path, await fs.realpath(f.custom));
  assert.deepEqual(result.items.map((i) => i.name).sort(), ['HeidiSQL.exe', 'Krita.exe']);
  assert.equal(result.items.find((i) => i.name === 'Krita.exe').category, 'design');
  assert.equal((await f.runtime.scan('system'))[0].name, 'Firefox.exe');
  assert.equal((await f.runtime.scan('custom')).length, 2);
  assert.equal((await f.runtime.scan('desktop')).length, 0);
  assert.equal(f.runtime.indexedApps.catalog.size, 3);
  assert.ok((await f.runtime.entries()).items.some((i) => i.name === 'Krita.exe'));
  assert.equal((await f.runtime.resolveTrustedItem(result.items[0].id)).id, result.items[0].id);
  const app = result.items[0];
  const plan = await f.runtime.preview([{ id: app.id, category: app.category }], 'move');
  assert.equal(plan.entries[0].action, 'shortcut');
  assert.equal(await fs.readFile(path.join(f.custom, 'Krita.exe'), 'utf8'), 'selected app');
  await assert.rejects(
    f.runtime.scanLocation(path.join(f.custom, 'Krita.exe')),
    /SCAN_LOCATION_INVALID/,
  );
  assert.equal((await f.runtime.scan('custom')).length, 2);
  const empty = path.join(f.root, 'Empty');
  await fs.mkdir(empty);
  await f.runtime.scanLocation(empty);
  assert.equal((await f.runtime.scan('custom')).length, 0);
  assert.equal(f.runtime.indexedApps.catalog.size, 1);
});
test('selected scanner rejects path injection and symbolic-link roots before changing the index', async (t) => {
  const f = await fixture(t);
  for (const value of ['', null, 42, 'relative', '/bad\0path'])
    await assert.rejects(f.runtime.scanLocation(value), /SCAN_LOCATION_INVALID/);
  const link = path.join(f.root, 'redirect');
  try {
    await fs.symlink(f.custom, link, 'junction');
  } catch (e) {
    if (e.code === 'EPERM') return;
    throw e;
  }
  await assert.rejects(f.runtime.scanLocation(link), /SCAN_LOCATION_INVALID/);
  assert.equal(f.runtime.locationPath, null);
});
test('popular tools, decorated versions and bounded purpose hints keep user choices authoritative', () => {
  const cases = [
    ['Krita.exe', 'design'],
    ['Blender4.5.exe', 'design'],
    ['TeamViewer15.exe', 'systemnetwork'],
    ['Rufus4.6.exe', 'system'],
    ['CapCut.lnk', 'design'],
    ['HeidiSQL.exe', 'softwaredatabase'],
    ['Tailscale.exe', 'systemnetwork'],
    ['Local LLM Manager.exe', 'ailocal'],
    ['PhotoEditor.exe', 'design'],
    ['Private.exe', 'design', 'Photo and image editor for editing pictures'],
  ];
  for (const [name, category, fileDescription] of cases) {
    const item = { id: name, name, fileDescription };
    assert.equal(classify(item), category, name);
    assert.equal(classify(item, { ...defaultSettings, overrides: { [name]: 'office' } }), 'office');
  }
  assert.equal(classificationReason({ name: 'Opaque Custom App.exe' }).needsReview, true);
  assert.notEqual(classify({ name: 'AudioCodecs.exe' }), 'softwareide');
  assert.equal(classify({ name: 'ImageEditor.jpg' }), 'design');
});
