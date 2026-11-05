import { test, expect } from '@playwright/test';

test('scan cards and details always show localized usage estimates with clear provenance', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(page.locator('.item-card .usage-estimate')).toHaveCount(12);
  const code = page.locator('.item-card').filter({ hasText: 'Visual Studio Code' });
  const chrome = page.locator('.item-card').filter({ hasText: 'Google Chrome' });
  await expect(code.locator('.usage-estimate')).toContainText('Yoğun kullanım');
  await expect(chrome.locator('.usage-estimate')).toContainText('Sürekli kullanım');
  await expect(chrome.locator('.usage-estimate')).toContainText('ölçülmüş kullanım değil');
  await code
    .getByRole('button', { name: 'Visual Studio Code.lnk ayrıntılarını göster', exact: true })
    .first()
    .click();
  await expect(page.getByRole('dialog').locator('.usage-estimate')).toContainText(
    'Tahmini kullanım',
  );
  await expect(page.getByRole('dialog').locator('.usage-estimate')).toContainText(
    'etkin işlem süresi izlenmez',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await page.getByLabel('Dil', { exact: true }).selectOption('en');
  await page.getByRole('button', { name: 'System Scanner', exact: true }).click();
  await page.getByRole('button', { name: 'Installed apps', exact: true }).click();
  await page.getByRole('button', { name: 'Start deep scan', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(8);
  await expect(page.locator('.item-card .usage-estimate')).toHaveCount(8);
  const installedCode = page.locator('.item-card').filter({ hasText: 'Visual Studio Code' });
  await expect(installedCode.locator('.usage-estimate')).toContainText('Intensive use');
  await expect(installedCode.locator('.usage-estimate')).toContainText('Category estimate');
});

test('recorded local launches replace category-only estimates on rescanning', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  const chrome = page.locator('.item-card').filter({ hasText: 'Google Chrome' });
  await expect(chrome.locator('.usage-estimate')).toHaveAttribute('data-source', 'category');
  await page.evaluate(async () => {
    const { api } = await import('/src/service.js');
    await api.launch('Google Chrome.lnk');
  });
  await page.getByRole('button', { name: 'Akıllı Taramaya Başla', exact: true }).click();
  await expect(chrome.locator('.usage-estimate')).toHaveAttribute('data-source', 'history');
  await expect(chrome.locator('.usage-estimate')).toContainText('Yakın zamanda başlatıldı');
  await expect(chrome.locator('.usage-estimate')).toContainText('1 başlatma kaydına göre');
});
