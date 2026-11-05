const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ActivityStore } = require('./runtime/activity.cjs');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-activity-repair-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, store: new ActivityStore(root, () => 2000000) };
}
test('a damaged usage entry cannot break scanning or discard another favorite', async (t) => {
  const { root, store } = await fixture(t);
  await fs.writeFile(
    path.join(root, 'usage.json'),
    JSON.stringify({
      'broken.exe': null,
      'future.exe': { count: 'hundreds', firstSeen: 9999999, lastOpened: 9999999, favorite: 'yes' },
      'kept.exe': { count: 12, firstSeen: 1000000, lastOpened: 1900000, favorite: true },
    }),
  );
  const items = await store.annotate(
    ['broken.exe', 'future.exe', 'kept.exe'].map((id) => ({ id })),
  );
  assert.equal(items[0].usage.count, 0);
  assert.equal(items[1].usage.count, 0);
  assert.equal(items[1].usage.lastOpened, null);
  assert.equal(items[1].usage.favorite, false);
  assert.equal(items[2].usage.favorite, true);
  assert.equal(items[2].usage.count, 12);
  await store.record('broken.exe');
  const restarted = new ActivityStore(root, () => 2000000);
  const [broken, kept] = await restarted.annotate([{ id: 'broken.exe' }, { id: 'kept.exe' }]);
  assert.equal(broken.usage.count, 1);
  assert.equal(broken.usage.lastOpened, 2000000);
  assert.equal(kept.usage.count, 12);
  assert.equal(kept.usage.favorite, true);
});
test('concurrent launch and favorite writes retain usage and safe filename identities', async (t) => {
  const { store } = await fixture(t);
  await store.setFavorite('__proto__', true);
  await Promise.all([
    ...Array.from({ length: 20 }, () => store.record('__proto__')),
    store.setFavorite('__proto__', false),
    store.setFavorite('code.exe', true),
    ...Array.from({ length: 10 }, () => store.record('code.exe')),
  ]);
  const items = await store.annotate([{ id: '__proto__' }, { id: 'code.exe' }]);
  assert.equal(items[0].usage.count, 20);
  assert.equal(items[0].usage.favorite, false);
  assert.equal(items[1].usage.count, 10);
  assert.equal(items[1].usage.favorite, true);
  assert.equal({}.favorite, undefined);
});
