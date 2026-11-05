import { test, expect } from '@playwright/test';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const vscode = (page) => page.locator('.item-card').filter({ hasText: 'Visual Studio Code' });
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
}
test('recognized apps explain their purpose and distinguish it from file metadata', async ({
  page,
}) => {
  await open(page);
  const card = vscode(page);
  await expect(card.locator('.purpose-badge')).toHaveText('Yerel uygulama sözlüğü');
  await expect(card.locator('.item-purpose p')).toContainText('kod');
  await card.locator('.item-title-button').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Ne işe yarar?', exact: true })).toBeVisible();
  await expect(dialog.locator('.item-purpose-detail')).toContainText(
    'çevrimdışı uygulama sözlüğünden',
  );
  await expect(dialog.locator('.item-details-grid')).toBeVisible();
});
test('unknown file purposes are visibly marked as estimates', async ({ page }) => {
  await open(page);
  const card = page.locator('.item-card').filter({ hasText: 'Proje Notları.pdf' });
  await expect(card.locator('.purpose-badge')).toHaveText('Ad / tür tahmini');
  await card.locator('.item-title-button').click();
  await expect(page.locator('.item-purpose-detail')).toContainText(
    'Dosya adına veya türüne dayalı bir tahmindir',
  );
  await expect(page.locator('.item-purpose-detail')).toContainText('analiz edilmedi');
});
test('a failed native icon can be refreshed without reopening the app', async ({ page }) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `\napi.itemIcon=async(id,refresh)=>({id,icon:refresh?${JSON.stringify(png)}:null});\n`,
    });
  });
  await open(page);
  const card = vscode(page);
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('[data-icon-source="fallback"] .app-monogram')).toBeVisible();
  await page.getByRole('button', { name: 'İkonları yenile', exact: true }).click();
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('[data-icon-source="native"] img')).toHaveAttribute('src', png);
});
