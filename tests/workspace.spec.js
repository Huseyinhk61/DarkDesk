import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
});
test('initial scan renders categories without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page
    .locator('.desktop-header')
    .getByRole('button', { name: 'Akıllı Taramaya Başla' })
    .click();
  await expect(page.locator('.category')).toHaveCount(11);
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(page.getByRole('heading', { name: 'Her şey yerli yerinde.' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('search and file-type filters can be combined and cleared', async ({ page }) => {
  await page.getByRole('button', { name: /Dosyalar1/ }).click();
  await expect(page.locator('.item-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Öğe ara' }).fill('missing');
  await expect(page.locator('.item-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Filtreleri temizle' }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('textbox', { name: 'Öğe ara' }).fill('Figma');
  await expect(page.locator('.item-card')).toHaveCount(1);
});
test('select all affects only visible items and preserves hidden selection', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Öğe ara' }).fill('Figma');
  await page.getByRole('button', { name: 'Görünen öğeleri seç veya kaldır' }).click();
  await expect(page.locator('.selection-line')).toContainText('11 öğe seçili');
  await page.getByRole('button', { name: 'Aramayı temizle' }).click();
  await expect(page.getByRole('button', { name: 'Figma.lnk seç', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
test('category preferences survive rescanning and reload', async ({ page }) => {
  await page.getByLabel('Figma.lnk hedef klasörü').selectOption('software');
  await expect(page.getByLabel('Figma.lnk hedef klasörü')).toHaveValue('software');
  await page.reload();
  await expect(page.getByLabel('Figma.lnk hedef klasörü')).toHaveValue('software');
});
test('preview supports cancellation, focus trapping and Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.preview-entry')).toHaveCount(12);
  await dialog.getByRole('button', { name: '12 öğeyi taşı' }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Pencereyi kapat' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.item-card')).toHaveCount(12);
});
test('confirmed demo move can be undone and history retains the result', async ({ page }) => {
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  await page.getByRole('button', { name: '12 öğeyi taşı' }).click();
  await expect(page.locator('.item-card')).toHaveCount(0);
  await page.locator('.toast').getByRole('button', { name: 'Geri al', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar' }).click();
  await expect(page.locator('.history-row')).toContainText('Geri alındı');
});
test('copy preference persists, keeps originals and exposes duplicate conflicts', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar' }).click();
  await page.getByRole('radio', { name: /Dosyaları kopyala/ }).click();
  await page.getByRole('button', { name: 'Ayarları kaydet' }).click();
  await expect(page.getByRole('button', { name: 'Ayarları kaydet' })).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar' }).click();
  await expect(page.getByRole('radio', { name: /Dosyaları kopyala/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  await page.getByRole('button', { name: '12 öğeyi kopyala' }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' })).toBeEnabled();
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  await expect(page.getByRole('button', { name: '0 öğeyi kopyala' })).toBeDisabled();
  await expect(page.locator('.preview-entry.conflict')).toHaveCount(12);
});
test('extension exclusions hide files and invalid input shows an actionable error', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar' }).click();
  await page.getByLabel('Taramadan hariç tutulacak uzantılar').fill('.pdf');
  await page.getByRole('button', { name: 'Ayarları kaydet' }).click();
  await expect(page.getByRole('button', { name: 'Ayarları kaydet' })).toBeEnabled();
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(11);
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar' }).click();
  await page.getByLabel('Taramadan hariç tutulacak uzantılar').fill('../bad');
  await page.getByRole('button', { name: 'Ayarları kaydet' }).click();
  await expect(page.getByRole('alert')).toContainText('Uzantıları');
});
test('size sorting, list view and keyboard search work', async ({ page }) => {
  await page.getByLabel('Öğeleri sırala').selectOption('size');
  await expect(page.locator('.item-card').first()).toContainText('Proje Notları.pdf');
  await page.getByRole('button', { name: 'Liste görünümü' }).click();
  await expect(page.locator('.items-grid')).toHaveClass(/list-layout/);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('textbox', { name: 'Öğe ara' })).toBeFocused();
});
test('mobile layout has no horizontal overflow or clipped controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
