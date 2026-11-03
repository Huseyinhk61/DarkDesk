import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
});
test('confirmed moves show destinations and actual action counts and can be undone', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle', exact: true }).click();
  await expect(page.locator('.operation-receipt')).toHaveCount(0);
  await page.getByRole('button', { name: '12 öğeyi taşı', exact: true }).click();
  const receipt = page.getByRole('region', { name: 'Düzenleme sonucu' });
  await expect(receipt).toContainText('12 taşındı');
  await expect(receipt).toContainText('0 başarısız');
  await receipt.locator('summary').click();
  await expect(receipt.locator('.receipt-folder').first()).toContainText('Desktop');
  await receipt.getByRole('button', { name: 'Bu düzenlemeyi geri al', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(receipt).toHaveCount(0);
});
test('installed applications produce a shortcut receipt instead of claiming executable moves', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Sistem Tarama', exact: true }).click();
  await page.getByRole('button', { name: 'Yüklü uygulamalar', exact: true }).click();
  await page.getByRole('button', { name: 'Derin taramayı başlat', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(8);
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Kurulu programlar taşınmaz');
  await page.getByRole('button', { name: '8 kısayol oluştur', exact: true }).click();
  const receipt = page.getByRole('region', { name: 'Düzenleme sonucu' });
  await expect(receipt).toContainText('0 taşındı');
  await expect(receipt).toContainText('8 kısayol oluşturuldu');
  await expect(page.locator('.item-card')).toHaveCount(8);
});
test('purpose search finds browsers while root group count reflects visible cards', async ({
  page,
}) => {
  await page.getByRole('textbox', { name: 'Öğe ara', exact: true }).fill('tarayıcı');
  await expect(page.locator('.item-card').filter({ hasText: 'Google Chrome' })).toBeVisible();
  await expect(page.locator('.section-heading h2 span')).toHaveText('10');
  await expect(page.locator('.category')).toHaveCount(10);
});
