import { test, expect } from '@playwright/test';
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  const search = page.getByRole('combobox', { name: 'Hızlı arama' });
  await expect(search).toBeVisible();
  return search;
}
test('empty search shows a compact guide and help prefills an explicit calculator', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const search = await open(page);
  await expect(page.locator('.launcher-prefix-guide')).toBeVisible();
  await search.fill('?');
  const guide = page.getByRole('region', { name: 'Komut önekleri' });
  await expect(guide).toHaveClass(/expanded/);
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.locator('.launcher-empty')).toHaveCount(0);
  await guide.getByRole('button', { name: 'calc önekini kullan', exact: true }).click();
  await expect(search).toHaveValue('calc ');
  await expect(search).toBeFocused();
  await search.fill('calc 120 * 45');
  await expect(page.getByRole('option')).toContainText('5.400');
  await search.press('Enter');
  await expect(page.locator('.launcher-notice')).toContainText('Kopyalandı: 5400');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('5400');
});
test('sys suggestions only prefill, destructive actions still confirm, and only dispatched actions are recorded', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const originalPrefixEntries=api.launcherEntries;
api.launcherEntries=async()=>({...await originalPrefixEntries(),capabilities:{system:['shutdown','lock','mute','empty-trash'],admin:false,reveal:false,web:true,copy:true}});
api.launcherAction=async input=>{
 window.__prefixActions ||= [];window.__prefixActions.push(input);
 if(input.type==='prepare-system')return {id:input.id,token:'test-only',expiresAt:Date.now()+30000};
 if(input.type==='system')return {type:'system',id:input.id,requested:true};
 throw Error('Unexpected fixture action');
};
api.recordLauncherCommand=async id=>{window.__prefixRecorded ||= [];window.__prefixRecorded.push(id);return {id,count:1,lastUsed:Date.now()};};
`,
    });
  });
  const search = await open(page);
  await search.fill('sys s');
  await expect(page.getByRole('option', { name: /^Sistemi Kapat / })).toBeVisible();
  await expect(page.getByRole('option', { name: /^Sesi azalt / })).toBeVisible();
  await search.press('Enter');
  await expect(search).toHaveValue('sys shutdown');
  expect(await page.evaluate(() => window.__prefixActions || [])).toEqual([]);
  await expect(page.getByRole('option')).toBeEnabled();
  await search.press('Enter');
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toContainText('Açık dosyalarını kaydet');
  await confirmation.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  expect(await page.evaluate(() => window.__prefixRecorded || [])).toEqual([]);
  await search.fill('sys kilitle');
  await expect(page.getByRole('option')).toContainText('Ekranı Kilitle');
  await search.press('Enter');
  await expect(page.locator('.launcher-panel')).toHaveCount(0);
  expect(await page.evaluate(() => window.__prefixActions.map((value) => value.type))).toEqual([
    'prepare-system',
    'system',
  ]);
  expect(await page.evaluate(() => window.__prefixRecorded)).toEqual(['system:lock']);
});
test('recorded command suggestions follow the three most-used apps without duplicating entries', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'darkdesk-demo-usage',
      JSON.stringify({
        'Visual Studio Code.lnk': { count: 20, lastOpened: Date.now() },
        'Google Chrome.lnk': { count: 14, lastOpened: Date.now() },
        'Figma.lnk': { count: 8, lastOpened: Date.now() },
      }),
    ),
  );
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const originalSuggestedEntries=api.launcherEntries;
api.launcherEntries=async()=>({...await originalSuggestedEntries(),commandUsage:{'command:organize':{count:5,lastUsed:Date.now()},'system:lock':{count:2,lastUsed:Date.now()}}});
`,
    });
  });
  await open(page);
  const rows = page.getByRole('option');
  await expect(rows.nth(0)).toContainText('Visual Studio Code');
  await expect(rows.nth(1)).toContainText('Google Chrome');
  await expect(rows.nth(2)).toContainText('Figma');
  await expect(rows.nth(3)).toContainText('Masaüstünü Düzenle');
  await expect(
    page.locator('.launcher-section-label').filter({ hasText: 'Önerilen komutlar' }),
  ).toBeVisible();
  await expect(rows.filter({ hasText: 'Masaüstünü Düzenle' })).toHaveCount(1);
});
test('prefix help supports keyboard navigation, whitespace invocation and narrow desktops', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 720 });
  const search = await open(page);
  await search.fill(' ');
  const guide = page.getByRole('region', { name: 'Komut önekleri' });
  await expect(guide).toHaveClass(/expanded/);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Pencereyi kapat', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Tümü', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Favoriler', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(guide.getByRole('button', { name: 'g önekini kullan', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(guide.getByRole('button', { name: 'yt önekini kullan', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(search).toHaveValue('yt ');
  await expect(search).toBeFocused();
  await search.press('F1');
  await expect(search).toHaveValue('?');
  expect(
    await page
      .locator('.launcher-panel')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});
test('a delayed catalog refresh preserves keyboard focus in prefix help', async ({ page }) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const guideCatalog = api.launcherEntries;
api.launcherEntries = async () => { await new Promise(resolve => window.__releaseGuideCatalog=resolve); return guideCatalog(); };
`,
    });
  });
  const search = await open(page);
  await search.fill(' ');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const firstPrefix = page.getByRole('button', { name: 'g önekini kullan', exact: true });
  await expect(firstPrefix).toBeFocused();
  await page.evaluate(() => window.__releaseGuideCatalog());
  await expect(page.locator('.launcher-search .spin')).toHaveCount(0);
  await expect(firstPrefix).toBeFocused();
});
