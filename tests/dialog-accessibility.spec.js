import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
});

test('editing a dialog preserves the caret and isolates the application until dismissal', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Yeni kategori', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const name = dialog.getByLabel('Ad', { exact: true });
  await name.focus();
  await name.pressSequentially('Accessible projects');
  await expect(name).toHaveValue('Accessible projects');
  await expect(name).toBeFocused();
  expect(await page.locator('#root').evaluate((root) => root.inert)).toBe(true);
  await expect(page.locator('#root')).toHaveAttribute('aria-hidden', 'true');
  // Even a programmatic attempt cannot focus the background while it is inert.
  await page
    .locator('.sidebar nav button')
    .first()
    .evaluate((button) => button.focus());
  await expect(name).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.locator('#root').evaluate((root) => root.inert)).toBe(false);
  await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden');
  await expect(trigger).toBeFocused();
});

test('a modal blocks page-level profile and launcher shortcuts', async ({ page }) => {
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Control+Alt+1');
  await page.keyboard.press('Control+Space');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('.launcher-panel')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.profile-card.active')).toHaveCount(0);
});

test('Spotlight exposes a combobox, traps focus and has a keyboard-operable close control', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Hızlı Başlatıcı' });
  const search = dialog.getByRole('combobox', { name: 'Hızlı arama' });
  await search.fill('vsc');
  await expect(dialog.getByRole('option').first()).toContainText('Visual Studio Code');
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  const selected = await search.getAttribute('aria-activedescendant');
  expect(selected).toBeTruthy();
  await expect(search).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  const close = dialog.getByRole('button', { name: 'Pencereyi kapat', exact: true });
  await expect(
    dialog.getByRole('button', { name: 'Öğe aksiyonlarını aç', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('menu')).toHaveCount(0);
  await expect(search).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', { name: 'Öğe aksiyonlarını aç', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.locator('#root').evaluate((root) => root.inert)).toBe(false);
});
