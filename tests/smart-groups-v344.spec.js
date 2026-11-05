import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
});

test('root counts include nested apps and child filters retain their parent selection', async ({
  page,
}) => {
  const software = page.locator('button.category').filter({ hasText: 'Yazılım & Geliştirme' });
  await expect(software.locator('.category-count strong')).toHaveText('3');
  await software.click();
  await expect(page.locator('.item-card')).toHaveCount(3);
  const ide = page.locator('button.subcategory-chip').filter({ hasText: 'IDE & Editörler' });
  await expect(ide.locator('.count-badge')).toHaveText('1');
  await ide.click();
  await expect(page.locator('.item-card')).toHaveCount(1);
  await expect(page.locator('.item-card')).toContainText('Visual Studio Code');
  await expect(software).toHaveAttribute('aria-pressed', 'true');
  const path = page.getByRole('navigation', { name: 'Kategori yolu', exact: true });
  await expect(path.getByRole('button', { name: 'IDE & Editörler', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await page.locator('.subcategory-all').click();
  await expect(page.locator('.item-card')).toHaveCount(3);
  await path.getByRole('button', { name: 'Tüm gruplar', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
});

test('group sorting and empty-group preferences persist without changing classifications', async ({
  page,
}) => {
  const order = page.getByRole('combobox', { name: 'Grup sırası', exact: true });
  const empty = page.getByRole('checkbox', { name: 'Boş grupları göster', exact: true });
  await order.selectOption('count');
  await expect(
    page.locator('button.category').first().locator('.category-count strong'),
  ).toHaveText('3');
  await empty.uncheck();
  await expect(page.locator('button.category')).toHaveCount(5);
  await expect(page.locator('.item-card')).toHaveCount(12);
  await order.selectOption('name');
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(order).toHaveValue('name');
  await expect(empty).not.toBeChecked();
  await expect(page.locator('button.category')).toHaveCount(5);
});

test('carousel keyboard navigation reaches the final group and disables controls at its bounds', async ({
  page,
}) => {
  const cards = page.locator('button.category');
  await expect(cards).toHaveCount(10);
  const controls = page.locator('.category-scroll-controls button');
  await expect(controls.first()).toBeDisabled();
  await expect(controls.last()).toBeEnabled();
  await cards.first().focus();
  await page.keyboard.press('End');
  await expect(cards.last()).toBeFocused();
  await expect(controls.last()).toBeDisabled();
  await expect(controls.first()).toBeEnabled();
  await page.keyboard.press('Home');
  await expect(cards.first()).toBeFocused();
  await expect(controls.first()).toBeDisabled();
});

test('dropping a card into a subgroup updates its remembered assignment', async ({ page }) => {
  await page.locator('button.category').filter({ hasText: 'Yazılım & Geliştirme' }).click();
  const code = page.locator('.item-card').filter({ hasText: 'Visual Studio Code' });
  const devops = page.locator('button.subcategory-chip').filter({ hasText: 'DevOps & Docker' });
  await code.dragTo(devops);
  await expect(
    code.getByRole('combobox', { name: 'Visual Studio Code.lnk hedef klasörü', exact: true }),
  ).toHaveValue('softwaredevops');
  await devops.click();
  await expect(page.locator('.item-card')).toHaveCount(2);
  await expect(page.locator('.item-card').filter({ hasText: 'Visual Studio Code' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(
    page
      .locator('.item-card')
      .filter({ hasText: 'Visual Studio Code' })
      .getByRole('combobox', { name: 'Visual Studio Code.lnk hedef klasörü', exact: true }),
  ).toHaveValue('softwaredevops');
});
