const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ActivityStore } = require('./runtime/activity.cjs');
const { searchEntries } = require('../shared/launcher.js');

test('three most-used apps precede commands and deduplicate persisted favorites', () => {
  const entries = [
    { id: 'command', name: 'Open DarkDesk', command: { type: 'show' } },
    ...[2, 6, 4, 1].map((count) => ({
      id: String(count),
      name: 'App ' + count,
      usage: { count, favorite: count === 6 },
    })),
    { id: 'pinned', name: 'Pinned app', usage: { count: 0, favorite: true } },
  ];
  const ranked = searchEntries('', entries);
  assert.deepEqual(
    ranked.slice(0, 3).map((e) => e.id),
    ['6', '4', '2'],
  );
  assert.ok(ranked.slice(0, 3).every((e) => e.section === 'frequent'));
  assert.equal(ranked[3].id, 'pinned');
  assert.equal(ranked.filter((e) => e.id === '6').length, 1);
  assert.equal(searchEntries('Open DarkDesk', entries)[0].id, 'command');
});
test('application-name matches outrank incidental words in long descriptions', () => {
  const items = [
    {
      id: 'code',
      name: 'Visual Studio Code',
      searchText:
        'Visual Studio Code C:/Code.exe A code editor for writing and organizing applications',
    },
    { id: 'figma', name: 'Figma', searchText: 'Figma visual software collaboration tool' },
  ];
  assert.equal(searchEntries('vsc', items)[0].id, 'code');
});
test('favorites persist without changing observed usage and reject invalid changes', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-favorite-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ActivityStore(root, () => 1000000);
  await store.record('code.exe');
  await store.setFavorite('code.exe', true);
  const [item] = await new ActivityStore(root).annotate([{ id: 'code.exe' }]);
  assert.equal(item.usage.favorite, true);
  assert.equal(item.usage.count, 1);
  assert.equal(item.usage.lastOpened, 1000000);
  await store.setFavorite('code.exe', false);
  assert.equal((await store.annotate([{ id: 'code.exe' }]))[0].usage.favorite, false);
  await assert.rejects(store.setFavorite('code.exe', 'yes'), /FAVORITE_INVALID/);
  await assert.rejects(store.setFavorite('', true), /FAVORITE_INVALID/);
});
