const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { DesktopRuntime } = require('./runtime/controller.cjs');
const { LauncherCatalog } = require('./runtime/launcher-catalog.cjs');
const { defaultSettings, categorySegments } = require('../shared/domain.js');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-launcher-index-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop'),
    downloads = path.join(root, 'Downloads'),
    data = path.join(root, 'data');
  await fs.mkdir(desktop);
  await fs.mkdir(downloads);
  const id = 'Editor.lnk',
    source = path.join(desktop, id);
  await fs.writeFile(source, 'an original shortcut');
  const launched = [];
  const options = {
    desktop,
    downloads,
    data,
    platform: 'linux',
    launch: async (item) => launched.push(item.source),
  };
  const runtime = new DesktopRuntime(options);
  const target = path.join(
    desktop,
    ...categorySegments('software', defaultSettings.categories),
    id,
  );
  return { root, desktop, downloads, data, id, source, target, runtime, options, launched };
}
async function organize(f, mode = 'move', category = 'software', id = f.id) {
  await f.runtime.scan();
  const plan = await f.runtime.preview([{ id, category }], mode);
  return f.runtime.organize(plan.token);
}

test('move preserves the launcher identity, favorites and usage through undo and restart', async (t) => {
  const f = await fixture(t);
  await f.runtime.scan();
  await f.runtime.setFavorite(f.id, true);
  await f.runtime.launch(f.id);
  await organize(f);
  let item = (await f.runtime.entries()).items.find((item) => item.id === f.id);
  assert.equal(item.source, f.target);
  assert.equal(item.scope, 'managed');
  assert.equal(item.category, 'software');
  assert.equal(item.usage.favorite, true);
  assert.equal(item.usage.count, 1);
  await f.runtime.launch(f.id);
  assert.equal(f.launched.at(-1), f.target);
  const restarted = new DesktopRuntime(f.options);
  item = (await restarted.entries()).items.find((item) => item.id === f.id);
  assert.equal(item.source, f.target);
  assert.equal(item.usage.favorite, true);
  assert.equal(item.usage.count, 2);
  await restarted.undo();
  item = (await restarted.entries()).items.find((item) => item.id === f.id);
  assert.equal(item.source, f.source);
  assert.equal(item.managed, undefined);
  assert.equal(item.usage.favorite, true);
  await restarted.launch(f.id);
  assert.equal(f.launched.at(-1), f.source);
});

test('copy prefers the original file and uses a verified managed copy only when the original disappears', async (t) => {
  const f = await fixture(t);
  await organize(f, 'copy');
  assert.equal((await f.runtime.entries()).items.find((item) => item.id === f.id).source, f.source);
  await fs.unlink(f.source);
  const restarted = new DesktopRuntime(f.options);
  assert.equal((await restarted.entries()).items.find((item) => item.id === f.id).source, f.target);
  await restarted.launch(f.id);
  assert.equal(f.launched.at(-1), f.target);
  await restarted.undo();
  assert.equal(
    (await restarted.entries()).items.some((item) => item.id === f.id),
    false,
  );
  await assert.rejects(restarted.launch(f.id), /SOURCE_MISSING/);
});

test('moved Downloads files retain their source-derived identity after restarting', async (t) => {
  const f = await fixture(t);
  const source = path.join(f.downloads, 'Notes.pdf');
  await fs.writeFile(source, 'download bytes');
  const [download] = await f.runtime.scan('downloads');
  await f.runtime.setFavorite(download.id, true);
  await organize(f, 'move', 'office', download.id);
  const restarted = new DesktopRuntime(f.options);
  const item = (await restarted.entries()).items.find((item) => item.id === download.id);
  assert.equal(item.name, 'Notes.pdf');
  assert.equal(item.scope, 'managed');
  assert.equal(item.category, 'office');
  assert.equal(item.usage.favorite, true);
  await restarted.undo();
  assert.equal(
    (await restarted.entries()).items.some((item) => item.id === download.id),
    false,
  );
  await restarted.scan('downloads');
  assert.equal(
    (await restarted.entries()).items.find((item) => item.id === download.id).source,
    source,
  );
});

