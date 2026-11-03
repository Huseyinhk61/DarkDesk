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
    await page.getByRole('button', { name: 'Geri al', exact: true }).click();
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
    assert.deepEqual(errors, []);
    console.log(
      'PASS: production Electron renderer, isolated IPC, no Node in renderer, non-mutating preview, real move/undo, file watcher and persistent settings.',
    );
  } finally {
    if (application) await application.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
