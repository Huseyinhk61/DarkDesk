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
    await page.getByRole('button', { name: 'Masaüstünü Fiziksel Düzenle' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    assert.deepEqual(await fs.readdir(desktop), ['Rapor.pdf'], 'Preview must not change files');
    await page.getByRole('button', { name: '1 öğeyi taşı' }).click();
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
    await page.getByRole('button', { name: 'Derin taramayı başlat', exact: true }).click();
    await expect(page.locator('.item-card')).toHaveCount(1);
    await expect(page.locator('.activity-bar')).toHaveCount(0);
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
      assert.ok(details.icon.endsWith('.ico'));
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
    await page.getByLabel('Icon pack', { exact: true }).selectOption('tabler');
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cyberpunk');
    await page.getByRole('button', { name: 'Automation & Settings', exact: true }).click();
    await expect(page.getByLabel('Icon pack', { exact: true })).toHaveValue('tabler');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: production Electron renderer, isolated IPC, no Node in renderer, non-mutating preview, real move/undo, file watcher, installed-app shortcuts/undo, shortcut icon references and persistent theme/language/icon preferences.',
    );
  } finally {
    if (application) await application.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
