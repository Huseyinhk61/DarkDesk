import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
});
const settled = (page) => expect(page.locator('.activity-bar')).toHaveCount(0);
test('additional palettes apply distinct surfaces and remain selected after reload', async ({
  page,
}) => {
  for (const [name, id, background] of [
    ['Graphite', 'graphite', '#15171b'],
    ['Amber Night', 'amber', '#171109'],
    ['Lavender Light', 'lavender', '#f6f2ff'],
    ['Nordic Blue', 'nord', '#17212b'],
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await settled(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      ),
    ).toBe(background);
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');
});
test('local font choices update actual typography and persist', async ({ page }) => {
  for (const [id, family] of [
    ['readable', 'Verdana'],
    ['serif', 'Georgia'],
    ['mono', 'Cascadia'],
    ['system', 'Segoe UI'],
  ]) {
    await page.getByLabel('Yazı tipi', { exact: true }).selectOption(id);
    await settled(page);
    await expect(page.locator('html')).toHaveAttribute('data-font', id);
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).fontFamily),
    ).toContain(family);
  }
  await page.getByLabel('Yazı tipi', { exact: true }).selectOption('serif');
  await settled(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-font', 'serif');
});
test('rounded and duotone packs render different glyph styles and survive reload', async ({
  page,
}) => {
  await page.getByLabel('İkon paketi', { exact: true }).selectOption('rounded');
  await settled(page);
  const rounded = page.locator('.icon-pack-preview svg').first();
  await expect(rounded).toHaveAttribute('data-icon-pack', 'rounded');
  await expect(rounded).toHaveAttribute('stroke-width', '2.7');
  await page.getByLabel('İkon paketi', { exact: true }).selectOption('duotone');
  await settled(page);
  await expect(page.locator('.icon-pack-preview svg').first()).toHaveAttribute(
    'data-icon-pack',
    'duotone',
  );
  await expect(page.locator('.icon-pack-preview svg').first().locator('rect')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await expect(page.getByLabel('İkon paketi', { exact: true })).toHaveValue('duotone');
});
