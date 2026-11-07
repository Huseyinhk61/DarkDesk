const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { readDesktopEntry, launchLinuxItem } = require('./runtime/linux-apps.cjs');
const { DeepScanner } = require('./scanner.cjs');
const { defaultSettings } = require('../shared/domain.js');
const { resolveAppPurpose } = require('../shared/app-insights.js');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-xdg-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test('desktop metadata reads localized values from the Desktop Entry only, without executing Exec', async (t) => {
  const root = await fixture(t),
    file = path.join(root, 'org.example.app.desktop');
  await fs.writeFile(
    file,
    '[Desktop Entry]\nType=Application\nName=Example\nName[tr]=Örnek\nComment=Keeps projects organized\nComment[tr]=Projeleri düzenler\nExec=sh -c "touch SHOULD_NOT_EXIST"\n[Desktop Action Other]\nName=Not the app\n',
  );
  const value = await readDesktopEntry(file, 'tr');
  assert.equal(value.productName, 'Örnek');
  assert.equal(value.desktopDescription, 'Projeleri düzenler');
  assert.equal(value.application, true);
  assert.equal(value.hidden, false);
  assert.equal(value.Exec, undefined);
  assert.deepEqual(await fs.readdir(root), ['org.example.app.desktop']);
  assert.equal(
    resolveAppPurpose(
      { name: 'org.example.app.desktop', desktopDescription: value.desktopDescription },
      null,
      null,
    ).source,
    'linux-desktop',
  );
  await fs.writeFile(file, 'x'.repeat(262145));
  await assert.rejects(readDesktopEntry(file), /DESKTOP_ENTRY_INVALID/);
});
test('Linux scanner uses readable app names for AI matching and filters hidden service entries', async (t) => {
  const root = await fixture(t);
  for (const [name, body] of [
    ['org.example.Editor.desktop', 'Type=Application\nName=Cursor\nComment=An AI editor'],
    ['hidden.desktop', 'Type=Application\nName=Hidden\nNoDisplay=true'],
    ['link.desktop', 'Type=Link\nName=Website'],
  ])
    await fs.writeFile(path.join(root, name), '[Desktop Entry]\n' + body + '\n');
  const scanner = new DeepScanner({
    platform: 'linux',
    roots: [{ path: root, label: 'linuxUser' }],
  });
  const result = await scanner.scan(defaultSettings);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].productName, 'Cursor');
  assert.equal(result.items[0].category, 'aicode');
  assert.equal(result.items[0].desktopDescription, 'An AI editor');
});
test('Linux launch delegates desktop parsing to GIO and launches AppImages without a shell', async () => {
  const calls = [];
  const spawnProcess = (file, args, options) => {
    calls.push({ file, args, options });
    const child = new EventEmitter();
    child.unref = () => {};
    queueMicrotask(() => {
      child.emit('spawn');
      child.emit('close', 0);
    });
    return child;
  };
  await launchLinuxItem({ source: '/safe/My app.desktop' }, { spawnProcess });
  assert.deepEqual(calls[0].args, ['launch', '/safe/My app.desktop']);
  assert.equal(calls[0].file, 'gio');
  assert.equal(calls[0].options.shell, false);
  await launchLinuxItem({ source: '/safe/My app.AppImage' }, { spawnProcess });
  assert.equal(calls[1].file, '/safe/My app.AppImage');
  assert.deepEqual(calls[1].args, []);
  await assert.rejects(
    launchLinuxItem(
      { source: '/safe/a.desktop' },
      {
        spawnProcess: () => {
          const child = new EventEmitter();
          queueMicrotask(() => child.emit('error', Error('missing gio')));
          return child;
        },
      },
    ),
    /LAUNCH_FAILED/,
  );
});

test(
  'real Linux GIO dispatch launches an isolated marker entry and rejects broken launchers',
  { skip: process.platform !== 'linux' },
  async (t) => {
    const root = await fixture(t),
      marker = path.join(root, 'launched'),
      file = path.join(root, 'fixture.desktop');
    await fs.writeFile(
      file,
      `[Desktop Entry]\nVersion=1.0\nType=Application\nName=DarkDesk fixture\nExec=/usr/bin/touch ${marker}\nTerminal=false\n`,
    );
    await launchLinuxItem({ source: file });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      try {
        await fs.stat(marker);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    assert.ok((await fs.stat(marker)).isFile());
    await fs.writeFile(
      file,
      '[Desktop Entry]\nType=Application\nName=Broken\nExec=/nonexistent/darkdesk-test\n',
    );
    await assert.rejects(launchLinuxItem({ source: file }), /LAUNCH_FAILED/);
  },
);

test('unknown Linux applications use their declared freedesktop categories without executing their commands', async (t) => {
  const root = await fixture(t),
    file = path.join(root, 'org.private.work.desktop');
  await fs.writeFile(
    file,
    '[Desktop Entry]\nType=Application\nName=Opaque Widget\nComment=Private app\nCategories=Network;WebBrowser;\nExec=sh -c "exit 99"\n',
  );
  const info = await readDesktopEntry(file);
  assert.deepEqual(info.desktopCategories, ['Network', 'WebBrowser']);
  const scanner = new DeepScanner({ platform: 'linux', roots: [{ path: root, label: 'custom' }] });
  const result = await scanner.scan(defaultSettings);
  assert.equal(result.items[0].category, 'internetbrowsers');
});
