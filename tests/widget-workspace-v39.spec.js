import { test, expect } from '@playwright/test';
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
}
async function module(page, title) {
  return page
    .locator('.widget-module-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

test('the dedicated currency form converts, swaps, refreshes and copies without launcher syntax', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let calls = 0;
  await page.route('https://api.frankfurter.dev/**', (route) =>
    route.fulfill({
      json: {
        base: 'USD',
        date: new Date().toISOString().slice(0, 10),
        rates: { TRY: ++calls === 1 ? 40 : 42, EUR: 0.8 },
      },
    }),
  );
  await open(page);
  await page.getByRole('button', { name: 'Döviz Çevirici', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tutar', exact: true }).fill('50');
  await expect(page.locator('.currency-result')).toContainText('2.000 TRY');
  await page.getByRole('button', { name: 'Sonucu kopyala', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('2000');
  await page.getByRole('button', { name: 'Kuru yenile', exact: true }).click();
  await expect(page.locator('.currency-result')).toContainText('2.100 TRY');
  await page.getByRole('button', { name: 'Para birimlerini değiştir', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Kaynak para birimi', exact: true })).toHaveValue(
    'TRY',
  );
  await page.getByRole('textbox', { name: 'Tutar', exact: true }).fill('invalid');
  await expect(page.getByRole('button', { name: 'Sonucu kopyala', exact: true })).toBeDisabled();
});

test('notes and tasks remain editable while widget appearance and system options persist', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  await expect(page.locator('.widget-module-card')).toHaveCount(7);
  for (const title of ['Hızlı not', 'Yapılacaklar'])
    await (
      await module(page, title)
    )
      .getByRole('button', { name: 'Önizlemeyi aç', exact: true })
      .click();
  const note = page.getByRole('textbox', { name: 'Kişisel hızlı not', exact: true });
  await note.click();
  await note.pressSequentially('Notumu klavyeden yaziyorum.');
  const task = page.getByRole('textbox', { name: 'Yeni görev', exact: true });
  await task.click();
  await task.pressSequentially('Widget kontrolu');
  await task.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Widget kontrolu', exact: true })).toBeVisible();
  const opacity = page.getByRole('slider', { name: 'Hızlı not opaklığı', exact: true });
  await opacity.fill('55');
  await opacity.blur();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('darkdesk-preview-widgets')).appearance.note.opacity,
      ),
    )
    .toBe(55);
  await page.getByRole('combobox', { name: 'Hızlı not boyutu', exact: true }).selectOption('large');
  await page.getByRole('checkbox', { name: 'CPU geçmiş grafiği', exact: true }).uncheck();
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  await expect(note).toHaveValue('Notumu klavyeden yaziyorum.');
  await expect(page.getByRole('combobox', { name: 'Hızlı not boyutu', exact: true })).toHaveValue(
    'large',
  );
  await expect(
    page.getByRole('checkbox', { name: 'CPU geçmiş grafiği', exact: true }),
  ).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Widget kontrolu', exact: true })).toBeVisible();
});

test('clock, focus timer and currency widget are usable from the same widget gallery', async ({
  page,
}) => {
  await page.route('https://api.frankfurter.dev/**', (route) =>
    route.fulfill({
      json: {
        base: 'USD',
        date: new Date().toISOString().slice(0, 10),
        rates: { TRY: 40, EUR: 0.8 },
      },
    }),
  );
  await open(page);
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  for (const title of ['Saat & tarih', 'Odak sayacı', 'Döviz çevirici'])
    await (
      await module(page, title)
    )
      .getByRole('button', { name: 'Önizlemeyi aç', exact: true })
      .click();
  await expect(page.locator('.clock-widget strong')).toHaveText(/\d{2}:\d{2}:\d{2}/);
  await page.getByRole('button', { name: 'Başlat', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Duraklat', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Duraklat', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Başlat', exact: true })).toBeVisible();
  await expect(page.locator('.currency-result')).toContainText('40 TRY');
});

test('right-clicking a group opens its color editor and changes glyph artwork across restart', async ({
  page,
}) => {
  await open(page);
  await page
    .locator('button.category')
    .filter({ hasText: 'Yazılım & Geliştirme' })
    .click({ button: 'right' });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('combobox', { name: 'Klasör üzerindeki simge boyutu', exact: true })
    .selectOption('large');
  await dialog.getByRole('button', { name: 'Gün batımı', exact: true }).click();
  expect(
    decodeURIComponent(await dialog.locator('.category-editor-preview img').getAttribute('src')),
  ).toContain('scale(4.2)');
  await dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(12);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('darkdesk-settings')).categories.find(
      (c) => c.id === 'software',
    ),
  );
  expect(saved.folderGlyphSize).toBe('large');
  expect(saved.customColor).toEqual({ from: '#f59e0b', to: '#e11d48' });
});

test('the currency form and widget controls fit narrow windows with enlarged text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem('darkdesk-settings', JSON.stringify({ uiScale: 130 })),
  );
  await page.route('https://api.frankfurter.dev/**', (route) => route.abort());
  await open(page);
  for (const name of ['Döviz Çevirici', 'Masaüstü Widget’ları', 'Kategoriler & Kurallar']) {
    await page.getByRole('button', { name, exact: true }).click();
    expect(await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  }
});
