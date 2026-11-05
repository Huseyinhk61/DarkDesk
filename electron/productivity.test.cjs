const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  ProductivityTracker,
  sampleForeground,
  dateKey,
  appIdentity,
  sanitizeState,
} = require('./runtime/productivity.cjs');
const editor = { name: 'Editor', path: '/Applications/Editor' };
const browser = { name: 'Browser', path: '/Applications/Browser' };
async function fixture(t, overrides = {}) {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-productivity-'));
  t.after(() => fs.rm(data, { recursive: true, force: true }));
  let time = new Date(2026, 10, 5, 12).getTime(),
    sample = { foreground: editor, running: [editor, browser] },
    idle = 0,
    profile = 'coding';
  const tracker = new ProductivityTracker({
    data,
    platform: 'darwin',
    clock: () => time,
    sampleForeground: async () => sample,
    idle: () => idle,
    getProfile: async () => profile,
    ...overrides,
  });
  return {
    tracker,
    data,
    time: () => time,
    advance: (ms = 15000) => (time += ms),
    setTime: (value) => (time = value),
    setSample: (value) => (sample = value),
    setIdle: (value) => (idle = value),
    setProfile: (value) => (profile = value),
  };
}
const total = (state, key = 'activeSeconds') => state.days.reduce((sum, day) => sum + day[key], 0);
test('analytics is opt-in and never samples while disabled', async (t) => {
  let calls = 0;
  const f = await fixture(t, {
    sampleForeground: async () => {
      calls++;
      return editor;
    },
  });
  await f.tracker.tick();
  f.advance();
  await f.tracker.tick();
  assert.equal(calls, 0);
  assert.equal((await f.tracker.status()).enabled, false);
  await assert.rejects(f.tracker.setEnabled('yes'), /ANALYTICS_INPUT_INVALID/);
});
test('foreground, concurrent open apps and profile time are measured separately and persisted', async (t) => {
  const f = await fixture(t);
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.advance();
  let state = await f.tracker.tick();
  assert.equal(total(state), 15);
  assert.equal(state.days[0].apps.find((a) => a.name === 'Editor').seconds, 15);
  assert.equal(state.days[0].apps.find((a) => a.name === 'Browser').seconds, 0);
  assert.equal(state.days[0].apps.find((a) => a.name === 'Browser').runningSeconds, 15);
  assert.equal(state.days[0].profiles[0].seconds, 15);
  assert.equal(state.runningAvailable, true);
  await f.tracker.stop();
  const persisted = JSON.parse(await fs.readFile(path.join(f.data, 'productivity.json'), 'utf8'));
  assert.equal(JSON.stringify(persisted).includes('/Applications'), false);
  const restored = new ProductivityTracker({
    data: f.data,
    platform: 'darwin',
    sampleForeground: async () => null,
  });
  assert.equal(total(await restored.status()), 15);
});
test('switching foreground apps does not invent per-app focus between samples', async (t) => {
  const f = await fixture(t);
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.setSample({ foreground: browser, running: [browser, editor] });
  f.advance();
  let state = await f.tracker.tick();
  assert.equal(total(state), 15);
  assert.equal(
    state.days[0].apps.reduce((sum, a) => sum + a.seconds, 0),
    0,
  );
  f.advance();
  state = await f.tracker.tick();
  assert.equal(state.days[0].apps.find((a) => a.name === 'Browser').seconds, 15);
});
test('running-app duplicates are deduplicated and disappearing apps stop accumulating', async (t) => {
  const f = await fixture(t);
  f.setSample({ foreground: editor, running: [editor, editor, browser] });
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.advance();
  let state = await f.tracker.tick();
  assert.equal(state.days[0].apps.find((a) => a.name === 'Editor').runningSeconds, 15);
  f.setSample({ foreground: editor, running: [editor] });
  f.advance();
  state = await f.tracker.tick();
  assert.equal(state.days[0].apps.find((a) => a.name === 'Browser').runningSeconds, 15);
});
test('idle lock and resume exclude the paused interval and restart with a fresh sample', async (t) => {
  const f = await fixture(t);
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.advance();
  await f.tracker.tick();
  f.setIdle(60);
  f.advance();
  assert.equal((await f.tracker.tick()).paused, true);
  f.setIdle(0);
  f.advance();
  await f.tracker.tick();
  f.advance();
  assert.equal(total(await f.tracker.tick()), 30);
  f.tracker.pause('lock');
  f.advance();
  await f.tracker.tick();
  f.tracker.resume('lock');
  f.advance();
  await f.tracker.tick();
  f.advance();
  assert.equal(total(await f.tracker.tick()), 45);
});
test('a long sampling gap is discarded rather than assigned to the last app', async (t) => {
  const f = await fixture(t);
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.advance(600000);
  assert.equal(total(await f.tracker.tick()), 0);
  f.advance();
  assert.equal(total(await f.tracker.tick()), 15);
});
test('midnight intervals split according to local calendar days', async (t) => {
  const f = await fixture(t);
  f.setTime(new Date(2026, 10, 5, 23, 59, 55).getTime());
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.advance();
  const state = await f.tracker.tick();
  assert.deepEqual(
    state.days.map((d) => [d.date, d.activeSeconds]),
    [
      ['2026-11-05', 5],
      ['2026-11-06', 10],
    ],
  );
});
test('profile transitions do not infer the split between two samples', async (t) => {
  const f = await fixture(t);
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.setProfile('gaming');
  f.advance();
  let state = await f.tracker.tick();
  assert.equal(state.days[0].profiles.length, 0);
  f.advance();
  state = await f.tracker.tick();
  assert.deepEqual(state.days[0].profiles, [{ id: 'gaming', seconds: 15 }]);
});
test('disabling ignores an already in-flight sample', async (t) => {
  let resolve;
  let delayed = false;
  const f = await fixture(t, {
    sampleForeground: () => (delayed ? new Promise((r) => (resolve = r)) : Promise.resolve(editor)),
  });
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.advance();
  delayed = true;
  const pending = f.tracker.tick();
  await new Promise((r) => setImmediate(r));
  await f.tracker.setEnabled(false);
  resolve(editor);
  const state = await pending;
  assert.equal(total(state), 0);
  assert.equal(state.enabled, false);
});
test('clear invalidates in-flight results and starts a new baseline', async (t) => {
  let resolve,
    delayed = false;
  const f = await fixture(t, {
    sampleForeground: () => (delayed ? new Promise((r) => (resolve = r)) : Promise.resolve(editor)),
  });
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.advance();
  await f.tracker.tick();
  f.advance();
  delayed = true;
  const pending = f.tracker.tick();
  await new Promise((r) => setImmediate(r));
  const cleared = await f.tracker.clear();
  assert.equal(cleared.days.length, 0);
  resolve(editor);
  assert.equal((await pending).days.length, 0);
});
test('three failed samples pause collection with a recoverable status', async (t) => {
  const f = await fixture(t, {
    sampleForeground: async () => {
      throw Error('private host error');
    },
  });
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  await f.tracker.tick();
  const state = await f.tracker.tick();
  assert.equal(state.samplingAvailable, false);
  assert.equal(state.lastError, 'ANALYTICS_SAMPLE_FAILED');
  assert.equal((await f.tracker.setEnabled(true)).samplingAvailable, true);
});
test('clock rollback discards intervals rather than producing negative or duplicate time', async (t) => {
  const f = await fixture(t);
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  const original = f.time();
  f.advance();
  await f.tracker.tick();
  f.setTime(original);
  const state = await f.tracker.tick();
  assert.equal(total(state), 15);
  assert.equal(state.lastError, 'ANALYTICS_CLOCK_CHANGED');
});
test('retention removes dates older than 90 local days and future records', async (t) => {
  const f = await fixture(t);
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.advance();
  await f.tracker.tick();
  f.tracker.state.days['2027-01-01'] = { activeSeconds: 10, apps: {}, profiles: {} };
  f.setTime(new Date(2027, 1, 5, 12).getTime());
  await f.tracker.tick();
  f.advance();
  const state = await f.tracker.tick();
  assert.equal(
    state.days.some((d) => d.date === '2026-11-05'),
    false,
  );
  f.tracker.state.days['2028-01-01'] = { activeSeconds: 1, apps: {}, profiles: {} };
  f.advance();
  assert.equal(
    (await f.tracker.tick()).days.some((d) => d.date === '2028-01-01'),
    false,
  );
});
test('a corrupt history can be explicitly cleared and never blocks quitting', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.data, 'productivity.json'), '{broken');
  await assert.rejects(f.tracker.status(), /ANALYTICS_STATE_READ/);
  await f.tracker.stop();
  const recovered = await f.tracker.clear();
  assert.equal(recovered.enabled, false);
  assert.deepEqual(recovered.days, []);
  const restored = new ProductivityTracker({ data: f.data, platform: 'darwin' });
  assert.deepEqual((await restored.status()).days, []);
});
test('unsupported systems expose no measurements and cannot enable tracking', async (t) => {
  const f = await fixture(t);
  const tracker = new ProductivityTracker({ data: f.data, platform: 'linux' });
  assert.equal((await tracker.status()).supported, false);
  await assert.rejects(tracker.setEnabled(true), /ANALYTICS_UNSUPPORTED/);
  assert.equal((await tracker.tick()).days.length, 0);
});
test('native sampler uses fixed bounded OS scripts and discards window titles', async () => {
  for (const platform of ['win32', 'darwin']) {
    let invocation;
    const state = await sampleForeground(platform, async (...args) => {
      invocation = args;
      return {
        stdout: JSON.stringify({
          foreground: { name: 'Editor', path: '/editor', title: 'private' },
          running: [{ name: 'Editor', path: '/editor', title: 'private' }],
        }),
      };
    });
    assert.equal(state.foreground.title, undefined);
    assert.equal(invocation[2].timeout, 5000);
    assert.equal(invocation[2].maxBuffer, 512 * 1024);
    assert.equal(invocation[2].windowsHide, true);
  }
  await assert.rejects(sampleForeground('linux'), /ANALYTICS_UNSUPPORTED/);
});
test('identity and state validation keep paths out and reject invalid data', () => {
  assert.equal(
    appIdentity({ name: 'Editor', path: 'C:\\Editor.exe' }, 'win32').id,
    appIdentity({ name: 'Editor', path: 'c:\\editor.exe' }, 'win32').id,
  );
  assert.equal(appIdentity({ name: '' }, 'darwin'), null);
  assert.throws(() => sanitizeState({}), /ANALYTICS_STATE_READ/);
  const clean = sanitizeState({
    version: 1,
    enabled: false,
    days: {
      '2026-02-30': {},
      '2026-11-05': {
        activeSeconds: 15,
        apps: { invalid: { name: 'secret', seconds: 10 } },
        profiles: { coding: 15 },
      },
    },
  });
  assert.deepEqual(Object.keys(clean.days), ['2026-11-05']);
  assert.deepEqual(clean.days['2026-11-05'].apps, {});
  assert.equal(dateKey(new Date(2026, 10, 5).getTime()), '2026-11-05');
});
test('reading dormant history enforces retention even when measurement stays disabled', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(
    path.join(f.data, 'productivity.json'),
    JSON.stringify({
      version: 1,
      enabled: false,
      days: { '2026-01-01': { activeSeconds: 15, apps: {}, profiles: {} } },
    }),
  );
  assert.deepEqual((await f.tracker.status()).days, []);
  await f.tracker.stop();
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(f.data, 'productivity.json'), 'utf8')).days,
    {},
  );
});

