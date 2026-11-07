const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const {
  LauncherActions,
  webSearch,
  powershell,
  ADMIN_SCRIPT,
  MUTE_SCRIPT,
  TRASH_SCRIPT,
} = require('./runtime/launcher-actions.cjs');

async function fixture(t, overrides = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-launcher-actions-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'Demo.exe');
  await fs.writeFile(file, 'local executable fixture only');
  const stat = await fs.stat(file);
  const item = { id: 'app:demo', source: file, size: stat.size, modified: stat.mtimeMs };
  const calls = [];
  let clipboard = '';
  const actions = new LauncherActions({
    platform: 'win32',
    resolveItem: (id) => (id === item.id ? item : null),
    shell: {
      showItemInFolder: (value) => calls.push(['reveal', value]),
      openExternal: async (value) => calls.push(['web', value]),
    },
    clipboard: {
      writeText: (value) => {
        clipboard = value;
      },
    },
    execute: async (...args) => calls.push(['exec', ...args]),
    executePowerShell: async (...args) => calls.push(['ps', ...args]),
    ...overrides,
  });
  return { root, file, item, calls, actions, clipboard: () => clipboard };
}

test('web searches construct only known HTTPS search origins and encode the query as data', () => {
  for (const [provider, origin, key] of [
    ['google', 'https://www.google.com', 'q'],
    ['youtube', 'https://www.youtube.com', 'search_query'],
    ['github', 'https://github.com', 'q'],
  ]) {
    const query = 'ünicode &q=https://evil.example/#fragment';
    const url = new URL(webSearch(provider, query));
    assert.equal(url.origin, origin);
    assert.equal(url.searchParams.get(key), query);
    assert.equal(url.hash, '');
  }
  for (const [provider, query] of [
    ['__proto__', 'x'],
    ['https://evil.example', 'x'],
    ['google', ''],
    ['google', '\n'],
    ['github', 'x'.repeat(513)],
    ['google', 'line\nnext'],
  ])
    assert.throws(() => webSearch(provider, query), /LAUNCHER_INPUT_INVALID/);
});

test('clipboard and web actions use bounded data and never call an executable', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await f.actions.action({ type: 'copy', text: '5400' }), {
    type: 'copy',
    copied: true,
  });
  assert.equal(f.clipboard(), '5400');
  await f.actions.action({ type: 'web', provider: 'github', query: 'react hooks' });
  assert.deepEqual(f.calls, [['web', 'https://github.com/search?q=react+hooks']]);
  for (const value of ['', '\0', 'x'.repeat(16385), 24])
    await assert.rejects(f.actions.action({ type: 'copy', text: value }), /LAUNCHER_INPUT_INVALID/);
  await assert.rejects(
    f.actions.action({ type: 'web', provider: 'file:', query: 'x' }),
    /LAUNCHER_INPUT_INVALID/,
  );
  await assert.rejects(
    f.actions.action({ type: 'exec', command: 'shutdown' }),
    /LAUNCHER_INPUT_INVALID/,
  );
});

test('destructive commands need an expiring single-use confirmation token before any action', async (t) => {
  let now = 1000,
    sequence = 0;
  const f = await fixture(t, { clock: () => now, token: () => 'test-token-' + ++sequence });
  for (const id of ['empty-trash', 'shutdown']) {
    await assert.rejects(f.actions.action({ type: 'system', id }), /LAUNCHER_CONFIRM_REQUIRED/);
    const prepared = await f.actions.action({ type: 'prepare-system', id });
    assert.equal(prepared.id, id);
    assert.equal(prepared.expiresAt, now + 30000);
    assert.equal(f.calls.length, id === 'empty-trash' ? 0 : 1);
    await f.actions.action({
      type: 'confirm-system',
      token: prepared.token,
      id: 'injected-other-action',
    });
    await assert.rejects(
      f.actions.action({ type: 'confirm-system', token: prepared.token }),
      /LAUNCHER_CONFIRM_EXPIRED/,
    );
  }
  const expired = f.actions.prepare('empty-trash');
  now = expired.expiresAt;
  await assert.rejects(
    f.actions.action({ type: 'confirm-system', token: expired.token }),
    /LAUNCHER_CONFIRM_EXPIRED/,
  );
  await assert.rejects(
    f.actions.action({ type: 'confirm-system', token: 'forged' }),
    /LAUNCHER_CONFIRM_EXPIRED/,
  );
  assert.deepEqual(
    f.calls.map(([kind, name]) => [kind, name]),
    [
      ['ps', TRASH_SCRIPT],
      ['exec', 'shutdown.exe'],
    ],
  );
});

