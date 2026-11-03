import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
});
const settled = (page) => expect(page.locator('.activity-bar')).toHaveCount(0);
test('new themes use distinct catalog tokens and survive reload', async ({ page }) => {
  for (const [name, id, background] of [
    ['Ocean Blue', 'ocean', '#08151e'],
    ['Forest Green', 'forest', '#0b1612'],
    ['Rose Light', 'rose', '#fff5f3'],
    ['Yüksek Kontrast', 'contrast', '#000000'],
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await settled(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      ),
    ).toBe(background);
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
});
test('system appearance responds live while explicit themes remain selected', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('button', { name: 'Sistem Teması', exact: true }).click();
  await settled(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate');
  await page.getByRole('button', { name: 'Ocean Blue', exact: true }).click();
  await settled(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ocean');
});
test('readability and reduced-motion choices persist and keep desktop chrome reachable', async ({
  page,
}) => {
  await page.getByLabel('Metin boyutu', { exact: true }).selectOption('130');
  await settled(page);
  await page.getByLabel('İçerik yoğunluğu', { exact: true }).selectOption('compact');
  await settled(page);
  await page.getByLabel('Animasyon tercihi', { exact: true }).selectOption('reduced');
  await settled(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim(),
    ),
  ).toBe('1.3');
  await expect(page.getByRole('button', { name: 'Kapat', exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
});
test('appearance saves preserve an unsaved operation-method choice', async ({ page }) => {
  const copy = page.getByRole('radio', { name: /Dosyaları kopyala/ });
  await copy.click();
  await page.getByRole('button', { name: 'Forest Green', exact: true }).click();
  await settled(page);
  await expect(copy).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Ayarları kaydet', exact: true }).click();
  await settled(page);
  await page.reload();
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await expect(page.getByRole('radio', { name: /Dosyaları kopyala/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');
});
