const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  defaultSettings,
  defaultCategories,
  classify,
  categorySegments,
} = require('../shared/domain.js');
const { validateSettings } = require('../shared/validate.js');
const { appInsight } = require('../shared/app-insights.js');
const { DesktopService } = require('./service.cjs');
const additions = new Set([
  'internet',
  'learning',
  'finance',
  'internetbrowsers',
  'internetchat',
  'internetmeetings',
  'learningcourses',
  'learningreading',
  'financeaccounting',
]);
function legacySettings() {
  return {
    ...structuredClone(defaultSettings),
    schemaVersion: 3,
    categories: structuredClone(
      defaultCategories.filter((category) => !additions.has(category.id)),
    ),
  };
}
test('v3 preferences gain useful new groups once and preserve prior user choices and paths', () => {
  const old = legacySettings();
  old.mode = 'copy';
  old.profiles[0].categories = ['software'];
  old.overrides = { 'Chrome.lnk': 'office' };
  old.rules = [
    { id: 'personal', match: 'contains', pattern: 'Anki', categoryId: 'archive', enabled: true },
  ];
  old.categories.find((category) => category.id === 'office').folder = 'My Documents';
  const value = validateSettings(old);
  assert.equal(value.schemaVersion, 4);
  assert.equal(value.categories.filter((category) => !category.parentId).length, 10);
  assert.equal(value.categories.length, 25);
  assert.equal(value.mode, 'copy');
  assert.deepEqual(value.profiles[0].categories, ['software']);
  assert.equal(value.overrides['Chrome.lnk'], 'office');
  assert.equal(classify({ id: 'Chrome.lnk', name: 'Chrome.lnk' }, value), 'office');
  assert.equal(classify({ name: 'Anki.exe' }, value), 'archive');
  assert.deepEqual(categorySegments('office', value.categories), ['My Documents']);
  assert.deepEqual(validateSettings(value), value);
});
test('migration does not resurrect old deleted roots, later deletions or conflicting custom paths', () => {
  const old = legacySettings();
  old.categories = old.categories.filter(
    (category) => category.id !== 'system' && category.parentId !== 'system',
  );
  const migrated = validateSettings(old);
  assert.ok(!migrated.categories.some((category) => category.id === 'system'));
  assert.ok(!migrated.categories.some((category) => category.id === 'systemnetwork'));
  migrated.categories = migrated.categories.filter(
    (category) => category.id !== 'internet' && category.parentId !== 'internet',
  );
  assert.ok(!validateSettings(migrated).categories.some((category) => category.id === 'internet'));
  for (const version of [2, 3]) {
    const custom = legacySettings();
    custom.schemaVersion = version;
    custom.categories.push({
      id: 'mine',
      name: 'Personal web',
      folder: 'İnternet & İletişim',
      parentId: null,
      icon: 'globe',
      color: 'blue',
    });
    const preserved = validateSettings(custom);
    assert.ok(preserved.categories.some((category) => category.id === 'mine'));
    assert.ok(!preserved.categories.some((category) => category.id === 'internet'));
    assert.ok(!preserved.categories.some((category) => category.parentId === 'internet'));
  }
});
test('new groups identify communications, learning and financial work without reclassifying ordinary documents', () => {
  const cases = [
    ['chrome.exe', 'internetbrowsers'],
    ['Discord.lnk', 'internetchat'],
    ['Zoom.exe', 'internetmeetings'],
    ['Anki.exe', 'learningcourses'],
    ['calibre.exe', 'learningreading'],
    ['GnuCash.exe', 'financeaccounting'],
    ['2026 budget.xlsx', 'financeaccounting'],
    ['Ders Notları.pdf', 'learningcourses'],
    ['Novel.epub', 'learningreading'],
    ['Report.pdf', 'office'],
  ];
  for (const [name, category] of cases) assert.equal(classify({ name }), category, name);
  assert.equal(appInsight({ name: 'unknown-program.exe' }, 'internetmeetings').source, 'category');
  assert.match(
    appInsight({ name: 'unknown-program.exe' }, 'internetmeetings').description.en,
    /estimate/,
  );
  // A deleted Internet group should fall back to a related legacy group rather than Software.
  assert.equal(classify({ name: 'chrome.exe' }, legacySettings()), 'systemnetwork');
});
test('a historical file operation still undoes after preference groups are migrated', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-group-migration-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop');
  await fs.mkdir(desktop);
  await fs.writeFile(path.join(desktop, 'Report.pdf'), 'original document');
  const service = new DesktopService(desktop, path.join(root, 'data'));
  service.settings = legacySettings();
  const plan = await service.preview([{ id: 'Report.pdf', category: 'office' }], 'move');
  const batch = await service.organize(plan.token);
  service.settings = validateSettings(service.settings);
  await service.undo();
  assert.equal(await fs.readFile(path.join(desktop, 'Report.pdf'), 'utf8'), 'original document');
  assert.equal(batch.categoryPaths[0], 'Ofis & Dokümanlar');
});