test('fixed system adapters receive only their allowlisted arguments and profile restoration precedes shutdown', async (t) => {
  const ordering = [];
  const f = await fixture(t, {
    beforeShutdown: async () => ordering.push('restore'),
    execute: async (...args) => ordering.push(args),
    executePowerShell: async (...args) => ordering.push(args),
  });
  await f.actions.action({ type: 'system', id: 'lock', args: ['injected'] });
  await f.actions.action({ type: 'system', id: 'mute' });
  const prepared = f.actions.prepare('shutdown');
  await f.actions.action({ type: 'confirm-system', token: prepared.token });
  assert.equal(ordering[0][0], 'rundll32.exe');
  assert.deepEqual(ordering[0][1], ['user32.dll,LockWorkStation']);
  assert.deepEqual(ordering[1], [MUTE_SCRIPT, { action: 'mute' }]);
  assert.equal(ordering[2], 'restore');
  assert.equal(ordering[3][0], 'shutdown.exe');
  assert.deepEqual(ordering[3][1], ['/s', '/t', '0']);
  assert.equal(ordering[3][1].includes('/f'), false);
  await assert.rejects(
    f.actions.action({ type: 'prepare-system', id: 'lock' }),
    /LAUNCHER_INPUT_INVALID/,
  );
  await assert.rejects(
    f.actions.action({ type: 'system', id: '__proto__' }),
    /LAUNCHER_INPUT_INVALID/,
  );
});

test('unsupported platforms expose no system/admin capability and never claim those actions succeeded', async (t) => {
  const f = await fixture(t, { platform: 'linux' });
  assert.deepEqual(f.actions.capabilities(), {
    system: [],
    admin: false,
    reveal: true,
    web: true,
    copy: true,
  });
  for (const input of [
    { type: 'system', id: 'lock' },
    { type: 'prepare-system', id: 'shutdown' },
    { type: 'admin', id: f.item.id },
  ])
    await assert.rejects(f.actions.action(input), /LAUNCHER_UNSUPPORTED/);
  assert.deepEqual(f.calls, []);
});

test('revealing a file requires a trusted unchanged regular source', async (t) => {
  const f = await fixture(t);
  await f.actions.action({ type: 'reveal', id: f.item.id, source: '/etc/passwd' });
  assert.deepEqual(f.calls, [['reveal', f.file]]);
  await assert.rejects(f.actions.action({ type: 'reveal', id: '/etc/passwd' }), /SOURCE_MISSING/);
  await fs.writeFile(f.file, 'changed file');
  await assert.rejects(
    f.actions.action({ type: 'reveal', id: f.item.id }),
    /LAUNCHER_SOURCE_CHANGED/,
  );
  await fs.unlink(f.file);
  await assert.rejects(f.actions.action({ type: 'reveal', id: f.item.id }), /SOURCE_MISSING/);
});

test('a source symlink cannot redirect privileged launch or reveal outside the trusted file', async (t) => {
  const f = await fixture(t);
  const link = path.join(f.root, 'Substituted.exe');
  try {
    await fs.symlink(f.file, link, 'file');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('File symlink privilege unavailable');
    throw error;
  }
  f.actions.resolveItem = () => ({ id: 'substituted', source: link });
  await assert.rejects(f.actions.action({ type: 'reveal', id: 'substituted' }), /SOURCE_MISSING/);
  await assert.rejects(f.actions.action({ type: 'admin', id: 'substituted' }), /SOURCE_MISSING/);
  assert.deepEqual(f.calls, []);
});

test('admin execution keeps shortcut arguments in JSON data and rejects non-executable targets', async (t) => {
  const f = await fixture(t);
  const shortcut = path.join(f.root, 'Trusted.lnk');
  await fs.writeFile(shortcut, 'shortcut fixture');
  const stat = await fs.stat(shortcut);
  const argumentsText = '--profile "a b";$(Write-Output injected)';
  f.actions.resolveItem = (id) =>
    id === 'shortcut' ? { id, source: shortcut, size: stat.size, modified: stat.mtimeMs } : f.item;
  f.actions.resolveShortcut = async () => ({ target: f.file, args: argumentsText, cwd: f.root });
  await f.actions.action({ type: 'admin', id: 'shortcut' });
  assert.deepEqual(f.calls, [
    ['ps', ADMIN_SCRIPT, { target: f.file, arguments: argumentsText, cwd: f.root }],
  ]);
  assert.equal(ADMIN_SCRIPT.includes(argumentsText), false);
  f.actions.resolveShortcut = async () => ({ target: path.join(f.root, 'script.ps1'), args: '' });
  await assert.rejects(
    f.actions.action({ type: 'admin', id: 'shortcut' }),
    /LAUNCHER_ADMIN_UNSUPPORTED/,
  );
  f.actions.resolveShortcut = async () => ({ target: f.file, args: 'line\nnext' });
  await assert.rejects(
    f.actions.action({ type: 'admin', id: 'shortcut' }),
    /LAUNCHER_INPUT_INVALID/,
  );
});

