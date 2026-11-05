import { test, expect } from '@playwright/test';

test('a delayed runtime snapshot cannot overwrite a newer idle event or block undo', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const originalRuntimeStatus = api.runtimeStatus;
api.runtimeStatus = async () => {
  const state = await originalRuntimeStatus();
  if (window.__staleRuntimeProbe) {
    window.__staleRuntimeProbe = false;
    runtimeListeners.forEach((listener) => listener({ ...state, busy: null }));
    return { ...state, busy: 'folder-appearance' };
  }
  return state;
};
`,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => {
    window.__staleRuntimeProbe = true;
  });
  await page.getByRole('button', { name: '12 öğeyi taşı', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(0);
  await expect(page.locator('.activity-bar')).toHaveCount(0);
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await page.locator('main').getByRole('button', { name: 'Geri al', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
});
