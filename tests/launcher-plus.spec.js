import { test, expect } from '@playwright/test';
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  const search = page.getByRole('combobox', { name: 'Hızlı arama' });
  await expect(search).toBeVisible();
  return search;
}
test('calculator and unit conversions copy canonical results and keep the launcher ready', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const search = await open(page);
  await search.fill('120 * 45');
  const result = page.getByRole('option').first();
  await expect(result).toContainText('5.400');
  await expect(result.locator('.launcher-type-badge')).toHaveText('Hesaplama');
  await search.press('Enter');
  await expect(page.locator('.launcher-notice')).toContainText('Kopyalandı: 5400');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('5400');
  await expect(search).toBeFocused();
  await search.fill('10 km to m');
  await expect(result).toContainText('10.000 m');
  await search.press('Enter');
  await expect(page.locator('.launcher-notice')).toContainText('10000 m');
  await search.fill('1 / 0');
  await expect(result).toBeDisabled();
  await search.press('Enter');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('10000 m');
});
test('web prefixes open only encoded provider searches after explicit activation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__searchUrls = [];
    window.open = (url) => {
      window.__searchUrls.push(url);
      return null;
    };
  });
  const search = await open(page);
  await search.fill('gh react hooks & desktop');
  await expect(page.getByRole('option')).toContainText('GitHub');
  expect(await page.evaluate(() => window.__searchUrls)).toEqual([]);
  await search.press('Enter');
  await expect(page.locator('.launcher-panel')).toHaveCount(0);
  const urls = await page.evaluate(() => window.__searchUrls);
  expect(new URL(urls[0]).origin).toBe('https://github.com');
  expect(new URL(urls[0]).searchParams.get('q')).toBe('react hooks & desktop');
});
test('Tab opens sub-actions, favorites persist, and Escape returns to search without closing', async ({
  page,
}) => {
  const search = await open(page);
  await search.fill('vsc');
  await expect(page.getByRole('option').first()).toContainText('Visual Studio Code');
  await search.press('Tab');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Yönetici Olarak Çalıştır' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(search).toBeFocused();
  await search.press('Control+k');
  await menu.getByRole('menuitem', { name: 'Favorilere ekle' }).click();
  await expect(menu).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await expect(
    page.locator('.launcher-section-label').filter({ hasText: 'Favoriler' }),
  ).toBeVisible();
  await expect(
    page.getByRole('option').filter({ hasText: 'Visual Studio Code' }).locator('.launcher-pinned'),
  ).toBeVisible();
});
test('empty search puts the three most-used actual items before system commands', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'darkdesk-demo-usage',
      JSON.stringify({
        'Google Chrome.lnk': { count: 14, lastOpened: Date.now() },
        'Visual Studio Code.lnk': { count: 20, lastOpened: Date.now() },
        'Figma.lnk': { count: 8, lastOpened: Date.now() },
      }),
    ),
  );
  await open(page);
  const results = page.getByRole('option');
  await expect(results.nth(0)).toContainText('Visual Studio Code');
  await expect(results.nth(1)).toContainText('Google Chrome');
  await expect(results.nth(2)).toContainText('Figma');
  await expect(page.locator('.launcher-section-label').first()).toHaveText('En sık kullandıkların');
});
test('destructive commands require a cancellable, expiring confirmation before dispatch', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const baseEntries=api.launcherEntries;
api.launcherEntries=async()=>({...await baseEntries(),capabilities:{system:['shutdown','empty-trash'],admin:false,reveal:false,copy:true,web:true}});
api.launcherAction=async action=>{
 window.__systemActions ||= []; window.__systemActions.push(action.type);
 if(action.type==='prepare-system')return {id:action.id,token:'fixture-only',expiresAt:Date.now()+30000};
 if(action.type==='confirm-system')return {type:'system',id:'shutdown',requested:true};
 throw Error('LAUNCHER_UNSUPPORTED');
};`,
    });
  });
  const search = await open(page);
  await search.fill('Sistemi Kapat');
  await expect(page.getByRole('option').first()).toContainText('Sistemi Kapat');
  await expect(page.getByRole('option').first()).toBeEnabled();
  expect(await page.evaluate(() => window.__systemActions || [])).toEqual([]);
  await search.press('Enter');
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Açık dosyalarını kaydet');
  expect(await page.evaluate(() => window.__systemActions)).toEqual(['prepare-system']);
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(search).toBeFocused();
  await search.press('Enter');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Onayla ve uygula' }).click();
  await expect(page.locator('.launcher-panel')).toHaveCount(0);
  expect(await page.evaluate(() => window.__systemActions)).toEqual([
    'prepare-system',
    'prepare-system',
    'confirm-system',
  ]);
});

test('a single-result action menu is fully visible and opens on its first action', async ({
  page,
}) => {
  const search = await open(page);
  await search.fill('Visual Studio Code');
  await expect(page.getByRole('option')).toHaveCount(1);
  await search.press('Tab');
  const menu = page.getByRole('menu');
  const favorite = menu.getByRole('menuitem', { name: 'Favorilere ekle' });
  await expect(favorite).toBeFocused();
  const panel = await page.locator('.launcher-panel').boundingBox();
  const action = await favorite.boundingBox();
  expect(action.y).toBeGreaterThanOrEqual(panel.y);
  expect(action.y + action.height).toBeLessThanOrEqual(panel.y + panel.height);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(search).toBeFocused();
});
