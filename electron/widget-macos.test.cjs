const { test } = require('node:test');
const assert = require('node:assert/strict');
const { attachMacDesktop } = require('./runtime/widget-desktop-macos.cjs');
test('macOS desktop attachment keeps a normal interactive window at the icon layer', () => {
  let level = 0;
  let behavior;
  const calls = [];
  const api = {
    selector: (x) => x,
    object: (view, selector) => {
      assert.equal(view, 123n);
      assert.equal(selector, 'window');
      return 456n;
    },
    boolean: () => true,
    integer: () => level,
    level: (key) => {
      assert.equal(key, 18);
      return -2147483603;
    },
    setInteger: (window, selector, value) => {
      calls.push(selector);
      if (selector === 'setLevel:') level = value;
      else behavior = value;
    },
  };
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(123n);
  const window = { getNativeWindowHandle: () => bytes, isDestroyed: () => false };
  assert.deepEqual(attachMacDesktop(window, { platform: 'darwin', getBindings: () => api }), {
    mode: 'desktop',
    supported: true,
  });
  assert.equal(level, -2147483602);
  assert.equal(behavior, 81);
  assert.ok(calls.includes('setCollectionBehavior:'));
});
test('macOS unsupported pointers or missing native addon fall back without dereferencing a renderer value', () => {
  assert.equal(attachMacDesktop(null, { platform: 'darwin' }).supported, false);
  const window = { getNativeWindowHandle: () => Buffer.alloc(8), isDestroyed: () => false };
  assert.equal(
    attachMacDesktop(window, {
      platform: 'darwin',
      getBindings: () => {
        throw Error('must not load');
      },
    }).reason,
    'window-unavailable',
  );
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(123n);
  window.getNativeWindowHandle = () => bytes;
  assert.equal(
    attachMacDesktop(window, {
      platform: 'darwin',
      getBindings: () => {
        throw Error('not installed');
      },
    }).reason,
    'native-failed',
  );
});

test('macOS attachment restores native placement on a partially failed change', () => {
  let level = 7,
    behavior = 2,
    failed = false;
  const api = {
    selector: (x) => x,
    object: () => 456n,
    boolean: () => true,
    integer: (_, selector) => (selector === 'level' ? level : behavior),
    level: () => -2147483603,
    setInteger: (_, selector, value) => {
      if (selector === 'setLevel:') level = value;
      else {
        behavior = value;
        if (!failed) {
          failed = true;
          throw Error('native failure');
        }
      }
    },
  };
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(123n);
  const result = attachMacDesktop(
    { getNativeWindowHandle: () => bytes },
    { platform: 'darwin', getBindings: () => api },
  );
  assert.deepEqual(result, { mode: 'floating', supported: false, reason: 'native-failed' });
  assert.equal(level, 7);
  assert.equal(behavior, 2);
});
