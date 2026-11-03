import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
});

test('main content scrolls while window controls and sidebar stay fixed', async ({ page }) => {
  const chrome = page.locator('.titlebar');
  const sidebar = page.locator('.sidebar');
  const before = { chrome: await chrome.boundingBox(), sidebar: await sidebar.boundingBox() };
  await page.locator('main').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect
    .poll(() => page.locator('main').evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  expect(await chrome.boundingBox()).toEqual(before.chrome);
  expect(await sidebar.boundingBox()).toEqual(before.sidebar);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(chrome.getByRole('button', { name: 'Kapat', exact: true })).toBeVisible();
  const controls = await chrome
    .locator('button')
    .evaluateAll((buttons) =>
      buttons.map((button) => ({ width: button.clientWidth, height: button.clientHeight })),
    );
  expect(controls.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  await sidebar.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await expect(chrome).toContainText('Otomasyon & Ayarlar');
});

for (const width of [390, 900]) {
  test(`window controls and navigation stay reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 650 });
    await expect(page.locator('.titlebar')).toBeVisible();
    const controls = await page.locator('.titlebar button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const r = button.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
    );
    expect(
      controls.every((r) => r.left >= 0 && r.right <= width && r.top >= 0 && r.bottom <= 650),
    ).toBe(true);
    await expect(
      page.locator('.sidebar').getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
