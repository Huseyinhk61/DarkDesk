import { test, expect } from '@playwright/test';

test('desktop collection begins above the fold at 1366 by 768', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  expect(
    await page
      .locator('.icons-refresh')
      .evaluate(
        (button) =>
          button.scrollWidth <= button.clientWidth && button.scrollHeight <= button.clientHeight,
      ),
  ).toBe(true);
  const header = await page.locator('.desktop-header').boundingBox();
  expect(header.height).toBeLessThan(165);
  const item = await page.locator('.item-card').first().boundingBox();
  expect(item.y).toBeLessThan(708);
  expect(await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(
    true,
  );
  await expect(
    page.getByRole('button', { name: 'Masaüstünü Demo Düzenle', exact: true }),
  ).toBeVisible();
});

test('desktop header and cards remain within a smaller window with large text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 768 });
  await page.addInitScript(() => {
    localStorage.setItem('darkdesk-settings', JSON.stringify({ uiScale: 130 }));
    localStorage.setItem('darkdesk-appearance', JSON.stringify({ uiScale: 130 }));
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
  expect(await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(
    true,
  );
  const controls = await page
    .locator('.titlebar button')
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().right));
  expect(controls.every((right) => right <= 900)).toBe(true);
});

test('Spotlight uses an opaque panel so underlying application text cannot bleed through', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  const panel = page.locator('.launcher-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('opacity', '1');
  const surface = await panel.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, opacity: style.opacity };
  });
  expect(surface.opacity).toBe('1');
  expect(surface.background).toMatch(/^rgb\(/);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});
