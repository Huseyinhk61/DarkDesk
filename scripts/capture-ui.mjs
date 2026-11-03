import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
  });
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(page.locator('.activity-bar')).toHaveCount(0);
  await page.screenshot({ path: 'docs/assets/workspace.png', fullPage: true });
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'docs/assets/preview.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar' }).click();
  await page.screenshot({ path: 'docs/assets/settings.png', fullPage: true });
  console.log('Captured workspace, operation preview and settings screenshots.');
} finally {
  await browser.close();
}
