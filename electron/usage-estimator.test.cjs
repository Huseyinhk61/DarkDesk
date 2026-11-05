const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estimateUsage } = require('../shared/usage-estimator.js');
const catalog = require('../shared/catalog.json');

const day = 86400000;
const now = Date.UTC(2026, 10, 5, 12);
const item = (category, usage) => ({ name: 'Example.exe', category, usage });
const history = (count, seenDays, lastDays) => ({
  scope: 'darkdesk-only',
  count,
  firstSeen: now - seenDays * day,
  lastOpened: now - lastDays * day,
});

test('unobserved IDEs, browsers, utilities and documents receive nonempty category estimates', () => {
  assert.equal(estimateUsage(item('softwareide'), catalog, now).pattern, 'intensive');
  assert.equal(estimateUsage(item('internetbrowsers'), catalog, now).pattern, 'continuous');
  assert.equal(estimateUsage(item('systeminstallers'), catalog, now).pattern, 'onDemand');
  assert.equal(estimateUsage(item('office'), catalog, now).pattern, 'regular');
  for (const category of catalog) {
    const estimated = estimateUsage(item(category.id), catalog, now);
    assert.equal(estimated.source, 'category');
    assert.match(estimated.labelKey, /^usageEstimate\.category\.[a-zA-Z]+$/);
    assert.equal(estimated.noteKey, 'usageEstimate.categoryNote');
  }
  assert.equal(estimateUsage({ name: 'Google Chrome.exe' }, catalog, now).pattern, 'continuous');
  assert.equal(estimateUsage(null, catalog, now).pattern, 'onDemand');
  for (const categories of [null, {}, [null, 'software']])
    assert.ok(estimateUsage(item('softwareide'), categories, now).labelKey);
});

test('custom category ancestry determines the estimate without keyword guessing or infinite loops', () => {
  const categories = [
    ...catalog,
    { id: 'teamTools', parentId: 'softwareide' },
    { id: 'experiments', parentId: 'teamTools' },
    { id: 'myBrowserNamedFiles', parentId: null },
    { id: 'cycleA', parentId: 'cycleB' },
    { id: 'cycleB', parentId: 'cycleA' },
  ];
  assert.equal(estimateUsage(item('experiments'), categories, now).pattern, 'intensive');
  assert.equal(estimateUsage(item('myBrowserNamedFiles'), categories, now).pattern, 'onDemand');
  assert.equal(estimateUsage(item('cycleA'), categories, now).pattern, 'onDemand');
  assert.equal(
    estimateUsage({ name: 'Chrome.exe', category: 'office' }, categories, now).pattern,
    'regular',
    'An explicit category wins over recognized-app fallback',
  );
});

test('valid DarkDesk launch history takes priority and uses observation duration and recency', () => {
  const intensive = estimateUsage(item('system', history(35, 28, 1)), catalog, now);
  assert.equal(intensive.source, 'history');
  assert.equal(intensive.pattern, 'intensive');
  assert.deepEqual(intensive.params, { count: 35 });
  assert.equal(intensive.noteKey, 'usageEstimate.historyNote');
  assert.equal(estimateUsage(item('games', history(12, 28, 3)), catalog, now).pattern, 'frequent');
  assert.equal(
    estimateUsage(item('softwareide', history(1, 14, 2)), catalog, now).pattern,
    'recent',
  );
  assert.equal(
    estimateUsage(item('softwareide', history(10, 180, 30)), catalog, now).pattern,
    'previous',
  );
  assert.equal(
    estimateUsage(item('internetbrowsers', history(600, 800, 120)), catalog, now).pattern,
    'inactive',
  );
  assert.equal(
    estimateUsage(item('softwareide', history(200, 1, 0)), catalog, now).pattern,
    'recent',
    'A short observation window is not extrapolated into an established habit',
  );
});

test('missing, malformed, untrusted or future launch data safely falls back without invented telemetry', () => {
  for (const usage of [
    undefined,
    null,
    {},
    history(0, 14, 1),
    history(-1, 14, 1),
    history(1.5, 14, 1),
    history('20', 14, 1),
    history(Number.POSITIVE_INFINITY, 14, 1),
    { ...history(5, 14, 1), scope: 'windows-global' },
    { ...history(5, 14, 1), lastOpened: null },
    { ...history(5, 14, 1), lastOpened: -42 },
    { ...history(5, 14, 1), lastOpened: String(now) },
    history(5, 14, -1),
  ]) {
    const result = estimateUsage(item('softwareide', usage), catalog, now);
    assert.equal(result.source, 'category');
    assert.equal(result.pattern, 'intensive');
    assert.deepEqual(result.params, {});
  }
  for (const clock of [NaN, -1, Infinity, '2026-11-05'])
    assert.equal(
      estimateUsage(item('office', history(3, 14, 1)), catalog, clock).source,
      'category',
    );
  const futureFirstSeen = { ...history(500, 14, 1), firstSeen: now + day };
  assert.equal(estimateUsage(item('office', futureFirstSeen), catalog, now).pattern, 'recent');
});