test('OS actions can flush an unreadable dormant history without replacing it', async (t) => {
  const f = await fixture(t);
  const file = path.join(f.data, 'productivity.json');
  await fs.writeFile(file, '{broken');
  await f.tracker.flushIfLoaded();
  assert.equal(await fs.readFile(file, 'utf8'), '{broken');
  await assert.rejects(f.tracker.status(), /ANALYTICS_STATE_READ/);
});

test('OS-action flush preserves dirty measurements and reports real write failures', async (t) => {
  const f = await fixture(t);
  await f.tracker.setEnabled(true);
  await f.tracker.tick();
  f.advance();
  await f.tracker.tick();
  const write = f.tracker.store.write.bind(f.tracker.store);
  f.tracker.store.write = async () => {
    throw Error('disk full');
  };
  await assert.rejects(f.tracker.flushIfLoaded(), /ANALYTICS_WRITE_FAILED/);
  assert.equal(f.tracker.dirty, true);
  assert.equal(total(await f.tracker.status()), 15);
  f.tracker.store.write = write;
  await f.tracker.flushIfLoaded();
  assert.equal(f.tracker.dirty, false);
  assert.equal(
    Object.values(
      JSON.parse(await fs.readFile(path.join(f.data, 'productivity.json'), 'utf8')).days,
    )[0].activeSeconds,
    15,
  );
});
