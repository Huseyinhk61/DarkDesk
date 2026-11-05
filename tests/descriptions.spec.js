import { test, expect } from '@playwright/test';
const codeCard = (page) => page.locator('.item-card').filter({ hasText: 'Visual Studio Code' });
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await codeCard(page).scrollIntoViewIfNeeded();
}
test('visible app cards prefer Windows FileDescription and show its provenance', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `\napi.itemPurpose=async(id)=>({id,description:'Native editor and debugger',company:'Example publisher',metadataSource:'windows-version-info'});\n`,
    });
  });
  await open(page);
  await expect(codeCard(page).locator('[data-description-source="metadata"]')).toContainText(
    'Native editor and debugger',
  );
  await expect(codeCard(page).locator('.purpose-badge')).toHaveText('Windows dosya açıklaması');
});
test('a metadata failure keeps the offline description available', async ({ page }) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `\napi.itemPurpose=async()=>{throw Error('METADATA_UNAVAILABLE')};\n`,
    });
  });
  await open(page);
  await expect(codeCard(page).locator('[data-description-source="catalog"]')).toContainText('kod');
  await expect(codeCard(page).locator('.purpose-badge')).toHaveText('Yerel uygulama sözlüğü');
});
test('custom descriptions persist and clearing them restores automatic descriptions', async ({
  page,
}) => {
  await open(page);
  await codeCard(page).locator('.item-title-button').click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Kendi açıklaman', { exact: true })
    .fill('Projelerim için kullandığım kod düzenleyici.');
  await dialog.getByRole('button', { name: 'Açıklamayı kaydet', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Açıklaman kaydedildi.');
  await expect(dialog.locator('[data-description-source="manual"]')).toContainText('Projelerim');
  await page.keyboard.press('Escape');
  await expect(codeCard(page).locator('.purpose-badge')).toHaveText('Senin açıklaman');
  await page.reload();
  await expect(codeCard(page).locator('.item-purpose p')).toContainText('Projelerim');
  await codeCard(page).locator('.item-title-button').click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Metni temizle', exact: true }).click();
  await dialog.getByRole('button', { name: 'Açıklamayı kaydet', exact: true }).click();
  await expect(dialog.locator('[data-description-source="catalog"]')).toContainText('kod');
  await page.keyboard.press('Escape');
  await expect(codeCard(page).locator('.purpose-badge')).toHaveText('Yerel uygulama sözlüğü');
});
