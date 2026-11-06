const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { SystemMetrics } = require('./runtime/system-metrics.cjs');
const { CommandUsage } = require('./runtime/command-usage.cjs');
const { defaultSettings } = require('../shared/domain.js');
test('CPU reports real deltas after warmup and shared polling reuses a bounded sample', () => {
  let now = 1000;
  let ticks = { user: 100, sys: 100, idle: 800 };
  const metrics = new SystemMetrics({
    cpus: () => [{ times: ticks }],
    total: () => 1000,
    free: () => 250,
    rss: () => 20,
    clock: () => now,
  });
  assert.equal(metrics.snapshot().cpuPercent, null);
  now = 2000;
  ticks = { user: 150, sys: 150, idle: 900 };
  const sampled = metrics.snapshot();
  assert.equal(sampled.cpuPercent, 50);
  assert.deepEqual(sampled.cores, [50]);
  assert.equal(sampled.memory.used, 750);
  assert.equal(sampled.memory.percent, 75);
  now = 2100;
  ticks = { user: 170, sys: 170, idle: 900 };
  assert.equal(metrics.snapshot().cpuPercent, 50);
  now = 500;
  assert.equal(metrics.snapshot().cpuPercent, null);
});
test('command suggestions count only explicitly recorded allowlisted commands and survive restart', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-commands-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new CommandUsage(root, { clock: () => 1000 });
  await Promise.all([
    store.record('command:show', defaultSettings),
    store.record('command:show', defaultSettings),
  ]);
  const value = await new CommandUsage(root, { clock: () => 1000 }).read(defaultSettings);
  assert.equal(value['command:show'].count, 2);
  await assert.rejects(
    store.record('system:execute-anything', defaultSettings),
    /LAUNCHER_INPUT_INVALID/,
  );
  await assert.rejects(store.record('__proto__', defaultSettings), /LAUNCHER_INPUT_INVALID/);
});

test('disk capacity uses real statfs data, caches reads, and fails without invented metrics', async () => {
  let calls = 0,
    now = 20000;
  const metrics = new SystemMetrics({
    clock: () => now,
    statfs: async () => {
      calls++;
      return { blocks: 100, bavail: 25, bsize: 1024 };
    },
    uptime: () => 3600,
  });
  const [first, second] = await Promise.all([
    metrics.detailedSnapshot(),
    metrics.detailedSnapshot(),
  ]);
  assert.equal(calls, 1);
  assert.equal(first.disk.total, 102400);
  assert.equal(first.disk.percent, 75);
  assert.equal(second.uptimeSeconds, 3600);
  await metrics.detailedSnapshot();
  assert.equal(calls, 1);
  now += 16000;
  metrics.statfs = async () => {
    throw Error('unavailable');
  };
  assert.equal((await metrics.detailedSnapshot()).disk, null);
});
