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
  await page.locator('.live-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/assets/apps.png' });
  await page.locator('.item-info-trigger').first().click();
  await expect(page.locator('.item-details-grid')).toBeVisible();
  await page.screenshot({ path: 'docs/assets/details.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'docs/assets/preview.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle', exact: true }).click();
  await page.getByRole('button', { name: '12 öğeyi taşı', exact: true }).click();
  await settled();
  await expect(page.locator('.operation-receipt')).toBeVisible();
  await page.locator('.operation-receipt summary').click();
  await page.screenshot({ path: 'docs/assets/result.png' });
  await page.getByRole('button', { name: 'Bu düzenlemeyi geri al', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
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
  await page.getByRole('button', { name: 'Yüklü uygulamalar', exact: true }).click();
  await expect(page.locator('.activity-bar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Derin taramayı başlat', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(8);
  await settled();
  await dismiss();
  await page.screenshot({ path: 'docs/assets/scanner.png' });
  await page.getByRole('button', { name: 'Çalışma Profilleri', exact: true }).click();
  await page.locator('.profile-activate').filter({ hasText: 'Yazılım & Kodlama Modu' }).click();
  await settled();
  await dismiss();
  await page.screenshot({ path: 'docs/assets/profiles.png' });
  await page.getByLabel('Başlatıcı kısayolu', { exact: true }).click();
  await page.screenshot({ path: 'docs/assets/shortcuts.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Otomasyon Merkezi', exact: true }).click();
  await page.screenshot({ path: 'docs/assets/automation.png' });
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await page.getByRole('combobox', { name: 'Hızlı arama' }).fill('code');
  await expect(page.locator('.launcher-panel').getByRole('option').first()).toContainText('Code');
  await page.screenshot({ path: 'docs/assets/launcher.png' });
  await page.keyboard.press('Escape');
  for (const [name, id] of [
    ['Ocean Blue', 'ocean'],
    ['Forest Green', 'forest'],
    ['Rose Light', 'rose'],
    ['Yüksek Kontrast', 'contrast'],
    ['Graphite', 'graphite'],
    ['Amber Night', 'amber'],
    ['Lavender Light', 'lavender'],
    ['Nordic Blue', 'nord'],
  ]) {
    await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await settled();
    await dismiss();
    await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
    await page.screenshot({ path: `docs/assets/${id}.png` });
  }
  await page.getByRole('button', { name: 'Yardım & Başlangıç', exact: true }).click();
  await page.screenshot({ path: 'docs/assets/help.png' });
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await page.locator('.update-panel').screenshot({ path: 'docs/assets/updates.png' });
  console.log(
    'Captured 3.4 scanner sources, expanded groups, appearance choices and updater panel screenshots.',
  );
} finally {
  await browser.close();
}
