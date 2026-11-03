import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
});
async function settings(page) {
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
}
async function settled(page) {
  await expect(page.locator('.activity-bar')).toHaveCount(0);
}
test('all appearance themes change actual tokens and persist across reload', async ({ page }) => {
  await settings(page);
  for (const [name, id] of [
    ['Cyberpunk Neon', 'cyberpunk'],
    ['Minimal Slate', 'slate'],
    ['Midnight Dark', 'midnight'],
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await settled(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    );
    expect(bg).toBe(id === 'slate' ? '#f4f6fa' : id === 'cyberpunk' ? '#0c0816' : '#0f1117');
  }
  await page.getByRole('button', { name: 'Minimal Slate', exact: true }).click();
  await settled(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate');
});
test('English localizes navigation, settings, workspace, preview, toasts and survives reload', async ({
  page,
}) => {
  await settings(page);
  await page.getByLabel('Dil', { exact: true }).selectOption('en');
  await settled(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Your desktop. Your rules.' })).toBeVisible();
  await page.getByRole('button', { name: 'Smart Groups', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Everything in its place.' })).toBeVisible();
  await expect(page.locator('.category').first()).toContainText('Software & Development');
  await page.getByRole('button', { name: 'Organize Demo Desktop' }).click();
  await expect(page.getByRole('dialog')).toContainText('One last look.');
  await page.getByRole('button', { name: 'Move 12 items' }).click();
  await expect(page.locator('.toast')).toContainText('Organized 12 items.');
  await page.locator('.toast').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
test('Tabler and Minimalist packages render distinct icons and item choices persist', async ({
  page,
}) => {
  await settings(page);
  await page.getByLabel('İkon paketi', { exact: true }).selectOption('tabler');
  await settled(page);
  await expect(page.locator('.icon-pack-preview svg').first()).toHaveAttribute(
    'data-icon-pack',
    'tabler',
  );
  await page.getByLabel('İkon paketi', { exact: true }).selectOption('minimal');
  await settled(page);
  await expect(page.locator('.icon-pack-preview svg').first()).toHaveAttribute(
    'data-icon-pack',
    'minimal',
  );
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await page.getByLabel('Figma.lnk ikonu', { exact: true }).selectOption('heart');
  await settled(page);
  await page.reload();
  await expect(page.getByLabel('Figma.lnk ikonu', { exact: true })).toHaveValue('heart');
  await expect(page.locator('.app-icon svg').first()).toHaveAttribute('data-icon-pack', 'minimal');
});
test('custom groups and nested folders can be created, assigned and edited', async ({ page }) => {
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await page.getByRole('button', { name: 'Yeni kategori', exact: true }).click();
  let modal = page.getByRole('dialog');
  await modal.getByLabel('Ad', { exact: true }).fill('Projects');
  await modal.getByLabel('Üst grup', { exact: true }).selectOption('software');
  await modal.getByRole('button', { name: 'Roket', exact: true }).click();
  await modal.getByRole('button', { name: 'Kategoriyi kaydet' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator('.managed-groups')).toContainText('Projects');
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  const option = page
    .getByLabel('Figma.lnk hedef klasörü')
    .locator('option')
    .filter({ hasText: 'Projects' });
  const id = await option.getAttribute('value');
  await page.getByLabel('Figma.lnk hedef klasörü').selectOption(id);
  await settled(page);
  await page.reload();
  await expect(page.getByLabel('Figma.lnk hedef klasörü')).toHaveValue(id);
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  await expect(page.getByRole('dialog')).toContainText('Yazılım & Geliştirme');
  await expect(page.getByRole('dialog')).toContainText('Projects');
});
test('user rules reclassify and can be disabled without changing a manual assignment', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Eşleşecek metin', exact: true }).fill('Figma');
  await page.getByLabel('Hedef kategori', { exact: true }).selectOption('office');
  await page.getByRole('button', { name: 'Kural ekle' }).click();
  await settled(page);
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await expect(page.getByLabel('Figma.lnk hedef klasörü')).toHaveValue('office');
  await page.getByLabel('Figma.lnk hedef klasörü').selectOption('media');
  await settled(page);
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Kural etkin Figma' }).uncheck();
  await settled(page);
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await expect(page.getByLabel('Figma.lnk hedef klasörü')).toHaveValue('media');
});
test('deep scan discovers installed apps and preview creates only shortcuts', async ({ page }) => {
  await page.getByRole('button', { name: 'Sistem Tarama', exact: true }).click();
  await page.getByRole('button', { name: 'Yüklü uygulamalar', exact: true }).click();
  await page.getByRole('button', { name: 'Derin taramayı başlat', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(8);
  await settled(page);
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  await expect(page.getByRole('dialog')).toContainText('Kurulu programlar taşınmaz.');
  await page.getByRole('button', { name: '8 kısayol oluştur' }).click();
  await settled(page);
  await expect(page.locator('.item-card')).toHaveCount(8);
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  await expect(page.getByRole('button', { name: '0 kısayol oluştur' })).toBeDisabled();
});
test('deep scan can be cancelled and the partial result stays visible', async ({ page }) => {
  await page.getByRole('button', { name: 'Sistem Tarama', exact: true }).click();
  await page.getByRole('button', { name: 'Yüklü uygulamalar', exact: true }).click();
  await settled(page);
  // Freeze simulated scan timers so cancellation does not race a one-second demo scan.
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.getByRole('button', { name: 'Derin taramayı başlat', exact: true }).click();
  await page.locator('.scan-cta').getByRole('button', { name: 'Taramayı durdur' }).click();
  await page.clock.runFor(1250);
  await settled(page);
  await expect(page.locator('.scanner-panel')).toContainText('Tarama durduruldu.');
  await expect(page.locator('.item-card')).toHaveCount(3);
});
test('invalid folder name is rejected in the demo exactly like native settings', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await page.getByRole('button', { name: 'Yeni kategori', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Ad', { exact: true }).fill('CON');
  await page.getByRole('button', { name: 'Kategoriyi kaydet' }).click();
  await expect(page.getByRole('alert')).toContainText('Kategori adı veya klasör bilgisi geçersiz.');
  await expect(page.getByRole('dialog')).toBeVisible();
});
test('English light-theme settings and category manager do not overflow on mobile', async ({
  page,
}) => {
  await settings(page);
  await page.getByLabel('Dil', { exact: true }).selectOption('en');
  await settled(page);
  await page.getByRole('button', { name: 'Minimal Slate', exact: true }).click();
  await settled(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Categories & Rules', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'New category', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
