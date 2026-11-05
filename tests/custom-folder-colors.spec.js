import { test, expect } from '@playwright/test';

async function editSoftware(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await page.getByRole('button', { name: 'Düzenle Yazılım & Geliştirme', exact: true }).click();
  return page.getByRole('dialog');
}
const svg = (dialog) =>
  dialog
    .locator('.category-editor-preview .folder-preview')
    .getAttribute('src')
    .then(decodeURIComponent);

test('a gradient palette updates preview, category accents and persisted folder colors', async ({
  page,
}) => {
  const dialog = await editSoftware(page);
  await dialog.getByRole('button', { name: 'Gün batımı', exact: true }).click();
  expect(await svg(dialog)).toContain('#f59e0b');
  expect(await svg(dialog)).toContain('#e11d48');
  await dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  const card = page.locator('button.category').filter({ hasText: 'Yazılım & Geliştirme' });
  await expect(card).toHaveClass(/custom-folder-color/);
  expect(await card.evaluate((element) => element.style.getPropertyValue('--folder-from'))).toBe(
    '#f59e0b',
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('darkdesk-settings')).categories.find(
      (category) => category.id === 'software',
    ),
  );
  expect(saved.customColor).toEqual({ from: '#f59e0b', to: '#e11d48' });
  await page.reload();
  await expect(card).toHaveClass(/custom-folder-color/);
  expect(decodeURIComponent(await card.locator('.folder-preview').getAttribute('src'))).toContain(
    '#e11d48',
  );
});

test('custom hex values validate safely, support native color inputs and fit small windows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 820 });
  const dialog = await editSoftware(page);
  const start = dialog.getByRole('textbox', { name: 'Başlangıç rengi (HEX)', exact: true });
  const end = dialog.getByRole('textbox', { name: 'Bitiş rengi (HEX)', exact: true });
  await start.fill('#123');
  await expect(start).toHaveAttribute('aria-invalid', 'true');
  await expect(
    dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }),
  ).toBeDisabled();
  await expect(dialog.locator('#custom-folder-error')).toBeVisible();
  expect(await svg(dialog)).not.toContain('stop-color="#123"');
  await start.fill('#123456');
  await end.fill('#ABCDEF');
  expect(await svg(dialog)).toContain('#abcdef');
  await dialog.getByLabel('Başlangıç rengini seç', { exact: true }).fill('#0abade');
  await expect(start).toHaveValue('#0abade');
  await dialog.getByRole('button', { name: 'Tek renk kullan', exact: true }).click();
  await expect(end).toHaveValue('#0abade');
  expect(
    await dialog
      .locator('.custom-folder-editor')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await expect(
    dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }),
  ).toBeEnabled();
});

test('choosing a named color clears a custom gradient and keeps category identity localized', async ({
  page,
}) => {
  const dialog = await editSoftware(page);
  await dialog.getByRole('button', { name: 'Kutup ışığı', exact: true }).click();
  await dialog.getByRole('button', { name: 'Turkuaz', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Turkuaz', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('darkdesk-settings')).categories.find(
      (category) => category.id === 'software',
    ),
  );
  expect(saved.customColor).toBeUndefined();
  expect(saved.color).toBe('teal');
  expect(saved.labelKey).toBe('categories.software');
});

test('saving custom colors on Windows applies the saved appearance without a second user action', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace('export const native =', 'export let native =');
    await route.fulfill({
      response,
      body:
        body +
        `
const originalStats = api.stats;
api.stats=async()=>({...await originalStats(),platform:'win32'});
api.applyFolderAppearance=async()=>{
 window.__folderApplySnapshots ||= [];
 window.__folderApplySnapshots.push(await api.getSettings());
 return {updated:1,unchanged:0,skipped:0,failed:0,details:[]};
};
native=true;
`,
    });
  });
  const dialog = await editSoftware(page);
  await dialog.getByRole('button', { name: 'Gün batımı', exact: true }).click();
  await dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const snapshots = await page.evaluate(() => window.__folderApplySnapshots);
  expect(snapshots).toHaveLength(1);
  expect(
    snapshots[0].categories.find((category) => category.id === 'software').customColor,
  ).toEqual({ from: '#f59e0b', to: '#e11d48' });
});

test('saving the same Windows category retries appearance for pre-update folders', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()).replace('export const native =', 'export let native =') +
        `
const statsBeforeRetry=api.stats;api.stats=async()=>({...await statsBeforeRetry(),platform:'win32'});api.applyFolderAppearance=async()=>{window.__sameStyleApplies=(window.__sameStyleApplies||0)+1;return {updated:0,unchanged:1,skipped:0,failed:0,details:[]};};native=true;`,
    });
  });
  const dialog = await editSoftware(page);
  await dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.__sameStyleApplies)).toBe(1);
});
