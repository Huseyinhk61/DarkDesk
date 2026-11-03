const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const {
  ItemDetailsService,
  windowsVersionInfo,
  VERSION_SCRIPT,
} = require('./runtime/item-details.cjs');
const { DesktopRuntime } = require('./runtime/controller.cjs');
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-details-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'Editor.exe');
  await fs.writeFile(file, 'executable fixture');
  return { root, file, item: { id: 'editor', source: file, target: file } };
}
test('native icon extraction is deduplicated, cached and invalidates when source changes', async (t) => {
  const { file, item } = await fixture(t);
  let calls = 0;
  const service = new ItemDetailsService({
    getFileIcon: async (source, options) => {
      calls++;
      assert.equal(source, file);
      assert.equal(options.size, 'large');
      return { isEmpty: () => false, toDataURL: () => PNG };
    },
  });
  const result = await Promise.all([service.icon(item), service.icon(item)]);
  assert.equal(result[0].icon, PNG);
  assert.equal(calls, 1);
  await service.icon(item);
  assert.equal(calls, 1);
  await fs.appendFile(file, 'changed');
  await service.icon(item);
  assert.equal(calls, 2);
});
test('shortcut metadata uses local executable target and icon extraction stays lazy', async (t) => {
  const { root, file } = await fixture(t);
  const link = path.join(root, 'Editor.lnk');
  await fs.writeFile(link, 'link');
  let metadataCalls = 0;
  const service = new ItemDetailsService({
    platform: 'win32',
    readWindowsIcon: async () => null,
    resolveShortcut: async () => ({ target: file }),
    getFileIcon: async () => ({ toDataURL: () => PNG }),
    readVersionInfo: async (source) => {
      metadataCalls++;
      assert.equal(source, file);
      return { description: 'Editor application', company: 'Example Company' };
    },
  });
  const item = { id: 'link', source: link };
  await service.icon(item);
  assert.equal(metadataCalls, 0);
  const details = await service.details(item);
  assert.equal(details.description, 'Editor application');
  assert.equal(details.company, 'Example Company');
  assert.equal(details.size, 4);
  assert.equal(typeof details.created, 'number');
  assert.equal(details.metadataSource, 'windows-version-info');
  await service.details(item);
  assert.equal(metadataCalls, 1);
});
test('unavailable metadata/icon produce explicit unknowns and invalid icon data is rejected', async (t) => {
  const { item } = await fixture(t);
  const service = new ItemDetailsService({
    platform: 'win32',
    readWindowsIcon: async () => null,
    getFileIcon: async () => ({ toDataURL: () => 'file:///private/path' }),
    readVersionInfo: async () => {
      throw Error('No version resources');
    },
  });
  const result = await service.details(item);
  assert.equal(result.icon, null);
  assert.equal(result.description, null);
  assert.equal(result.company, null);
  assert.equal(result.metadataSource, 'file-system');
});
test('metadata cache is bounded and never reads symlink or non-file sources', async (t) => {
  const { root, file, item } = await fixture(t);
  const service = new ItemDetailsService({ limit: 2 });
  await service.icon(item);
  for (const name of ['second.exe', 'third.exe']) {
    const source = path.join(root, name);
    await fs.writeFile(source, name);
    await service.icon({ id: name, source });
  }
  assert.equal(service.cache.size, 2);
  await assert.rejects(service.icon({ id: 'directory', source: root }), /SOURCE_MISSING/);
  const link = path.join(root, 'symlink.exe');
  try {
    await fs.symlink(file, link);
  } catch (error) {
    if (error.code === 'EPERM') return;
    throw error;
  }
  await assert.rejects(service.icon({ id: 'symlink', source: link }), /SOURCE_MISSING/);
});
test('runtime accepts indexed IDs only and refreshes last launch metadata from activity journal', async (t) => {
  const { root, file, item } = await fixture(t);
  const runtime = new DesktopRuntime({
    desktop: root,
    downloads: path.join(root, 'downloads'),
    data: path.join(root, 'data'),
    getFileIcon: async () => ({ toDataURL: () => PNG }),
  });
  await assert.rejects(runtime.itemDetails(file), /SOURCE_MISSING/);
  await assert.rejects(runtime.itemIcon({ source: file }), /SOURCE_MISSING/);
  runtime.catalog.set(item.id, item);
  assert.equal((await runtime.itemDetails(item.id)).lastOpened, null);
  await runtime.activity.record(item.id);
  const details = await runtime.itemDetails(item.id);
  assert.equal(typeof details.lastOpened, 'number');
  assert.equal(details.usageScope, 'darkdesk-only');
});
test('PowerShell version reader uses fixed code plus JSON stdin and waits for stdout close', async () => {
  let args, input;
  const file = 'C:\\Program Files\\Example $([bad])\\app.exe';
  const spawnProcess = (command, commandArgs) => {
    assert.equal(command, 'powershell.exe');
    args = commandArgs;
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin.on('data', (value) => {
      input = String(value);
    });
    child.stdin.on('finish', () => {
      child.emit('exit', 0);
      child.stdout.write('{"description":"Editor",');
      child.stdout.end('"company":"Example"}');
      child.emit('close', 0);
    });
    child.kill = () => {};
    return child;
  };
  assert.deepEqual(await windowsVersionInfo(file, spawnProcess), {
    description: 'Editor',
    company: 'Example',
  });
  assert.equal(args.at(-1), VERSION_SCRIPT);
  assert.ok(!args.join(' ').includes(file));
  assert.deepEqual(JSON.parse(input), { path: file });
});

test('concurrent metadata requests retain their result even when bounded cache entries are evicted', async (t) => {
  const { root } = await fixture(t);
  const service = new ItemDetailsService({
    platform: 'win32',
    readWindowsIcon: async () => null,
    limit: 1,
    getFileIcon: async () => ({ toDataURL: () => PNG }),
    readVersionInfo: async (source) => ({ company: path.basename(source), description: 'app' }),
  });
  const items = await Promise.all(
    Array.from({ length: 8 }, async (_, index) => {
      const source = path.join(root, `App${index}.exe`);
      await fs.writeFile(source, 'program');
      return { id: String(index), source };
    }),
  );
  const results = await Promise.all(items.map((item) => service.details(item)));
  assert.deepEqual(
    results.map((item) => item.company),
    items.map((item) => path.basename(item.source)),
  );
  assert.ok(results.every((item) => item.icon === PNG));
  assert.equal(service.cache.size, 1);
});
