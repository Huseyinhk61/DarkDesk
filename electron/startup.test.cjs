const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const {
  StartupManager,
  runPowerShell,
  LIST_SCRIPT,
  SET_SCRIPT,
  enabledApproval,
  approvalState,
} = require('./runtime/startup.cjs');
const coded = (code) => Object.assign(Error(code), { code });
class Registry {
  constructor(directory) {
    this.directory = directory;
    this.records = [
      {
        source: 'user-run',
        name: 'Editor',
        command: '"C:\\Apps\\Editor.exe" --startup',
        valueKind: 'ExpandString',
        approval: null,
        approvalKind: 'Binary',
      },
      {
        source: 'machine-run',
        name: 'Machine Helper',
        command: 'C:\\Machine.exe',
        valueKind: 'String',
        approval: null,
        approvalKind: 'Binary',
      },
    ];
    this.folderApprovals = [];
    this.writes = [];
  }
  async snapshot() {
    return structuredClone({
      records: this.records,
      startupDirectory: this.directory,
      folderApprovals: this.folderApprovals,
    });
  }
  async setApproved(entry, desired) {
    this.beforeWrite?.();
    const current =
      entry.source === 'user-run'
        ? this.records.find((row) => row.source === entry.source && row.name === entry.name)
        : this.folderApprovals.find((row) => row.name === entry.name) || {
            name: entry.name,
            approval: null,
            approvalKind: 'Binary',
          };
    if (
      (current.approval ?? null) !== (entry.approval ?? null) ||
      (current.approvalKind || 'Binary') !== (entry.approvalKind || 'Binary') ||
      (entry.source === 'user-run' &&
        (current.command !== entry.command || current.valueKind !== entry.valueKind))
    )
      throw coded('STARTUP_CHANGED');
    this.writes.push({ id: entry.id, source: entry.source, name: entry.name, desired });
    current.approval = desired;
    current.approvalKind = 'Binary';
    if (entry.source === 'user-startup' && !this.folderApprovals.includes(current))
      this.folderApprovals.push(current);
  }
}
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-startup-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'Startup');
  await fs.mkdir(directory);
  const registry = new Registry(directory);
  const manager = new StartupManager({
    data: path.join(root, 'data'),
    platform: 'win32',
    registry,
    clock: () => 2000000,
    ...options,
  });
  return { root, directory, registry, manager };
}
test('current-user Run approval toggles preserve exact command, registry kind and original approval', async (t) => {
  const { manager, registry, root } = await fixture(t);
  const original = enabledApproval();
  const originalBytes = Buffer.from(original, 'base64');
  originalBytes[11] = 17;
  registry.records[0].approval = originalBytes.toString('base64');
  const originalCommand = registry.records[0].command;
  const before = await manager.list();
  const editor = before.items.find((row) => row.name === 'Editor');
  assert.equal(editor.enabled, true);
  assert.equal(editor.canEdit, true);
  const disabled = await manager.setEnabled(editor.id, false);
  assert.equal(disabled.items.find((row) => row.id === editor.id).enabled, false);
  assert.equal(registry.records[0].command, originalCommand);
  assert.equal(registry.records[0].valueKind, 'ExpandString');
  const restarted = new StartupManager({
    data: path.join(root, 'data'),
    platform: 'win32',
    registry,
  });
  await restarted.list();
  const enabled = await restarted.setEnabled(editor.id, true);
  assert.equal(enabled.items.find((row) => row.id === editor.id).enabled, true);
  assert.equal(registry.records[0].approval, originalBytes.toString('base64'));
  assert.equal(registry.records[0].command, originalCommand);
});
test('missing StartupApproved values are removed again on re-enable, and shortcuts never move or change', async (t) => {
  const { manager, registry, directory } = await fixture(t);
  const file = path.join(directory, 'My Tool.lnk');
  await fs.writeFile(file, 'shortcut bytes');
  let list = await manager.list();
  const row = list.items.find((item) => item.name === 'My Tool.lnk');
  assert.ok(row.canEdit);
  await manager.setEnabled(row.id, false);
  assert.equal(await fs.readFile(file, 'utf8'), 'shortcut bytes');
  list = await manager.setEnabled(row.id, true);
  assert.equal(list.items.find((item) => item.id === row.id).enabled, true);
  assert.equal(registry.folderApprovals.find((item) => item.name === row.name).approval, null);
  assert.equal(await fs.readFile(file, 'utf8'), 'shortcut bytes');
});
test('stale commands and last-moment registry changes are rejected without overwriting the new value', async (t) => {
  const { manager, registry } = await fixture(t);
  let row = (await manager.list()).items.find((item) => item.name === 'Editor');
  registry.records[0].command = 'C:\\Other.exe';
  await assert.rejects(manager.setEnabled(row.id, false), /STARTUP_CHANGED/);
  assert.equal(registry.writes.length, 0);
  row = (await manager.list()).items.find((item) => item.name === 'Editor');
  registry.beforeWrite = () => {
    registry.records[0].command = 'C:\\Third.exe';
  };
  await assert.rejects(manager.setEnabled(row.id, false), /STARTUP_CHANGED/);
  assert.equal(registry.records[0].command, 'C:\\Third.exe');
  assert.equal(registry.records[0].approval, null);
});
test('machine-wide and unknown approval records remain read-only and arbitrary identifiers cannot mutate startup', async (t) => {
  const { manager, registry } = await fixture(t);
  const invalid = Buffer.alloc(12);
  invalid.writeUInt32LE(99, 0);
  registry.records[0].approval = invalid.toString('base64');
  const list = await manager.list();
  const machine = list.items.find((item) => item.source === 'machine-run'),
    unknown = list.items.find((item) => item.name === 'Editor');
  assert.equal(machine.canEdit, false);
  assert.equal(unknown.enabled, null);
  assert.equal(unknown.canEdit, false);
  await assert.rejects(manager.setEnabled(machine.id, false), /STARTUP_READ_ONLY/);
  await assert.rejects(manager.setEnabled(unknown.id, true), /STARTUP_READ_ONLY/);
  await assert.rejects(manager.setEnabled('HKLM\\arbitrary', false), /STARTUP_CHANGED/);
  await assert.rejects(manager.setEnabled(machine.id, 'false'), /STARTUP_INVALID/);
  assert.deepEqual(registry.writes, []);
});
test('a startup-directory symlink is never followed and a changed shortcut is not enabled by an old row', async (t) => {
  const f = await fixture(t);
  const outside = path.join(f.root, 'Outside');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'External.lnk'), 'external');
  await fs.rmdir(f.directory);
  try {
    await fs.symlink(outside, f.directory, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('Directory symlink permission unavailable');
    throw error;
  }
  const result = await f.manager.list();
  assert.ok(result.warnings.includes('STARTUP_PATH_UNSAFE'));
  assert.ok(!result.items.some((item) => item.name === 'External.lnk'));
  assert.equal(await fs.readFile(path.join(outside, 'External.lnk'), 'utf8'), 'external');
});
test('startup shortcut replacement between list and toggle is rejected', async (t) => {
  const { manager, directory, registry } = await fixture(t);
  const file = path.join(directory, 'Changed.lnk');
  await fs.writeFile(file, 'initial');
  const row = (await manager.list()).items.find((item) => item.name === 'Changed.lnk');
  await fs.writeFile(file, 'changed and longer');
  await assert.rejects(manager.setEnabled(row.id, false), /STARTUP_CHANGED/);
  assert.deepEqual(registry.writes, []);
});
test('backup persistence must succeed before disabling and symlinked backup files are protected', async (t) => {
  const { manager, registry, root } = await fixture(t);
  const row = (await manager.list()).items.find((item) => item.name === 'Editor');
  manager.store.write = async () => {
    throw Error('disk full');
  };
  await assert.rejects(manager.setEnabled(row.id, false), /disk full/);
  assert.deepEqual(registry.writes, []);
  const data = path.join(root, 'other-data');
  await fs.mkdir(data);
  const outside = path.join(root, 'outside.json');
  await fs.writeFile(outside, '{"version":1,"records":{}}');
  try {
    await fs.symlink(outside, path.join(data, 'startup-state.json'), 'file');
  } catch (error) {
    if (error.code === 'EPERM') return;
    throw error;
  }
  const unsafe = new StartupManager({ data, platform: 'win32', registry });
  await unsafe.list();
  await assert.rejects(unsafe.setEnabled(row.id, false), /STARTUP_STATE_UNSAFE/);
  assert.deepEqual(registry.writes, []);
  assert.equal(await fs.readFile(outside, 'utf8'), '{"version":1,"records":{}}');
});
test('a prepared backup recovers the original approval after an interrupted final state write', async (t) => {
  const { manager, registry } = await fixture(t);
  const row = (await manager.list()).items.find((item) => item.name === 'Editor');
  const write = manager.store.write.bind(manager.store);
  let calls = 0;
  manager.store.write = async (value) => {
    if (++calls === 2) throw Error('interrupted');
    return write(value);
  };
  const disabled = await manager.setEnabled(row.id, false);
  assert.ok(disabled.warnings.includes('STARTUP_STATE_WRITE'));
  assert.equal(registry.records[0].approval !== null, true);
  await manager.setEnabled(row.id, true);
  assert.equal(registry.records[0].approval, null);
});
test('unsupported platforms never enumerate or modify startup and malformed approval data is not guessed', async (t) => {
  const { manager, registry } = await fixture(t, { platform: 'darwin' });
  registry.snapshot = () => {
    throw Error('must not run');
  };
  assert.deepEqual(await manager.list(), {
    supported: false,
    platform: 'darwin',
    items: [],
    warnings: [],
  });
  await assert.rejects(manager.setEnabled('x', false), /STARTUP_UNSUPPORTED/);
  assert.equal(approvalState(null), true);
  assert.equal(approvalState('not base64'), null);
  assert.equal(approvalState(enabledApproval(), 'String'), null);
});
test('external approval changes are preserved instead of restoring an outdated backup', async (t) => {
  const { manager, registry } = await fixture(t);
  const row = (await manager.list()).items.find((item) => item.name === 'Editor');
  await manager.setEnabled(row.id, false);
  const externallyDisabled = Buffer.alloc(12);
  externallyDisabled.writeUInt32LE(3, 0);
  externallyDisabled[11] = 22;
  registry.records[0].approval = externallyDisabled.toString('base64');
  await manager.list();
  await manager.setEnabled(row.id, true);
  // An external manager took ownership after our disable. Enabling writes the
  // standard enabled flag; it must not restore the now-stale missing baseline.
  assert.equal(registry.records[0].approval, enabledApproval());
});
test('unreadable StartupApproved flags and unsupported registry kinds stay read-only', async (t) => {
  const { manager, registry, directory } = await fixture(t);
  await fs.writeFile(path.join(directory, 'Current.lnk'), 'shortcut');
  registry.records[0].valueKind = 'Binary';
  const snapshot = registry.snapshot.bind(registry);
  registry.snapshot = async () => ({ ...(await snapshot()), folderReadable: false });
  const rows = (await manager.list()).items;
  const current = rows.find((item) => item.name === 'Current.lnk'),
    run = rows.find((item) => item.name === 'Editor');
  assert.equal(current.enabled, null);
  assert.equal(current.canEdit, false);
  assert.equal(current.reason, 'unknown-state');
  assert.equal(run.canEdit, false);
  assert.equal(run.reason, 'unsupported-type');
  await assert.rejects(manager.setEnabled(current.id, true), /STARTUP_READ_ONLY/);
  await assert.rejects(manager.setEnabled(run.id, false), /STARTUP_READ_ONLY/);
  assert.deepEqual(registry.writes, []);
});
test('simultaneous disable requests serialize and write the approval flag only once', async (t) => {
  const { manager, registry } = await fixture(t);
  const row = (await manager.list()).items.find((item) => item.name === 'Editor');
  const results = await Promise.all([
    manager.setEnabled(row.id, false),
    manager.setEnabled(row.id, false),
  ]);
  assert.equal(registry.writes.length, 1);
  assert.ok(
    results.every((result) => result.items.find((item) => item.id === row.id).enabled === false),
  );
});
test('PowerShell executes fixed encoded code and sends startup names only as bounded JSON data', async () => {
  let invocation,
    input = '';
  const spawn = (...args) => {
    invocation = args;
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => child.emit('close', 1);
    child.stdin.on('data', (chunk) => (input += chunk));
    child.stdin.on('finish', () =>
      setImmediate(() => {
        child.stdout.write('{"changed":true}');
        child.emit('close', 0);
      }),
    );
    return child;
  };
  await runPowerShell(SET_SCRIPT, { name: '$(do-not-run); name', source: 'user-run' }, spawn);
  assert.equal(invocation[0], 'powershell.exe');
  assert.equal(invocation[1][2], '-EncodedCommand');
  assert.equal(Buffer.from(invocation[1][3], 'base64').toString('utf16le'), SET_SCRIPT);
  assert.equal(invocation[2].shell, undefined);
  assert.equal(JSON.parse(input).name, '$(do-not-run); name');
  assert.ok(LIST_SCRIPT.includes('GetFolderPath'));
  assert.ok(!SET_SCRIPT.includes('Invoke-Expression'));
});
