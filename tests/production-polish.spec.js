import { test, expect } from '@playwright/test';
import en from '../src/locales/en.json' with { type: 'json' };

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
}
async function edit(page) {
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await page.getByRole('button', { name: 'Düzenle Yazılım & Geliştirme', exact: true }).click();
  return page.getByRole('dialog');
}
const artwork = async (element) => decodeURIComponent(await element.getAttribute('src'));

test('an individual folder style persists, follows global style only when reset, and applies saved state', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()).replace('export const native =', 'export let native =') +
        `
const previousStats=api.stats;
api.stats=async()=>({...await previousStats(),platform:'win32'});
api.applyFolderAppearance=async()=>{window.__applied ||= [];window.__applied.push(await api.getSettings());return {updated:1,unchanged:0,failed:0,skipped:0,details:[]};};native=true;`,
    });
  });
  await ready(page);
  let dialog = await edit(page);
  await dialog.getByLabel('Bu klasörün stili', { exact: true }).selectOption('outline');
  await dialog.getByRole('button', { name: 'Gün batımı', exact: true }).click();
  const preview = dialog.locator('.category-editor-preview img');
  expect(await artwork(preview)).toContain('dd-outline-f59e0b-e11d48');
  await dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__applied?.length)).toBe(1);
  const applied = await page.evaluate(() =>
    window.__applied[0].categories.find((c) => c.id === 'software'),
  );
  expect(applied.folderTheme).toBe('outline');
  expect(applied.customColor).toEqual({ from: '#f59e0b', to: '#e11d48' });
  await page.getByRole('button', { name: 'Düz Renk', exact: true }).click();
  await expect(page.locator('.activity-bar')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(12);
  const card = page.locator('button.category').filter({ hasText: 'Yazılım & Geliştirme' });
  expect(await artwork(card.locator('img'))).toContain('dd-outline-f59e0b-e11d48');
  dialog = await edit(page);
  await dialog.getByLabel('Bu klasörün stili', { exact: true }).selectOption('');
  expect(await artwork(dialog.locator('.category-editor-preview img'))).toContain(
    'dd-solid-f59e0b-e11d48',
  );
  await dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  expect(await artwork(card.locator('img'))).toContain('dd-solid-f59e0b-e11d48');
});

test('currency codes without amounts use one unit and keep unit conversion distinct', async ({
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
  await ready(page);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Hızlı arama' });
  for (const [query, result] of [
    ['USD to TRY', '40 TRY'],
    ['EUR', '50 TRY'],
    ['10 km to m', '10.000 m'],
  ]) {
    await input.fill(query);
    await expect(page.getByRole('option')).toContainText(result);
  }
});

test('startup long names, status controls and expanded commands fit a small desktop window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 768 });
  await page.addInitScript(() => {
    localStorage.setItem('darkdesk-settings', JSON.stringify({ language: 'en', uiScale: 130 }));
  });
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `\napi.getStartupApps=async()=>({supported:true,platform:'win32',warnings:[],items:[{id:'user:long',name:'Very long startup application name for desktop accessibility and performance management',command:'C:/'+'VeryLongApplicationPath/'.repeat(30)+'Application.exe --background',source:'user-run',enabled:true,canEdit:true}]});`,
    });
  });
  await ready(page);
  await page.getByRole('button', { name: en['nav.systemTools'], exact: true }).click();
  await expect(page.locator('.startup-row')).toHaveCount(1);
  await page.getByText(en['startupPlus.command'], { exact: true }).click();
  await expect(page.locator('.startup-command code')).toBeVisible();
  for (const selector of ['main', '.startup-row', '.startup-command code', '.startup-app-name'])
    expect(
      await page
        .locator(selector)
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
  const name = await page.locator('.startup-app-name').boundingBox();
  const action = await page.locator('.startup-row-action').boundingBox();
  expect(name.x + name.width).toBeLessThanOrEqual(action.x);
  await page.screenshot({ path: 'test-results/startup-polish.png' });
});

test('scanner cards keep long application names and AI categories readable at large text size', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.addInitScript(() =>
    localStorage.setItem('darkdesk-settings', JSON.stringify({ uiScale: 130 })),
  );
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const previousScan=api.scan;
api.scan=async scope=>(await previousScan(scope)).map((item,index)=>index?item:{...item,name:'Cursor.exe',productName:'Cursor AI application with a long descriptive localized product name for development',category:'aicode'});`,
    });
  });
  await ready(page);
  await page.getByRole('button', { name: 'Sistem Tarama', exact: true }).click();
  const card = page.locator('.item-card').filter({ hasText: 'Cursor AI application' });
  await expect(card.getByRole('combobox').first()).toHaveValue('aicode');
  for (const selector of ['main', '.item-card h3', '.item-metadata', '.select-wrap']) {
    const elements = page.locator(selector);
    expect(
      await elements.evaluateAll((nodes) =>
        nodes.every((node) => node.scrollWidth <= node.clientWidth + 1),
      ),
    ).toBe(true);
  }
  expect((await card.boundingBox()).width).toBeGreaterThanOrEqual(270);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/scanner-polish.png' });
});

test('favorites guide first-time users and retain both command and application pins', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await expect(page.locator('.launcher-search .spin')).toHaveCount(0);
  const input = page.getByRole('combobox', { name: 'Hızlı arama' });
  const favorites = page.getByRole('button', { name: 'Favoriler', exact: true });
  await favorites.click();
  await expect(page.locator('.launcher-empty')).toContainText('Ctrl+D');
  await page.getByRole('button', { name: 'Tümü', exact: true }).click();
  for (const [query, title] of [
    ['DarkDesk Aç', 'DarkDesk Aç'],
    ['vsc', 'Visual Studio Code'],
  ]) {
    await input.fill(query);
    await expect(page.getByRole('option').first()).toContainText(title);
    await input.press('Control+d');
    await expect(
      page.getByRole('button', { name: 'Seçili öğeyi sabitle / kaldır' }),
    ).toHaveAttribute('aria-pressed', 'true');
  }
  await input.fill('');
  await favorites.click();
  await expect(page.getByRole('option')).toHaveCount(2);
  await input.press('Escape');
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await expect(page.locator('.launcher-search .spin')).toHaveCount(0);
  await favorites.click();
  await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.getByRole('option').filter({ hasText: 'Visual Studio Code' })).toHaveCount(1);
  await expect(page.getByRole('option').filter({ hasText: 'DarkDesk Aç' })).toHaveCount(1);
});

test('layout hover events cannot steal keyboard selection while actual pointer movement can', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await expect(page.locator('.launcher-search .spin')).toHaveCount(0);
  const input = page.getByRole('combobox', { name: 'Hızlı arama' });
  await input.fill('vsc');
  const results = page.getByRole('option');
  await expect(results.first()).toContainText('Visual Studio Code');
  await results.nth(1).dispatchEvent('mouseover', { bubbles: true });
  await expect(results.first()).toHaveAttribute('aria-selected', 'true');
  await results.nth(1).hover();
  await expect(results.nth(1)).toHaveAttribute('aria-selected', 'true');
  await input.press('ArrowUp');
  await expect(results.first()).toHaveAttribute('aria-selected', 'true');
});
