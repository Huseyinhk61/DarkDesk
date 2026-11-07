// Runs only against an isolated temporary profile and its own widget windows.
// No startup entries, host desktop files, or productivity tracking are changed.
const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

async function closeApplication(application) {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    application.process()?.kill('SIGKILL');
  }, 20000);
  try {
    await application.close();
    if (timedOut) throw Error('Native widget shutdown timed out');
  } finally {
    clearTimeout(timer);
  }
}
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
    await main.evaluate(() => window.darkdesk.setCommandFavorite('command:show', true));
    assert.ok(
      (await main.evaluate(() => window.darkdesk.getSettings())).launcherCommandFavorites.includes(
        'command:show',
      ),
    );
    await main.evaluate(() => window.darkdesk.setCommandFavorite('command:show', false));
    await application.evaluate(({}, packageBase) => {
      const req = process
        .getBuiltinModule('node:module')
        .createRequire(packageBase + '/package.json');
      const proto = req('./electron/runtime/currency.cjs').CurrencyService.prototype;
      globalThis.__oldCurrencyRates = proto.rates;
      proto.rates = async () => ({
        date: new Date().toISOString().slice(0, 10),
        rates: { USD: 1, TRY: 40 },
        cached: false,
      });
    }, base);
    try {
      const quote = await main.evaluate(() =>
        window.darkdesk.currencyQuote({ amount: 50, from: 'USD', to: 'TRY' }),
      );
      assert.equal(quote.value, 2000);
    } finally {
      await application.evaluate(({}, packageBase) => {
        const req = process
          .getBuiltinModule('node:module')
          .createRequire(packageBase + '/package.json');
        req('./electron/runtime/currency.cjs').CurrencyService.prototype.rates =
          globalThis.__oldCurrencyRates;
        delete globalThis.__oldCurrencyRates;
      }, base);
    }
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

    await main.evaluate(() => window.darkdesk.saveWidgets({ collapsed: { note: true } }));
    await expect(note.locator('textarea')).toBeHidden();
    const collapsedHeight = await application.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((window) => window.webContents.getURL().endsWith('#widget=note'))
          .getBounds().height,
    );
    assert.equal(collapsedHeight, 44);
    await main.evaluate(() => window.darkdesk.saveWidgets({ collapsed: { note: false } }));
    await expect(note.locator('textarea')).toBeVisible();

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
        assert.equal(attached.placements.note.mode, 'floating');
        assert.equal(attached.placements.note.reason, 'editable');
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

    for (const id of ['clock', 'focus'])
      await main.evaluate((id) => window.darkdesk.showWidget(id), id);
    const clock = await widgetPage(application, 'clock');
    await expect(clock.locator('.clock-widget strong')).toHaveText(/\d{2}:\d{2}:\d{2}/);
    const focus = await widgetPage(application, 'focus');
    await focus.getByRole('button', { name: 'Başlat', exact: true }).click();
    await expect(focus.getByRole('button', { name: 'Duraklat', exact: true })).toBeVisible();
    await focus.getByRole('button', { name: 'Duraklat', exact: true }).click();
    await main.evaluate(() =>
      window.darkdesk.saveWidgets({
        focus: {
          alarm: false,
          breakDuration: 2,
          cycles: 2,
          remaining: 1,
          endsAt: Date.now() + 700,
        },
      }),
    );
    await expect(focus.getByRole('timer')).toHaveText('02:00');
    const completedFocus = (await main.evaluate(() => window.darkdesk.widgetState())).focus;
    assert.equal(completedFocus.phase, 'break');
    assert.equal(completedFocus.completed, 1);
    assert.equal((await main.evaluate(() => window.darkdesk.completeFocus(1))).completed, false);

    await main.evaluate(() =>
      window.darkdesk.saveWidgets({
        appearance: { note: { opacity: 55, size: 'large', blur: 7 } },
      }),
    );
    assert.equal(
      (await main.evaluate(() => window.darkdesk.widgetState())).appearance.note.opacity,
      55,
    );
    // Some native macOS compositors omit the backdrop-filter longhand from
    // computed style. Verify the actual window receives the persisted value;
    // browser tests separately exercise the standard blur declaration.
    await expect(note.locator('.desktop-widget')).toHaveCSS('--widget-blur', '7px');
    await application.evaluate(({}, packageBase) => {
      const req = process
        .getBuiltinModule('node:module')
        .createRequire(packageBase + '/package.json');
      const proto = req('./electron/runtime/currency.cjs').CurrencyService.prototype;
      globalThis.__widgetOriginalRates = proto.rates;
      proto.rates = async () => ({
        date: new Date().toISOString().slice(0, 10),
        rates: { USD: 1, TRY: 40, EUR: 0.8 },
        cached: false,
      });
    }, base);
    try {
      await main.evaluate(() => window.darkdesk.showWidget('currency'));
      const currency = await widgetPage(application, 'currency');
      await expect(currency.locator('.currency-result')).toContainText('40 TRY');
      await main.evaluate(() => window.darkdesk.hideWidget('currency'));
    } finally {
      await application.evaluate(({}, packageBase) => {
        const req = process
          .getBuiltinModule('node:module')
          .createRequire(packageBase + '/package.json');
        req('./electron/runtime/currency.cjs').CurrencyService.prototype.rates =
          globalThis.__widgetOriginalRates;
        delete globalThis.__widgetOriginalRates;
      }, base);
    }

    const savedState = await main.evaluate(() => window.darkdesk.widgetState());
    assert.ok(['system', 'note', 'todos'].every((id) => savedState.widgets[id].enabled));
    assert.ok(
      Object.values(savedState.widgets)
        .filter((widget) => widget.enabled)
        .every((widget) => widget.bounds.width >= 100),
    );
    await closeApplication(application);
    application = null;
    const persisted = JSON.parse(await fs.readFile(path.join(root, 'data/widgets.json'), 'utf8'));
    assert.equal(persisted.note, savedState.note);
    assert.deepEqual(persisted.todos, savedState.todos);
    assert.ok(
      ['system', 'note', 'todos'].every((id) => persisted.widgets[id].enabled),
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
    await closeApplication(application);
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
    if (application) await closeApplication(application).catch(() => {});
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
