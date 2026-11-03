import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
  });
  const settled = () => expect(page.locator('.activity-bar')).toHaveCount(0);
  const dismiss = async () => {
    const button = page.locator('.toast button[aria-label]');
    if (await button.count()) await button.click();
  };
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await settled();
  await page.screenshot({ path: 'docs/assets/workspace.png', fullPage: true });
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'docs/assets/preview.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await page.locator('.appearance-panel').screenshot({ path: 'docs/assets/settings.png' });
  await page.getByRole('button', { name: 'Cyberpunk Neon', exact: true }).click();
  await settled();
  await dismiss();
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await page.screenshot({ path: 'docs/assets/cyberpunk.png' });
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await page.getByLabel('Dil', { exact: true }).selectOption('en');
  await settled();
  await page.getByLabel('Icon pack', { exact: true }).selectOption('tabler');
  await settled();
  await page.getByRole('button', { name: 'Minimal Slate', exact: true }).click();
  await settled();
  await dismiss();
  await page.getByRole('button', { name: 'Smart Groups', exact: true }).click();
  await page.screenshot({ path: 'docs/assets/slate-en.png' });
  await page.getByRole('button', { name: 'Automation & Settings', exact: true }).click();
  await page.getByLabel('Language', { exact: true }).selectOption('tr');
  await settled();
  await page.getByRole('button', { name: 'Midnight Dark', exact: true }).click();
  await settled();
  await page.getByLabel('İkon paketi', { exact: true }).selectOption('lucide');
  await settled();
  await dismiss();
  await page.getByRole('button', { name: 'Sistem Tarama', exact: true }).click();
  await page.getByRole('button', { name: 'Derin taramayı başlat', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(8);
  await settled();
  await dismiss();
  await page.screenshot({ path: 'docs/assets/scanner.png' });
  console.log(
    'Captured 2.0 workspace, preview, appearance, Cyberpunk, English Slate and scanner screenshots.',
  );
} finally {
  await browser.close();
}
