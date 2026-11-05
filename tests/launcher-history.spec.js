import { test, expect } from '@playwright/test';

test('a favorite remains launchable at its organized path and returns to its original path after Undo', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.evaluate(async () => {
    const { api } = await import('/src/service.js');
    await api.setLauncherFavorite('Visual Studio Code.lnk', true);
  });
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle', exact: true }).click();
  await page.getByRole('button', { name: '12 öğeyi taşı', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  const search = page.getByRole('combobox', { name: 'Hızlı arama' });
  await search.fill('Visual Studio Code');
  const result = page.getByRole('option').first();
  await expect(result).toContainText('Yazılım & Geliştirme');
  await expect(result.locator('.launcher-pinned')).toBeVisible();
  await search.press('Enter');
  await expect(page.locator('.launcher-panel')).toHaveCount(0);
  const movedUsage = await page.evaluate(
    () => JSON.parse(localStorage.getItem('darkdesk-demo-usage'))['Visual Studio Code.lnk'],
  );
  expect(movedUsage.count).toBe(1);
  expect(movedUsage.favorite).toBe(true);
  await page.locator('main').getByRole('button', { name: 'Geri al', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await search.fill('Visual Studio Code');
  await expect(result.locator('small').first()).toHaveText(
    'C:\\Users\\User\\Desktop\\Visual Studio Code.lnk',
  );
  await expect(result.locator('.launcher-pinned')).toBeVisible();
});
