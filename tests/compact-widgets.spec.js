import { test, expect } from '@playwright/test';
test('compact previews collapse independently, retain drafts and restore saved state', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  for (const title of ['Hızlı not', 'Yapılacaklar'])
    await page
      .locator('.widget-module-card')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
      .getByRole('button', { name: 'Önizlemeyi aç' })
      .click();
  await page.getByRole('textbox', { name: 'Kişisel hızlı not' }).fill('Saklanacak not');
  await page.getByRole('button', { name: 'Hızlı not panelini daralt', exact: true }).click();
  const note = page
    .locator('.desktop-widget')
    .filter({ has: page.locator('.widget-drag b').filter({ hasText: 'Hızlı not' }) });
  await expect(note).toHaveClass(/widget-collapsed/);
  await expect(note.locator('textarea')).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Yeni görev' })).toBeVisible();
  await page.getByRole('button', { name: 'Hızlı not panelini genişlet', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Kişisel hızlı not' })).toHaveValue(
    'Saklanacak not',
  );
  await page.getByRole('button', { name: 'Hızlı not panelini daralt', exact: true }).click();
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Hızlı not panelini genişlet', exact: true }),
  ).toBeVisible();
});
test('saving preview notes does not reload or replace appearance preferences', async ({ page }) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `\nconst readAppearance=api.getSettings;api.getSettings=async()=>{window.__appearanceReads=(window.__appearanceReads||0)+1;return readAppearance();};`,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  await page
    .locator('.widget-module-card')
    .filter({ has: page.getByRole('heading', { name: 'Hızlı not', exact: true }) })
    .getByRole('button', { name: 'Önizlemeyi aç' })
    .click();
  const before = await page.evaluate(() => window.__appearanceReads);
  await page.getByRole('textbox', { name: 'Kişisel hızlı not' }).fill('Görünümü değiştirme');
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('darkdesk-preview-widgets')).note),
    )
    .toBe('Görünümü değiştirme');
  expect(await page.evaluate(() => window.__appearanceReads)).toBe(before);
});
