const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { ItemDetailsService } = require('./runtime/item-details.cjs');
const { extractWindowsIcon, validPngDataUrl, ICON_SCRIPT } = require('./runtime/windows-icons.cjs');
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-winicons-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'Editor.exe'),
    source = path.join(root, 'Editor.lnk'),
    icon = path.join(root, 'brand.dll');
  for (const file of [target, source, icon]) await fs.writeFile(file, path.basename(file));
  return { root, target, source, icon };
}
test('Windows shortcut custom resource/index precedes executable and shell fallback; resource changes invalidate cache', async (t) => {
  const { target, source, icon } = await fixture(t);
  let calls = 0;
  const service = new ItemDetailsService({
    platform: 'win32',
    resolveShortcut: () => ({ target, icon, iconIndex: -132 }),
    readWindowsIcon: async (candidates) => {
      calls++;
      assert.deepEqual(candidates, [
        { path: icon, index: -132, shell: false },
        { path: target, index: 0, shell: false },
        { path: source, index: 0, shell: true },
      ]);
      return PNG;
    },
    getFileIcon: () => {
      throw Error('generic shell icon must not replace original resource');
    },
  });
  const item = { id: 'editor', source };
  assert.deepEqual(await service.icon(item), {
    id: 'editor',
    icon: PNG,
    iconSource: 'windows-native',
  });
  await service.icon(item);
  assert.equal(calls, 1);
  await fs.appendFile(icon, 'updated');
  await service.icon(item);
  assert.equal(calls, 2);
});
test('UTF-16 InternetShortcut IconFile expands local variables and preserves negative icon index without reading URL', async (t) => {
  const { root, icon } = await fixture(t),
    source = path.join(root, 'Game.url');
  process.env.DARKDESK_ICON_FIXTURE = root;
  t.after(() => delete process.env.DARKDESK_ICON_FIXTURE);
  const contents =
    '[InternetShortcut]\r\nURL=steam://rungameid/123\r\nIconFile="%DARKDESK_ICON_FIXTURE%/brand.dll"\r\nIconIndex=-7\r\n';
  await fs.writeFile(
    source,
    Buffer.concat([Buffer.from([255, 254]), Buffer.from(contents, 'utf16le')]),
  );
  const service = new ItemDetailsService({
    platform: 'win32',
    readWindowsIcon: async (candidates) => {
      assert.deepEqual(candidates[0], { path: icon, index: -7, shell: false });
      assert.ok(candidates.every((candidate) => !candidate.path.includes('steam://')));
      return PNG;
    },
  });
  assert.equal((await service.icon({ id: 'game', source })).icon, PNG);
});
test('generic Electron shortcut icons are bypassed for the resolved local executable, with explicit retry support', async (t) => {
  const { source, target } = await fixture(t);
  let nativeCalls = 0,
    shellCalls = [];
  const service = new ItemDetailsService({
    platform: 'win32',
    resolveShortcut: () => ({ target }),
    readWindowsIcon: async () => {
      nativeCalls++;
      return null;
    },
    getFileIcon: async (file) => {
      shellCalls.push(file);
      return { toDataURL: () => PNG };
    },
  });
  const item = { id: 'editor', source };
  const result = await service.icon(item);
  assert.equal(result.iconSource, 'electron-shell');
  assert.deepEqual(shellCalls, [target]);
  await service.icon(item);
  assert.equal(nativeCalls, 1);
  await service.icon(item, { refresh: true });
  assert.equal(nativeCalls, 2);
});
test('remote resources never reach native extraction and stale sources are rechecked', async (t) => {
  const { source, target } = await fixture(t);
  const service = new ItemDetailsService({
    platform: 'win32',
    resolveShortcut: () => ({
      target: '\\\\server\\program.exe',
      icon: '\\\\server\\secret.ico',
      iconIndex: 0,
    }),
    readWindowsIcon: () => {
      throw Error('must not extract remote files');
    },
    getFileIcon: async (file) => {
      assert.equal(file, source);
      return null;
    },
  });
  const ctx = await service.context({ id: 'shortcut', source });
  assert.equal(ctx.iconResource, null);
  assert.equal(ctx.target, null);
  assert.deepEqual(ctx.iconCandidates, []);
  assert.equal((await service.icon({ id: 'shortcut', source })).icon, null);
  // A stale trusted entry is rechecked before native work, even on a cache hit.
  await fs.unlink(source);
  await assert.rejects(service.icon({ id: 'shortcut', source, target }), /SOURCE_MISSING/);
});
test('a symbolic link cannot be used as a custom icon resource', async (t) => {
  const { root, source, target, icon } = await fixture(t);
  const symbolic = path.join(root, 'linked.ico');
  try {
    await fs.symlink(icon, symbolic);
  } catch (error) {
    if (error.code === 'EPERM') return;
    throw error;
  }
  const service = new ItemDetailsService({
    platform: 'win32',
    resolveShortcut: () => ({ target, icon: symbolic, iconIndex: 0 }),
    readWindowsIcon: async (candidates) => {
      assert.ok(candidates.every((candidate) => candidate.path !== symbolic));
      return PNG;
    },
  });
  assert.equal((await service.icon({ id: 'editor', source })).icon, PNG);
});
test('native icon reader accepts PNG only, uses JSON stdin and waits for close after exit', async () => {
  const candidates = [{ path: 'C:\\Users\\Ömer\\$([bad]) ` app.exe', index: -4, shell: false }];
  let input, code;
  const spawnProcess = (command, args) => {
    assert.equal(command, 'powershell.exe');
    code = args.at(-1);
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    child.stdin.on('data', (chunk) => {
      input = String(chunk);
    });
    child.stdin.on('finish', () => {
      child.emit('exit', 0);
      setImmediate(() => {
        child.stdout.end(JSON.stringify({ png: PNG.split(',')[1] }));
        child.emit('close', 0);
      });
    });
    return child;
  };
  assert.equal(await extractWindowsIcon(candidates, spawnProcess), PNG);
  assert.equal(code, ICON_SCRIPT);
  assert.ok(!code.includes(candidates[0].path));
  assert.deepEqual(JSON.parse(input), { candidates });
  assert.equal(validPngDataUrl(PNG), true);
  assert.equal(validPngDataUrl('data:image/png;base64,aGVsbG8='), false);
  assert.equal(validPngDataUrl('https://example.com/icon.png'), false);
});
test('native icon process output is bounded and malformed payloads do not become image sources', async () => {
  let killed = false;
  const spawnProcess = () => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      killed = true;
    };
    child.stdin.on('finish', () => {
      child.stdout.end('x'.repeat(1024 * 1024 + 1));
      child.emit('close', 0);
    });
    return child;
  };
  await assert.rejects(extractWindowsIcon([], spawnProcess), /ICON_UNAVAILABLE/);
  assert.equal(killed, true);
});
