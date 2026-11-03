import { test, expect } from '@playwright/test';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
}
const card = (page) => page.locator('.item-card').filter({ hasText: 'Visual Studio Code' });
test('details show file dates and explain unavailable native metadata in the demo', async ({
  page,
}) => {
  await open(page);
  const trigger = card(page)
    .getByRole('button', { name: /Visual Studio Code.lnk.*bilgi|.*Visual Studio Code.lnk/ })
    .first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.item-details-grid')).toBeVisible();
  await expect(dialog.locator('.item-details-grid')).toContainText('2 KB');
  await expect(dialog.locator('.item-details-note')).toContainText([
    'DarkDesk',
    'Tarayıcı önizlemesi',
  ]);
  await expect(dialog.locator('dd').filter({ hasText: 'Microsoft' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test('native PNG icons take precedence over custom fallback icons and appear in Spotlight', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `\napi.itemIcon = async (id) => ({id, icon:${JSON.stringify(png)}});\n`,
    });
  });
  await open(page);
  await card(page).scrollIntoViewIfNeeded();
  await expect(card(page).locator('[data-icon-source="native"] img')).toBeVisible();
  await card(page).getByLabel('Visual Studio Code.lnk ikonu').selectOption('heart');
  await expect(card(page).locator('[data-icon-source="native"] img')).toHaveAttribute('src', png);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await page.getByRole('combobox', { name: 'Hızlı arama' }).fill('vsc');
  await expect(
    page.locator('.launcher-result').first().locator('[data-icon-source="native"] img'),
  ).toBeVisible();
});
test('metadata failures remain recoverable and do not replace them with invented information', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `\nconst getDetails=api.itemDetails; api.itemDetails=async(id)=>{if(!window.detailsRetry) throw Error('SOURCE_MISSING'); return getDetails(id);};\n`,
    });
  });
  await open(page);
  await card(page).locator('.item-info-trigger').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.locator('.item-details-grid')).toHaveCount(0);
  await page.evaluate(() => {
    window.detailsRetry = true;
  });
  await dialog.getByRole('button', { name: 'Yeniden dene', exact: true }).click();
  await expect(dialog.locator('.item-details-grid')).toBeVisible();
});
