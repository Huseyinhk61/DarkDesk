import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
});
test('keyboard users can skip navigation and open the beginner guide', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Ana içeriğe geç' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('button', { name: 'Yardım & Başlangıç', exact: true }).click();
  await expect(page.locator('.help-page')).toBeVisible();
  await expect(page.locator('.help-steps > li')).toHaveCount(4);
});
test('navigation resets the main scroll position and keeps a readable selected page', async ({
  page,
}) => {
  await page.locator('main').evaluate((main) => {
    main.scrollTop = main.scrollHeight;
  });
  await expect
    .poll(() => page.locator('main').evaluate((main) => main.scrollTop))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Çalışma Profilleri', exact: true }).click();
  await expect.poll(() => page.locator('main').evaluate((main) => main.scrollTop)).toBe(0);
  await expect(page.getByRole('main', { name: 'Çalışma Profilleri' })).toBeFocused();
});
test('large text with high contrast remains usable on a small desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await page.getByRole('button', { name: 'Yüksek Kontrast', exact: true }).click();
  await expect(page.locator('.activity-bar')).toHaveCount(0);
  await page.getByLabel('Metin boyutu', { exact: true }).selectOption('130');
  await expect(page.locator('.activity-bar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  const size = await page
    .locator('.item-card h3')
    .first()
    .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
  expect(await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(
    true,
  );
  const checkbox = await page.locator('.item-card .checkbox').first().boundingBox();
  expect(checkbox.width).toBeGreaterThanOrEqual(30);
  expect(checkbox.height).toBeGreaterThanOrEqual(30);
  await expect(
    page.locator('.titlebar').getByRole('button', { name: 'Kapat', exact: true }),
  ).toBeVisible();
});