test('installed executable authority is kept while an owned shortcut remains discoverable after restart', async (t) => {
  const f = await fixture(t);
  const directory = path.join(f.root, 'Applications');
  await fs.mkdir(directory);
  const source = path.join(directory, 'Studio.exe');
  await fs.writeFile(source, 'installed program');
  const stat = await fs.stat(source);
  const id =
    'app:' +
    crypto
      .createHash('sha256')
      .update(path.resolve(source) + '\0')
      .digest('hex')
      .slice(0, 24);
  const app = {
    id,
    name: 'Studio.exe',
    source,
    target: source,
    arguments: '',
    kind: 'installed',
    size: stat.size,
    modified: stat.mtimeMs,
  };
  f.runtime.scanner.catalog.set(id, app);
  await f.runtime.scan('system');
  await f.runtime.setFavorite(id, true);
  await organize(f, 'move', 'design', id);
  let item = (await f.runtime.entries()).items.find((item) => item.id === id);
  assert.equal(item.source, source);
  assert.equal(item.kind, 'installed');
  assert.equal(item.managed, undefined);
  const restarted = new DesktopRuntime(f.options);
  item = (await restarted.entries()).items.find((item) => item.id === id);
  assert.equal(path.extname(item.source), '.desktop');
  assert.equal(item.usage.favorite, true);
  await restarted.launch(id);
  assert.equal(f.launched.at(-1), item.source);
  restarted.scanner.catalog.set(id, app);
  item = (await restarted.entries()).items.find((item) => item.id === id);
  assert.equal(item.source, source);
  assert.equal(item.kind, 'installed');
});

test('deleted desktop and installed sources are pruned instead of returning stale launcher results', async (t) => {
  const f = await fixture(t);
  const appSource = path.join(f.root, 'OldApp.exe');
  await fs.writeFile(appSource, 'old app');
  f.runtime.scanner.catalog.set('app:stale', {
    id: 'app:stale',
    name: 'OldApp.exe',
    source: appSource,
    kind: 'installed',
  });
  assert.equal((await f.runtime.entries()).items.length, 2);
  await fs.unlink(f.source);
  await fs.unlink(appSource);
  assert.deepEqual((await f.runtime.entries()).items, []);
  await assert.rejects(f.runtime.launch(f.id), /SOURCE_MISSING/);
  await assert.rejects(f.runtime.launch('app:stale'), /SOURCE_MISSING/);
});

test('managed integrity cache rejects content tampering even when file size and modification time are preserved', async (t) => {
  const f = await fixture(t);
  await organize(f);
  const fixedTime = new Date('2026-01-01T00:00:00Z');
  await fs.utimes(f.target, fixedTime, fixedTime);
  await f.runtime.entries();
  const before = await fs.stat(f.target);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await fs.writeFile(f.target, 'a modified shortcut!');
  assert.equal((await fs.stat(f.target)).size, before.size);
  await fs.utimes(f.target, before.atime, before.mtime);
  assert.equal((await fs.stat(f.target)).mtimeMs, before.mtimeMs);
  await assert.rejects(f.runtime.resolveTrustedItem(f.id), /SOURCE_MISSING/);
  await assert.rejects(f.runtime.launch(f.id), /SOURCE_MISSING/);
  assert.equal(
    (await f.runtime.entries()).items.some((item) => item.id === f.id),
    false,
  );
  assert.equal(f.launched.length, 0);
});

test('a category-directory junction or symlink cannot redirect the recovered launcher', async (t) => {
  const f = await fixture(t);
  await organize(f);
  await f.runtime.entries();
  const folder = path.dirname(f.target),
    original = path.join(f.root, 'original-category');
  await fs.rename(folder, original);
  const outside = path.join(f.root, 'outside-category');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, f.id), 'an original shortcut');
  await fs.symlink(outside, folder, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.runtime.resolveTrustedItem(f.id), /SOURCE_MISSING/);
  assert.equal(
    (await f.runtime.entries()).items.some((item) => item.id === f.id),
    false,
  );
  assert.equal(f.launched.length, 0);
});

