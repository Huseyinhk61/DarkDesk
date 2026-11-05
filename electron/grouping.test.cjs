const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  classificationReason,
  summarizeGroups,
  categoryTrail,
  sanitizeGroupView,
} = require('../shared/grouping.js');
const { defaultSettings, classify, defaultCategory } = require('../shared/domain.js');

test('assignment explanations honor manual choices, first enabled custom rules, catalog and protocol evidence', () => {
  const item = { id: 'chrome', name: 'Google Chrome.lnk' };
  const settings = structuredClone(defaultSettings);
  settings.overrides.chrome = 'office';
  settings.rules = [
    { id: 'rule', match: 'contains', pattern: 'Chrome', enabled: true, categoryId: 'games' },
  ];
  assert.deepEqual(classificationReason(item, settings), {
    categoryId: 'office',
    needsReview: false,
    source: 'manual',
    confidence: 'explicit',
  });
  delete settings.overrides.chrome;
  const rule = classificationReason(item, settings);
  assert.equal(rule.categoryId, 'games');
  assert.equal(rule.source, 'rule');
  assert.equal(rule.rulePattern, 'Chrome');
  settings.rules[0].enabled = false;
  const known = classificationReason(item, settings);
  assert.equal(known.categoryId, 'internetbrowsers');
  assert.equal(known.source, 'catalog');
  assert.equal(known.appName, 'Google Chrome');
  const game = classificationReason({
    id: 'game',
    name: 'Unknown title.url',
    launchUrl: 'steam://rungameid/730',
  });
  assert.equal(game.categoryId, 'games');
  assert.equal(game.source, 'protocol');
  assert.equal(game.needsReview, false);
});
test('review flags identify generic unknowns without questioning explicit choices or claiming document knowledge', () => {
  assert.equal(classificationReason({ id: 'unknown', name: 'unrecognized.bin' }).needsReview, true);
  const document = classificationReason({ id: 'report', name: 'report.pdf' });
  assert.equal(document.source, 'filetype');
  assert.equal(document.needsReview, false);
  const settings = structuredClone(defaultSettings);
  settings.overrides.unknown = 'system';
  assert.equal(
    classificationReason({ id: 'unknown', name: 'unrecognized.bin' }, settings).needsReview,
    false,
  );
  settings.overrides.unknown = 'deleted-group';
  assert.equal(
    classificationReason({ id: 'unknown', name: 'unrecognized.bin' }, settings).source,
    'fallback',
  );
  const keyword = classificationReason({ id: 'db', name: 'database_engine.custom' });
  assert.equal(keyword.source, 'heuristic');
  assert.equal(keyword.categoryId, 'softwaredatabase');
});
test('nested group totals include descendants, keep direct counts distinct, and preserve empty groups', () => {
  const categories = [
    { id: 'root', parentId: null },
    { id: 'child', parentId: 'root' },
    { id: 'leaf', parentId: 'child' },
    { id: 'empty', parentId: null },
  ];
  const summary = summarizeGroups(
    [
      { category: 'root', name: 'root.txt' },
      { category: 'child', name: 'editor.appimage' },
      { category: 'leaf', name: 'game.url' },
      { category: 'leaf', name: 'notes.pdf' },
      { category: 'missing', name: 'other.exe' },
    ],
    categories,
  );
  assert.deepEqual(summary.get('root'), { total: 4, apps: 2, files: 2, direct: 1 });
  assert.deepEqual(summary.get('child'), { total: 3, apps: 2, files: 1, direct: 1 });
  assert.deepEqual(summary.get('leaf'), { total: 2, apps: 1, files: 1, direct: 2 });
  assert.deepEqual(summary.get('empty'), { total: 0, apps: 0, files: 0, direct: 0 });
  assert.deepEqual(
    categoryTrail('leaf', categories).map((category) => category.id),
    ['root', 'child', 'leaf'],
  );
});
test('group summaries stop on malformed category cycles and view preferences reject unrelated cached fields', () => {
  const categories = [
    { id: 'a', parentId: 'b' },
    { id: 'b', parentId: 'a' },
  ];
  const summary = summarizeGroups([{ name: 'file.txt', category: 'a' }], categories);
  assert.equal(summary.get('a').total, 1);
  assert.equal(summary.get('b').total, 1);
  assert.equal(categoryTrail('a', categories).length, 2);
  assert.deepEqual(
    sanitizeGroupView({ sort: 'script', showEmpty: 'yes', overrides: { x: 'system' } }),
    { sort: 'manual', showEmpty: true },
  );
  assert.deepEqual(sanitizeGroupView({ sort: 'count', showEmpty: false }), {
    sort: 'count',
    showEmpty: false,
  });
});

test('source and media types stay in their groups even when filenames contain installer keywords', () => {
  for (const [name, category] of [
    ['setup_cache.go', 'software'],
    ['budget_cache.go', 'software'],
    ['course_thumbnail.psd', 'design'],
    ['invoice_recording.flac', 'media'],
    ['driver_update.js', 'software'],
    ['installer_project.rs', 'software'],
    ['update_photo.psd', 'design'],
    ['driver_recording.flac', 'media'],
    ['setup_music.ogg', 'media'],
    ['annual_report.rtf', 'office'],
    ['backup_driver.zip', 'systemcompression'],
    ['setup_archive.tar.gz', 'systemcompression'],
  ]) {
    assert.equal(classify({ id: name, name }), category, name);
    assert.equal(classificationReason({ id: name, name }).source, 'filetype', name);
  }
  assert.equal(defaultCategory('backup.zip'), 'system');
  assert.equal(classify({ name: 'budget_2026.xlsx' }), 'financeaccounting');
  assert.equal(classificationReason({ name: 'budget_2026.xlsx' }).source, 'heuristic');
  assert.equal(classify({ name: 'course_notes.pdf' }), 'learningcourses');
  assert.equal(classify({ name: 'course.blob' }), 'learningcourses');
  assert.equal(classify({ name: 'budget.epub' }), 'learningreading');
  assert.equal(classify({ name: 'GPU_driver_setup.exe' }), 'systeminstallers');
  const settings = structuredClone(defaultSettings);
  settings.rules = [
    { id: 'custom', match: 'extension', pattern: 'zip', enabled: true, categoryId: 'archive' },
  ];
  assert.equal(classify({ name: 'backup.zip' }, settings), 'archive');
});
