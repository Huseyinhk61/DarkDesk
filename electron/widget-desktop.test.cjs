const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { attachDesktop, runAttachment, ATTACH_SCRIPT } = require('./runtime/widget-desktop.cjs');
function windowHandle(value = 0x123456789abcdefn) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(value);
  return { isDestroyed: () => false, getNativeWindowHandle: () => bytes };
}
function fakeChild(complete) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => child.emit('close', 1);
  child.stdin.on('finish', () => setImmediate(() => complete(child)));
  return child;
}
test('desktop attachment preserves exact 64-bit HWND identity and accepts only a confirmed native result', async () => {
  let input;
  const result = await attachDesktop(windowHandle(), {
    platform: 'win32',
    processId: 42,
    execute: async (value) => {
      input = value;
      return { attached: true };
    },
  });
  assert.deepEqual(result, { mode: 'desktop', supported: true });
  assert.equal(input.handle, '81985529216486895');
  assert.equal(input.pid, 42);
  assert.ok(input.deadline > Date.now());
  assert.deepEqual(
    await attachDesktop(windowHandle(), {
      platform: 'win32',
      execute: async () => ({ attached: 'true' }),
    }),
    { mode: 'floating', supported: false, reason: 'native-failed' },
  );
});
test('unsupported desktops and invalid/destroyed handles never call a native process', async () => {
  let calls = 0;
  const execute = async () => {
    calls++;
    throw Error('must not run');
  };
  assert.equal(
    (await attachDesktop(windowHandle(), { platform: 'darwin', execute })).reason,
    'platform',
  );
  assert.equal(
    (await attachDesktop(windowHandle(), { platform: 'linux', execute })).reason,
    'platform',
  );
  for (const window of [
    null,
    { isDestroyed: () => true },
    windowHandle(0n),
    { getNativeWindowHandle: () => Buffer.from('malicious') },
    windowHandle(0xffffffffffffffffn),
  ])
    assert.equal(
      (await attachDesktop(window, { platform: 'win32', execute })).reason,
      'window-unavailable',
    );
  assert.equal(
    (await attachDesktop(windowHandle(), { platform: 'win32', execute, processId: NaN })).reason,
    'window-unavailable',
  );
  assert.equal(calls, 0);
});
test('Explorer failures remain honest floating-widget fallbacks without native error disclosure', async () => {
  assert.deepEqual(
    await attachDesktop(windowHandle(), {
      platform: 'win32',
      execute: async () => ({ attached: false, reason: 'explorer-unavailable' }),
    }),
    { mode: 'floating', supported: false, reason: 'explorer-unavailable' },
  );
  assert.deepEqual(
    await attachDesktop(windowHandle(), {
      platform: 'win32',
      execute: async () => {
        throw Error('private native diagnostic');
      },
    }),
    { mode: 'floating', supported: false, reason: 'native-failed' },
  );
  const window = windowHandle();
  window.isDestroyed = () => false;
  assert.equal(
    (
      await attachDesktop(window, {
        platform: 'win32',
        execute: async () => {
          window.isDestroyed = () => true;
          return { attached: true };
        },
      })
    ).mode,
    'floating',
  );
});
test('native bridge uses fixed encoded code and bounded JSON input/output, never a command shell', async () => {
  let call,
    input = '';
  const value = { handle: '81985529216486895', pid: 42, deadline: 123456 };
  const result = await runAttachment(value, (...args) => {
    call = args;
    const child = fakeChild((child) => {
      child.stdout.write('\uFEFF{"attached":true}');
      child.emit('close', 0);
    });
    child.stdin.on('data', (chunk) => {
      input += chunk;
    });
    return child;
  });
  assert.equal(result.attached, true);
  assert.equal(call[0], 'powershell.exe');
  assert.deepEqual(call[1].slice(0, 3), ['-NoProfile', '-NonInteractive', '-EncodedCommand']);
  assert.equal(Buffer.from(call[1][3], 'base64').toString('utf16le'), ATTACH_SCRIPT);
  assert.equal(call[2].shell, undefined);
  assert.deepEqual(JSON.parse(input), value);
  await assert.rejects(
    runAttachment(value, () =>
      fakeChild((child) => {
        child.stdout.write(Buffer.alloc(8193));
        child.emit('close', 0);
      }),
    ),
    /WIDGET_DESKTOP_UNAVAILABLE/,
  );
  await assert.rejects(
    runAttachment(value, () =>
      fakeChild((child) => {
        child.stdout.write('not json');
        child.emit('close', 0);
      }),
    ),
    /WIDGET_DESKTOP_UNAVAILABLE/,
  );
  await assert.rejects(
    runAttachment(value, () => fakeChild((child) => child.emit('close', 1))),
    /WIDGET_DESKTOP_UNAVAILABLE/,
  );
});