test('forged outside-root records, mismatched identities and unverified records never enter the managed index', async (t) => {
  const f = await fixture(t);
  await organize(f);
  const history = await f.runtime.service.history();
  const original = history[0].entries[0];
  for (const mutate of [
    (entry) => {
      entry.target = path.join(f.root, 'outside', f.id);
    },
    (entry) => {
      entry.id = 'Other.lnk';
    },
    (entry) => {
      entry.source = path.join(f.root, 'outside-source', f.id);
    },
    (entry) => {
      entry.verified = false;
    },
    (entry) => {
      entry.checksum = 'f'.repeat(64);
    },
  ]) {
    const altered = structuredClone(history);
    mutate(altered[0].entries[0]);
    await f.runtime.service.save(altered);
    const restarted = new DesktopRuntime(f.options);
    assert.equal(
      (await restarted.entries()).items.some((item) => item.id === original.id),
      false,
    );
  }
});

test('historical folder ownership remains useful when a category is removed and current Archive grouping is shown', async (t) => {
  const f = await fixture(t);
  await organize(f, 'move', 'archive');
  const first = (await f.runtime.entries()).items.find((item) => item.id === f.id);
  assert.equal(first.category, 'archive');
  const settings = await f.runtime.settings.read();
  await f.runtime.settings.write({
    ...settings,
    categories: settings.categories.filter((item) => item.id !== 'archive'),
  });
  const restarted = new DesktopRuntime(f.options);
  const item = (await restarted.entries()).items.find((item) => item.id === f.id);
  assert.equal(item.source, first.source);
  assert.ok(settings.categories.some((category) => category.id === item.category));
  await restarted.launch(f.id);
  assert.equal(f.launched.at(-1), first.source);
});

test('a stale concurrent refresh cannot republish pre-move sources after a file operation', async (t) => {
  const f = await fixture(t);
  await f.runtime.scan();
  const plan = await f.runtime.preview([{ id: f.id, category: 'software' }], 'move');
  let unblock, ready;
  const started = new Promise((resolve) => {
    ready = resolve;
  });
  const original = f.runtime.activity.annotate.bind(f.runtime.activity);
  let first = true;
  f.runtime.activity.annotate = async (items) => {
    if (first) {
      first = false;
      ready();
      await new Promise((resolve) => {
        unblock = resolve;
      });
    }
    return original(items);
  };
  const initial = f.runtime.entries().then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await started;
  const moving = f.runtime.organize(plan.token);
  await new Promise((resolve) => setImmediate(resolve));
  unblock();
  await moving;
  assert.match((await initial).error.message, /OPERATION_BUSY/);
  assert.equal(f.runtime.catalog.get(f.id).source, f.target);
  assert.equal((await f.runtime.entries()).items.find((item) => item.id === f.id).source, f.target);
});

test('unchanged managed content reuses verification while checking the live file and ancestry', async (t) => {
  const f = await fixture(t);
  await organize(f);
  const index = f.runtime.launcherCatalog;
  assert.equal(index.cache.size, 1);
  const record = index.managed.get(f.id);
  const before = [...index.cache];
  const open = fs.open;
  let reads = 0;
  t.mock.method(fs, 'open', async (file, ...args) => {
    if (file === f.target) reads++;
    return open(file, ...args);
  });
  await index.verify(record);
  assert.deepEqual([...index.cache], before);
  // Re-verification still checks the live ancestry, even on a cache hit.
  const target = await f.runtime.resolveTrustedItem(f.id);
  assert.equal(target.source, f.target);
  assert.ok(index instanceof LauncherCatalog);
  assert.equal(reads, 0);
});

test('a read-only launcher action does not cancel an in-progress initial index', async (t) => {
  const f = await fixture(t);
  let ready, unblock;
  const started = new Promise((resolve) => {
    ready = resolve;
  });
  const annotate = f.runtime.activity.annotate.bind(f.runtime.activity);
  f.runtime.activity.annotate = async (items) => {
    ready();
    await new Promise((resolve) => {
      unblock = resolve;
    });
    return annotate(items);
  };
  const pending = f.runtime.entries();
  await started;
  await f.runtime.run('launcher-action', async () => ({ copied: true }));
  unblock();
  assert.equal((await pending).items.find((item) => item.id === f.id).source, f.source);
});