test('an unsuccessful shutdown preparation consumes confirmation but never starts the OS command', async (t) => {
  const f = await fixture(t, {
    beforeShutdown: async () => {
      throw Error('profile restoration failed');
    },
  });
  const prepared = f.actions.prepare('shutdown');
  await assert.rejects(
    f.actions.action({ type: 'confirm-system', token: prepared.token }),
    /profile restoration failed/,
  );
  assert.deepEqual(f.calls, []);
  await assert.rejects(
    f.actions.action({ type: 'confirm-system', token: prepared.token }),
    /LAUNCHER_CONFIRM_EXPIRED/,
  );
});

function fakeChild(complete) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {
    child.emit('close', 1);
  };
  child.stdin.on('finish', () => setImmediate(() => complete(child)));
  return child;
}
test('PowerShell receives fixed encoded source and bounded JSON stdin without a shell', async () => {
  let call,
    input = '';
  await powershell(
    ADMIN_SCRIPT,
    { target: 'C:\\App.exe', arguments: '$(malicious)' },
    (...args) => {
      call = args;
      const child = fakeChild((child) => child.emit('close', 0));
      child.stdin.on('data', (chunk) => {
        input += chunk;
      });
      return child;
    },
  );
  assert.equal(call[0], 'powershell.exe');
  assert.deepEqual(call[1].slice(0, 3), ['-NoProfile', '-NonInteractive', '-EncodedCommand']);
  assert.equal(Buffer.from(call[1][3], 'base64').toString('utf16le'), ADMIN_SCRIPT);
  assert.equal(JSON.parse(input).arguments, '$(malicious)');
  assert.equal(call[2].shell, undefined);
  await assert.rejects(
    powershell(ADMIN_SCRIPT, {}, () =>
      fakeChild((child) => child.stderr.write(Buffer.alloc(65537))),
    ),
    /LAUNCHER_ACTION_FAILED/,
  );
  await assert.rejects(
    powershell(ADMIN_SCRIPT, {}, () => fakeChild((child) => child.emit('close', 1))),
    /LAUNCHER_ACTION_FAILED/,
  );
});

test('audio and Wi-Fi actions use fixed native adapters; Windows tools use allowlisted settings URIs', async (t) => {
  const { AUDIO_SCRIPT, WIFI_SCRIPT } = require('./runtime/windows-audio.cjs');
  const f = await fixture(t);
  for (const id of ['mute', 'unmute', 'volume-up', 'volume-down', 'wifi-on', 'wifi-off']) {
    await f.actions.system(id);
    assert.deepEqual(f.calls.at(-1), [
      'ps',
      id.startsWith('wifi-') ? WIFI_SCRIPT : AUDIO_SCRIPT,
      { action: id },
    ]);
  }
  for (const [id, uri] of Object.entries({
    screenshot: 'ms-screenclip:',
    'night-light': 'ms-settings:nightlight',
    'clean-space': 'ms-settings:storagesense',
  })) {
    await f.actions.system(id);
    assert.deepEqual(f.calls.at(-1), ['web', uri]);
  }
  const failed = await fixture(t, {
    executePowerShell: async () => {
      throw Error('DEVICE_UNAVAILABLE');
    },
  });
  await assert.rejects(failed.actions.system('mute'), /DEVICE_UNAVAILABLE/);
});

test(
  'Windows compiles Core Audio interop without modifying audio or radio state',
  { skip: process.platform !== 'win32' },
  async () => {
    const { AUDIO_TYPES, WIFI_SCRIPT } = require('./runtime/windows-audio.cjs');
    await powershell(
      `$ErrorActionPreference='Stop';try{Add-Type -TypeDefinition @'\n${AUDIO_TYPES}\n'@; $tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseInput(([Console]::In.ReadToEnd()|ConvertFrom-Json),[ref]$tokens,[ref]$errors)>$null;if($errors.Count){exit 1}}catch{exit 1}`,
      WIFI_SCRIPT,
    );
  },
);
