import { test, expect } from '@playwright/test';
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await expect(page.locator('.launcher-search .spin')).toHaveCount(0);
  return page.getByRole('combobox', { name: 'Hızlı arama' });
}
test('command favorites persist, filter independently and are keyboard operable', async ({
  page,
}) => {
  const input = await open(page);
  await input.fill('DarkDesk Aç');
  await expect(page.getByRole('option')).toHaveCount(1);
  await input.press('Control+d');
  await expect(page.getByRole('button', { name: 'Seçili öğeyi sabitle / kaldır' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await input.fill('');
  await page.getByRole('button', { name: 'Favoriler', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toContainText('DarkDesk Aç');
  await input.press('Escape');
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await expect(page.locator('.launcher-search .spin')).toHaveCount(0);
  await page.getByRole('button', { name: 'Favoriler', exact: true }).click();
  await expect(page.getByRole('option')).toContainText('DarkDesk Aç');
  await input.press('Control+d');
  await expect(page.getByRole('option')).toHaveCount(0);
});
test('currency cards use dated live responses, cross rates and canonical clipboard output', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let requests = 0;
  await page.route('https://api.frankfurter.dev/**', (route) => {
    requests++;
    return route.fulfill({
      json: {
        base: 'USD',
        date: new Date().toISOString().slice(0, 10),
        rates: { TRY: 40, EUR: 0.8 },
      },
    });
  });
  const input = await open(page);
  await input.fill('50 USD to TRY');
  await expect(page.getByRole('option')).toContainText('2.000 TRY');
  await expect(page.getByRole('option')).toContainText('Referans kuru');
  await input.press('Enter');
  await expect(page.locator('.launcher-notice')).toContainText('2000');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('2000');
  await input.fill('100 EUR');
  await expect(page.getByRole('option')).toContainText('5.000 TRY');
  expect(requests).toBe(1);
});
test('offline currency errors never fabricate a rate', async ({ page }) => {
  await page.route('https://api.frankfurter.dev/**', (route) => route.abort());
  const input = await open(page);
  await input.fill('50 USD to TRY');
  await expect(page.getByRole('option')).toContainText('Kur alınamadı');
  await expect(page.getByRole('option')).toBeDisabled();
});
test('late currency responses cannot replace a newer query result', async ({ page }) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `\napi.currencyQuote=q=>new Promise(resolve=>{window.__fxPending||={};window.__fxPending[q.amount]=()=>resolve({...q,value:q.amount*40,date:new Date().toISOString().slice(0,10),provider:'Test reference',cached:false});});`,
    });
  });
  const input = await open(page);
  await input.fill('50 USD to TRY');
  await expect.poll(() => page.evaluate(() => !!window.__fxPending?.[50])).toBe(true);
  await input.fill('100 USD to TRY');
  await expect(page.getByRole('option')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => !!window.__fxPending?.[100])).toBe(true);
  await page.evaluate(() => window.__fxPending[100]());
  await expect(page.getByRole('option')).toContainText('4.000 TRY');
  await page.evaluate(() => window.__fxPending[50]());
  await expect(page.getByRole('option')).toContainText('4.000 TRY');
});
test('manual rate refresh bypasses a fresh browser snapshot and shows the new response', async ({
  page,
}) => {
  let requests = 0;
  await page.route('https://api.frankfurter.dev/**', (route) =>
    route.fulfill({
      json: {
        base: 'USD',
        date: new Date().toISOString().slice(0, 10),
        rates: { TRY: ++requests === 1 ? 40 : 41, EUR: 0.8 },
      },
    }),
  );
  const input = await open(page);
  await input.fill('50 USD to TRY');
  await expect(page.getByRole('option')).toContainText('2.000 TRY');
  await page.getByRole('button', { name: 'Kuru yenile', exact: true }).click();
  await expect(page.getByRole('option')).toContainText('2.050 TRY');
  expect(requests).toBe(2);
});
