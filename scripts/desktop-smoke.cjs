const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { folders } = require('../electron/service.cjs');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-electron-'));
  const desktop = path.join(root, 'Desktop');
  await fs.mkdir(desktop);
  await fs.mkdir(path.join(root, 'Downloads'));
  await fs.mkdir(path.join(root, 'data'));
  await fs.writeFile(path.join(desktop, 'Rapor.pdf'), 'native IPC content');
  const programs = path.join(root, 'Program Files');
  await fs.mkdir(programs);
  const installed = path.join(
    programs,
    process.platform === 'win32' ? 'DemoPlayer.exe' : 'DemoPlayer.appimage',
  );
  await fs.writeFile(installed, 'installed app must stay here');
  let application;
  try {
    application = await electron.launch({
      executablePath: require('electron'),
      args: [
        path.join(__dirname, '../tests/fixtures/desktop-entry.cjs'),
        ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : []),
      ],
      env: { ...process.env, DARKDESK_TEST_ROOT: root },
      timeout: 30000,
    });
    const page = await application.firstWindow();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.locator('.item-card')).toHaveCount(1);
    assert.equal(
      await page.evaluate(() => typeof window.require),
      'undefined',
      'Renderer must not have Node access',
    );
    assert.equal(await page.evaluate(() => typeof window.darkdesk.preview), 'function');
    assert.equal((await page.evaluate(() => window.darkdesk.updateStatus())).state, 'unsupported');
    const accessState = await page.evaluate(() => window.darkdesk.updateStatus());
    assert.equal(accessState.authenticationRequired, true);
    assert.equal(accessState.accessConfigured, false);
    assert.equal('token' in accessState, false);
    assert.equal(
      await page.evaluate(async () => {
        try {
          await window.darkdesk.saveUpdateAccess('TEST_ONLY_NATIVE_ACCESS_1234567890');
          return false;
        } catch (error) {
          return error.message.includes('UPDATE_ACCESS_UNAVAILABLE');
        }
      }),
      true,
      'Development renderer cannot persist a private update credential',
    );
    await assert.rejects(fs.stat(path.join(root, 'data', 'update-access.bin')));
    assert.equal(
      typeof (await page.evaluate(() => window.darkdesk.windowState())).maximized,
      'boolean',
    );
    assert.equal(await page.evaluate(() => typeof window.darkdesk.itemDetails), 'function');
    assert.equal(
      await page.evaluate(async () => {
        try {
          await window.darkdesk.revealOutput('missing-batch');
          return false;
        } catch {
          return true;
        }
      }),
      true,
    );
    const fileInfo = await page.evaluate(() => window.darkdesk.itemDetails('Rapor.pdf'));
    assert.equal(fileInfo.size, Buffer.byteLength('native IPC content'));
    assert.equal(fileInfo.company, null);
    assert.equal(fileInfo.lastOpened, null);
    assert.equal(fileInfo.usageScope, 'darkdesk-only');
    assert.ok(fileInfo.created === null || fileInfo.created > 0);
    assert.ok(fileInfo.icon === null || fileInfo.icon.startsWith('data:image/png;base64,'));
    assert.equal(
      await page.evaluate(async () => {
        try {
          await window.darkdesk.itemDetails('/etc/passwd');
          return false;
        } catch {
          return true;
        }
      }),
      true,
      'Metadata IPC must reject paths outside the trusted index',
    );
    await page.getByRole('button', { name: 'Rapor.pdf ayrıntılarını göster' }).first().click();
    await expect(page.getByRole('dialog')).toContainText('Dosya boyutu');
    await page.keyboard.press('Escape');
    const keysBefore = await page.evaluate(() => window.darkdesk.runtimeStatus());
    assert.equal(keysBefore.shortcuts.find((key) => key.id === 'launcher').accelerator, 'Alt+X');
    const capture = await page.evaluate(() => window.darkdesk.beginShortcutCapture());
    const keysPaused = await page.evaluate(() => window.darkdesk.runtimeStatus());
    assert.ok(keysPaused.shortcuts.every((key) => !key.registered && key.reason === 'recording'));
    await page.evaluate((token) => window.darkdesk.endShortcutCapture(token), capture);
    const keysAfter = await page.evaluate(() => window.darkdesk.runtimeStatus());
    for (const key of keysBefore.shortcuts.filter((key) => key.registered))
      assert.equal(keysAfter.shortcuts.find((row) => row.id === key.id).registered, true);
    for (const key of keysAfter.shortcuts.filter((key) => key.registered))
      assert.equal(
        await application.evaluate(
          ({ globalShortcut }, accelerator) => globalShortcut.isRegistered(accelerator),
          key.accelerator,
        ),
        true,
      );
    await page.getByRole('button', { name: 'Masaüstünü Fiziksel Düzenle' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    assert.deepEqual(await fs.readdir(desktop), ['Rapor.pdf'], 'Preview must not change files');
    await page.getByRole('button', { name: '1 öğeyi taşı' }).click();
    await expect(page.getByRole('region', { name: 'Düzenleme sonucu' })).toContainText('1 taşındı');
    await expect(page.locator('.item-card')).toHaveCount(0);
    assert.equal(
      await fs.readFile(path.join(desktop, folders[3], 'Rapor.pdf'), 'utf8'),
      'native IPC content',
    );
    await page.locator('main').getByRole('button', { name: 'Geri al', exact: true }).click();
    await expect(page.locator('.item-card')).toHaveCount(1);
    assert.equal(await fs.readFile(path.join(desktop, 'Rapor.pdf'), 'utf8'), 'native IPC content');
    await fs.writeFile(path.join(desktop, 'Yeni.txt'), 'watch me');
    await expect(page.locator('.item-card')).toHaveCount(2, { timeout: 10000 });
    assert.equal(
      await fs.readFile(path.join(desktop, 'Yeni.txt'), 'utf8'),
      'watch me',
      'Watching must not move files',
    );
    await page.getByRole('button', { name: 'Otomasyon & Ayarlar' }).click();
    await page.getByRole('radio', { name: /Dosyaları kopyala/ }).click();
    await page.getByRole('button', { name: 'Ayarları kaydet' }).click();
    await expect(page.getByRole('button', { name: 'Ayarları kaydet' })).toBeEnabled();
    const saved = JSON.parse(await fs.readFile(path.join(root, 'data', 'settings.json'), 'utf8'));
    assert.equal(saved.mode, 'copy');
    await page.reload();
    await page.getByRole('button', { name: 'Otomasyon & Ayarlar' }).click();
    await expect(page.getByRole('radio', { name: /Dosyaları kopyala/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('button', { name: 'Sistem Tarama', exact: true }).click();
    await page.getByRole('button', { name: 'Yüklü uygulamalar', exact: true }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Derin taramayı başlat', exact: true }).click();
    await expect(page.locator('.item-card')).toHaveCount(1);
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Masaüstü', exact: true }).click();
    await expect(page.locator('.item-card')).toHaveCount(2);
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Masaüstünü tara', exact: true }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await expect(page.locator('.item-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'İndirilenler', exact: true }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await expect(page.locator('.item-card')).toHaveCount(0);
    await page
      .locator('.scanner-panel')
      .getByRole('button', { name: 'İndirilenleri tara', exact: true })
      .click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await expect(page.locator('.item-card')).toHaveCount(0);
    await page.getByRole('button', { name: 'Yüklü uygulamalar', exact: true }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await expect(page.locator('.item-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Masaüstünü Fiziksel Düzenle' }).click();
    await expect(page.getByRole('dialog')).toContainText('Kurulu programlar taşınmaz.');
    await page.getByRole('button', { name: '1 kısayol oluştur' }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    assert.equal(await fs.readFile(installed, 'utf8'), 'installed app must stay here');
    const batch = JSON.parse(await fs.readFile(path.join(root, 'data', 'history.json'), 'utf8')).at(
      -1,
    );
    const link = batch.entries[0].target;
    assert.equal(batch.entries[0].action, 'shortcut');
    assert.ok((await fs.stat(link)).size > 0);
    if (process.platform === 'win32') {
      assert.match(
        await fs.readFile(path.join(path.dirname(link), 'desktop.ini'), 'utf16le'),
        /IconResource/,
      );
      const details = await application.evaluate(
        ({ shell }, file) => shell.readShortcutLink(file),
        link,
      );
      assert.equal(details.target, installed);
      assert.equal(details.icon, installed);
    }
    await page.locator('main').getByRole('button', { name: 'Geri al', exact: true }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await assert.rejects(fs.stat(link));
    assert.equal(await fs.readFile(installed, 'utf8'), 'installed app must stay here');
    await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
    await page.getByLabel('Dil', { exact: true }).selectOption('en');
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cyberpunk Neon', exact: true }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await page.getByLabel('Icon pack', { exact: true }).selectOption('rounded');
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cyberpunk');
    await page.getByRole('button', { name: 'Automation & Settings', exact: true }).click();
    await expect(page.getByLabel('Icon pack', { exact: true })).toHaveValue('rounded');

    await page.getByRole('button', { name: 'Workspace Profiles', exact: true }).click();
    await page.locator('.profile-activate').filter({ hasText: 'Clean Desktop' }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    const { VisibilityAdapter } = require('../electron/runtime/visibility.cjs');
    const visibility = new VisibilityAdapter(desktop, process.platform);
    assert.equal(await visibility.get(path.join(desktop, 'Rapor.pdf')), true);
    await page.getByRole('button', { name: 'Restore desktop visibility', exact: true }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    assert.equal(await visibility.get(path.join(desktop, 'Rapor.pdf')), false);
    const windowPromise = application.waitForEvent('window');
    await page.evaluate(() => window.darkdesk.openLauncher());
    const quick = await windowPromise;
    await quick.getByRole('combobox', { name: 'Quick search' }).fill('Rapor');
    await expect(quick.getByRole('option').first()).toContainText('Rapor');
    await quick.getByRole('combobox', { name: 'Quick search' }).press('Enter');
    await expect
      .poll(async () => {
        try {
          return JSON.parse(await fs.readFile(path.join(root, 'launch-log.json'), 'utf8')).id;
        } catch {
          return null;
        }
      })
      .toBe('Rapor.pdf');
    await expect
      .poll(async () => {
        const recorded = JSON.parse(
          await fs.readFile(path.join(root, 'data', 'usage.json'), 'utf8'),
        );
        return recorded['Rapor.pdf']?.count;
      })
      .toBe(1);
    assert.ok((await page.evaluate(() => window.darkdesk.itemDetails('Rapor.pdf'))).lastOpened > 0);
    const trayState = await page.evaluate(() => window.darkdesk.runtimeStatus());
    if (trayState.trayAvailable) {
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => !w.webContents.getURL().includes('#launcher'))
            .isVisible(),
        ),
        false,
      );
      await page.evaluate(() => window.darkdesk.runCommand({ type: 'show' }));
    }
    const oldFile = path.join(desktop, 'Old.txt'),
      download = path.join(root, 'Downloads', 'Capture.png');
    await fs.writeFile(oldFile, 'archive bytes');
    await fs.writeFile(download, 'download bytes');
    const oldDate = new Date(Date.now() - 90 * 86400000),
      stable = new Date(Date.now() - 60000);
    await fs.utimes(oldFile, oldDate, oldDate);
    await fs.utimes(download, stable, stable);
    await page.getByRole('button', { name: 'Automation Center', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Archive idle files', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Downloads routing', exact: true }).check();
    await page.getByRole('button', { name: 'Save automation rules', exact: true }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Run enabled rules now', exact: true }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    assert.equal(
      await fs.readFile(path.join(desktop, 'Arşiv', 'Old.txt'), 'utf8'),
      'archive bytes',
    );
    assert.equal(
      await fs.readFile(path.join(desktop, 'Video & Tasarım', 'Capture.png'), 'utf8'),
      'download bytes',
    );
    await page.evaluate(() => window.darkdesk.undo());
    await page.evaluate(() => window.darkdesk.undo());
    assert.equal(await fs.readFile(oldFile, 'utf8'), 'archive bytes');
    assert.equal(await fs.readFile(download, 'utf8'), 'download bytes');
    if (process.platform === 'win32') {
      const probe = path.join(desktop, 'DarkDesk Icon Probe.lnk');
      assert.equal(
        await application.evaluate(
          ({ shell }, file) =>
            shell.writeShortcutLink(file, 'create', {
              target: process.execPath,
              icon: process.execPath,
              iconIndex: 0,
            }),
          probe,
        ),
        true,
      );
      const originalIcon = await page.evaluate(async () => {
        await window.darkdesk.scan();
        return window.darkdesk.itemIcon('DarkDesk Icon Probe.lnk', true);
      });
      assert.equal(
        originalIcon.iconSource,
        'windows-native',
        'Windows CI must extract the real Electron executable icon',
      );
      assert.ok(originalIcon.icon.startsWith('data:image/png;base64,'));
      await fs.unlink(probe);
    }
    await page.getByRole('button', { name: 'Workspace Profiles', exact: true }).click();
    await page.locator('.profile-activate').filter({ hasText: 'Clean Desktop' }).click();
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    assert.equal(await visibility.get(path.join(desktop, 'Rapor.pdf')), true);
    assert.deepEqual(errors, []);
    await application.close();
    application = null;
    const geometry = JSON.parse(
      await fs.readFile(path.join(root, 'data', 'window-state.json'), 'utf8'),
    );
    assert.ok(geometry.bounds.width > 0 && geometry.bounds.height > 0);
    assert.equal(typeof geometry.maximized, 'boolean');
    assert.equal(await visibility.get(path.join(desktop, 'Rapor.pdf')), false);
    console.log(
      'PASS: production Electron renderer, isolated IPC, no Node in renderer, non-mutating preview, real move/undo, file watcher, installed-app shortcuts/undo, shortcut icons, focus visibility/quit restore, source-specific scanner switching, native Spotlight dispatch, trusted native icons/metadata, shortcut capture/resume, tray hiding, archive/Downloads automation and persistent preferences.',
    );
  } finally {
    if (application) await application.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
