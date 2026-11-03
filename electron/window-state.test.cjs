const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { restoreWindowState, WindowStateStore } = require('./runtime/window-state.cjs');
const primary = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const left = { id: 2, workArea: { x: -1600, y: -100, width: 1600, height: 900 } };
test('restores valid secondary monitor geometry including negative coordinates', () => {
  const saved = { bounds: { x: -1500, y: -50, width: 1200, height: 750 }, maximized: true };
  const result = restoreWindowState(saved, [primary, left], primary.id);
  assert.deepEqual(result.bounds, saved.bounds);
  assert.equal(result.maximized, true);
});
test('removed monitor and reduced work area restore every edge inside the available screen', () => {
  const result = restoreWindowState(
    { bounds: { x: -1500, y: -50, width: 1600, height: 1000 } },
    [{ id: 1, workArea: { x: 20, y: 40, width: 1024, height: 700 } }],
    1,
  );
  assert.deepEqual(result.bounds, { x: 20, y: 40, width: 1024, height: 700 });
});
test('small laptop screens lower minimum dimensions instead of making controls unreachable', () => {
  const result = restoreWindowState(
    {},
    [{ id: 1, workArea: { x: 0, y: 0, width: 800, height: 580 } }],
    1,
  );
  assert.equal(result.minWidth, 800);
  assert.equal(result.minHeight, 580);
  assert.deepEqual(result.bounds, { x: 0, y: 0, width: 800, height: 580 });
});
test('invalid presentation data falls back to centered geometry without coercing maximize flags', () => {
  const result = restoreWindowState(
    { bounds: { x: null, y: 0, width: Infinity, height: -1 }, maximized: 'true' },
    [primary],
    1,
  );
  assert.deepEqual(result.bounds, { x: 240, y: 52, width: 1440, height: 936 });
  assert.equal(result.maximized, false);
});
test('window state writes are serialized and corrupted preference can be replaced', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-window-'));
  try {
    await fs.writeFile(path.join(directory, 'window-state.json'), 'broken');
    const store = new WindowStateStore(directory);
    assert.deepEqual(await store.read(), {});
    const a = { x: 10, y: 20, width: 1000, height: 700 },
      b = { x: 30, y: 40, width: 1200, height: 800 };
    await Promise.all([store.save(a, false), store.save(b, true)]);
    await store.flush();
    assert.deepEqual(await store.read(), { bounds: b, maximized: true });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
