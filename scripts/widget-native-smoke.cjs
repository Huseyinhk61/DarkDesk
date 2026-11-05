// Runs only against an isolated temporary profile and its own widget windows.
// No startup entries, host desktop files, or productivity tracking are changed.
const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

async function widgetPage(application, id) {
  await expect
    .poll(() => application.windows().some((page) => page.url().endsWith('#widget=' + id)))
    .toBe(true);
  const page = application.windows().find((page) => page.url().endsWith('#widget=' + id));
  await expect(page.locator('.desktop-widget')).toBeVisible();
  return page;
}

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-widget-native-'));
  const base = process.env.DARKDESK_TEST_PACKAGE || path.resolve(__dirname, '..');
  let application;
  const pageErrors = [];
  try {
    for (const folder of ['Desktop', 'Downloads', 'Public Desktop', 'Program Files', 'data'])
      await fs.mkdir(path.join(root, folder));
    application = await electron.launch({
      executablePath: require('electron'),
      args: [
        path.join(__dirname, '../tests/fixtures/desktop-entry.cjs'),
        ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : []),
      ],
      env: { ...process.env, DARKDESK_TEST_ROOT: root },
      timeout: 45000,
    });
    const main = await application.firstWindow();
    application.on('window', (page) =>
      page.on('pageerror', (error) => pageErrors.push(error.message)),
    );
    main.on('pageerror', (error) => pageErrors.push(error.message));
    await main.waitForFunction(() => typeof window.darkdesk?.widgetState === 'function');
    const initial = await main.evaluate(() => window.darkdesk.widgetState());
    assert.equal(initial.note, '');
    assert.deepEqual(initial.todos, []);
    assert.ok(Object.values(initial.widgets).every((widget) => widget.enabled === false));
    const analytics = await main.evaluate(() => window.darkdesk.analyticsStatus());
    assert.equal(analytics.enabled, false, 'A fresh profile must never opt into process tracking');
    assert.deepEqual(analytics.days, []);
    const startup = await main.evaluate(() => window.darkdesk.getStartupApps());
    assert.equal(startup.supported, process.platform === 'win32');
    assert.ok(Array.isArray(startup.items));
    if (process.platform === 'win32') {
      assert.ok(Array.isArray(startup.warnings));
      assert.ok(
        !startup.warnings.includes('STARTUP_USER_UNAVAILABLE'),
        'Current-user registry adapter must compile and read',
      );
      assert.ok(startup.items.every((item) => typeof item.canEdit === 'boolean'));
    }
    if (['win32', 'darwin'].includes(process.platform)) {
      // One read-only CI adapter probe, never enabled or persisted as analytics.
      const sampled = await application.evaluate(async ({}, packageBase) => {
        const nativeRequire = process
          .getBuiltinModule('node:module')
          .createRequire(packageBase + '/package.json');
        const { sampleForeground } = nativeRequire('./electron/runtime/productivity.cjs');
        const value = await sampleForeground();
        return {
          valid:
            value === null ||
            (Array.isArray(value.running) &&
              (value.foreground === null || typeof value.foreground.name === 'string')),
        };
      }, base);
      assert.equal(sampled.valid, true);
      assert.deepEqual(
        (await main.evaluate(() => window.darkdesk.analyticsStatus())).days,
        [],
        'Read-only probe must not create analytics history',
      );
    }

    // The optional native addon must work in Electron, including from an ASAR.
    const native = await application.evaluate(({}, packageBase) => {
      const nativeRequire = process
        .getBuiltinModule('node:module')
        .createRequire(packageBase + '/package.json');
      const koffi = nativeRequire('koffi');
      if (process.platform === 'win32') {
        const getPid = koffi.load('kernel32.dll').func('GetCurrentProcessId', 'uint32', []);
        return { expected: process.pid, actual: getPid() };
      }
      if (process.platform === 'darwin') {
        const getPid = koffi.load('/usr/lib/libSystem.B.dylib').func('getpid', 'int', []);
        return { expected: process.pid, actual: getPid() };
      }
      const length = koffi.load('libc.so.6').func('strlen', 'size_t', ['str']);
      return { expected: 8, actual: length('DarkDesk') };
    }, base);
    assert.equal(
      native.actual,
      native.expected,
      'Native addon must resolve and call a read-only OS function',
    );

    if (process.platform === 'win32') {
      // HWND 0 exits before shell discovery/reparenting, while compiling all C#.
      const compiled = await application.evaluate(async ({}, packageBase) => {
        const nativeRequire = process
          .getBuiltinModule('node:module')
          .createRequire(packageBase + '/package.json');
        const { runAttachment } = nativeRequire('./electron/runtime/widget-desktop.cjs');
        return runAttachment({ handle: '0', pid: process.pid, deadline: Date.now() + 4500 });
      }, base);
      assert.equal(compiled.attached, false);
      assert.equal(compiled.reason, 'window-unavailable');
    }

    await main.evaluate(() => window.darkdesk.saveWidgets({ placement: 'floating' }));
    for (const id of ['system', 'note', 'todos'])
      await main.evaluate((id) => window.darkdesk.showWidget(id), id);
    const system = await widgetPage(application, 'system');
    const note = await widgetPage(application, 'note');
    const todos = await widgetPage(application, 'todos');
    for (const page of [system, note, todos]) {
      assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
      assert.equal(
        await page.evaluate(async () => {
          try {
            await window.darkdesk.history();
            return false;
          } catch (error) {
            return error.message.includes('IPC_DENIED');
          }
        }),
        true,
        'A widget is restricted to its own small IPC allowlist',
      );
    }
    const metrics = await system.evaluate(() => window.darkdesk.systemToolsSnapshot());
    assert.ok(metrics.memory.total > 0);
    assert.ok(metrics.memory.used >= 0 && metrics.memory.used <= metrics.memory.total);
    assert.ok(metrics.coreCount > 0);
    await expect
      .poll(
        async () => (await system.evaluate(() => window.darkdesk.systemToolsSnapshot())).cpuPercent,
        { timeout: 7000 },
      )
      .toEqual(expect.any(Number));
    const cpu = await system.evaluate(() => window.darkdesk.systemToolsSnapshot());
    assert.ok(cpu.cpuPercent >= 0 && cpu.cpuPercent <= 100);

    // Hide immediately, before the debounce: the native close path must flush.
    await note.locator('textarea').fill('An isolated native note — saved before hiding.');
    await main.evaluate(() => window.darkdesk.hideWidget('note'));
    assert.equal(
      (await main.evaluate(() => window.darkdesk.widgetState())).note,
      'An isolated native note — saved before hiding.',
    );
    await main.evaluate(() => window.darkdesk.showWidget('note'));
    await expect(note.locator('textarea')).toHaveValue(
      'An isolated native note — saved before hiding.',
    );
    const todoInput = todos.locator('.widget-todo-form input');
    await todoInput.fill('Verify the real widget window');
    await todoInput.press('Enter');
    await expect(todos.locator('.widget-todos li')).toHaveCount(1);
    await todos.locator('.widget-todos input[type=checkbox]').click();
    await expect
      .poll(async () => (await main.evaluate(() => window.darkdesk.widgetState())).todos[0]?.done)
      .toBe(true);
    await expect(todos.locator('.widget-todos input[type=checkbox]')).toBeChecked();
    await todos.locator('.widget-todos button').click();
    await expect(todos.locator('.widget-todos li')).toHaveCount(0);
    await todoInput.fill('Persist across application restart');
    await todoInput.press('Enter');
    await expect(todos.locator('.widget-todos li')).toHaveCount(1);

    if (['win32', 'darwin'].includes(process.platform)) {
      await main.evaluate(() => window.darkdesk.saveWidgets({ placement: 'desktop' }));
      const attached = await main.evaluate(() => window.darkdesk.widgetState());
      if (process.platform === 'darwin') {
        assert.equal(
          attached.placements.note.mode,
          'desktop',
          'macOS must attach its own normal interactive NSWindow',
        );
        assert.equal(attached.placements.note.supported, true);
      } else {
        assert.ok(['desktop', 'floating'].includes(attached.placements.note.mode));
        assert.equal(
          attached.placements.note.supported,
          attached.placements.note.mode === 'desktop',
        );
        if (attached.placements.note.mode === 'floating')
          assert.equal(typeof attached.placements.note.reason, 'string');
      }
      const attachedNote = await widgetPage(application, 'note');
      await attachedNote.locator('textarea').fill('Interactive after native desktop placement.');
      await main.evaluate(() => window.darkdesk.hideWidget('note'));
      assert.equal(
        (await main.evaluate(() => window.darkdesk.widgetState())).note,
        'Interactive after native desktop placement.',
      );
      await main.evaluate(() => window.darkdesk.showWidget('note'));
    }

    const savedState = await main.evaluate(() => window.darkdesk.widgetState());
    assert.ok(Object.values(savedState.widgets).every((widget) => widget.enabled));
    assert.ok(Object.values(savedState.widgets).every((widget) => widget.bounds.width >= 100));
    await application.close();
    application = null;
    const persisted = JSON.parse(await fs.readFile(path.join(root, 'data/widgets.json'), 'utf8'));
    assert.equal(persisted.note, savedState.note);
    assert.deepEqual(persisted.todos, savedState.todos);
    assert.ok(
      Object.values(persisted.widgets).every((widget) => widget.enabled),
      'Quit preserves explicit widget visibility for next launch',
    );
    application = await electron.launch({
      executablePath: require('electron'),
      args: [
        path.join(__dirname, '../tests/fixtures/desktop-entry.cjs'),
        ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : []),
      ],
      env: { ...process.env, DARKDESK_TEST_ROOT: root },
      timeout: 45000,
    });
    const reopened = await widgetPage(application, 'note');
    await expect(reopened.locator('textarea')).toHaveValue(savedState.note);
    const restoredTodos = await widgetPage(application, 'todos');
    await expect(restoredTodos.locator('.widget-todos li')).toHaveCount(1);
    assert.deepEqual(pageErrors, []);
    await application.close();
    application = null;
    console.log(
      'PASS: isolated real widget windows, CPU/RAM metrics, note flush, todo persistence/restart, restricted widget IPC, native addon loading' +
        (process.platform === 'win32'
          ? ', Windows desktop bridge C# compilation.'
          : process.platform === 'darwin'
            ? ', interactive macOS desktop-layer attachment.'
            : '.'),
    );
  } finally {
    if (application) await application.close().catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  if (process.env.GITHUB_ACTIONS === 'true')
    console.log(
      '::error title=DarkDesk widget native smoke::' +
        String(error.stack || error)
          .slice(0, 6000)
          .replaceAll('%', '%25')
          .replaceAll('\r', '%0D')
          .replaceAll('\n', '%0A'),
    );
  console.error(error);
  process.exitCode = 1;
});
