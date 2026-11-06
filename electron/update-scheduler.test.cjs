const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UpdateScheduler } = require('./runtime/update-scheduler.cjs');
const { releaseNotesUrl } = require('../shared/update-links.js');
function fixture() {
  let now = Date.parse('2026-11-06T15:00Z'),
    sequence = 0,
    calls = 0;
  const timers = new Map();
  let state = { state: 'idle', lastChecked: null },
    behavior = async () => {};
  const updates = {
    status: () => state,
    check: async () => {
      calls++;
      state = { state: 'checking', lastChecked: new Date(now).toISOString() };
      await behavior();
      if (state.state === 'checking') state = { ...state, state: 'not-available' };
      return state;
    },
  };
  const scheduler = new UpdateScheduler(updates, {
    clock: () => now,
    setTimer: (callback, delay) => {
      const id = ++sequence;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });
  const next = async () => {
    const [id, timer] = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
    timers.delete(id);
    now = timer.due;
    timer.callback();
    if (scheduler.pending) await scheduler.pending;
  };
  return {
    scheduler,
    updates,
    timers,
    next,
    advance: (ms) => (now += ms),
    get calls() {
      return calls;
    },
    set state(value) {
      state = value;
    },
    set behavior(value) {
      behavior = value;
    },
  };
}
test('startup checks once, errors retry after fifteen minutes, normal checks remain six hours apart', async () => {
  const f = fixture();
  f.behavior = async () => {
    f.state = { ...f.updates.status(), state: 'error' };
  };
  f.scheduler.start();
  assert.equal(f.calls, 0);
  await f.next();
  assert.equal(f.calls, 1);
  const retry = [...f.timers.values()][0].due;
  assert.equal(retry - Date.parse(f.updates.status().lastChecked), 15 * 60 * 1000);
  f.behavior = async () => {};
  await f.next();
  assert.equal(f.calls, 2);
  assert.equal([...f.timers.values()][0].due - retry, 6 * 60 * 60 * 1000);
  f.scheduler.dispose();
  assert.equal(f.timers.size, 0);
});
test('wake checks are throttled, include manual checks and never interfere with a download', async () => {
  const f = fixture();
  await f.scheduler.wake();
  assert.equal(f.calls, 1);
  await f.scheduler.wake();
  f.advance(30 * 60 * 1000);
  await f.scheduler.wake();
  assert.equal(f.calls, 2);
  f.advance(31 * 60 * 1000);
  await f.updates.check();
  await f.scheduler.wake();
  assert.equal(f.calls, 3, 'A recent manual check suppresses the focus check');
  for (const state of ['checking', 'downloading', 'downloaded']) {
    f.state = { state };
    f.advance(7 * 60 * 60 * 1000);
    await f.scheduler.wake();
  }
  assert.equal(f.calls, 3);
  f.scheduler.dispose();
});
test('simultaneous wake signals share a check and disposal prevents any later scheduling', async () => {
  const f = fixture();
  let release;
  f.behavior = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const first = f.scheduler.wake(),
    second = f.scheduler.wake();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(f.calls, 1);
  f.scheduler.dispose();
  release();
  await first;
  assert.equal(f.timers.size, 0);
  await f.scheduler.wake();
  assert.equal(f.calls, 1);
});
test('release links stay on the official repository for valid and hostile version inputs', () => {
  assert.equal(
    releaseNotesUrl('3.8.2'),
    'https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.8.2',
  );
  for (const version of [
    'https://evil.invalid',
    '../../settings',
    '3.8.2?redirect=bad',
    null,
    'x'.repeat(101),
  ])
    assert.equal(
      releaseNotesUrl(version),
      'https://github.com/Huseyinhk61/DarkDesk/releases/latest',
    );
});
