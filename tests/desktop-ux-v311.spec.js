import { test, expect } from '@playwright/test';
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
}
test('Default Mode is a visible restoring mode that does not hide unknown desktop items', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Çalışma Profilleri', exact: true }).click();
  const normal = page.locator('.default-profile');
  await expect(normal).toHaveClass(/active/);
  await page.getByRole('button', { name: /^Yazılım & Kodlama Modu/ }).click();
  await expect(normal).not.toHaveClass(/active/);
  await normal.getByRole('button').click();
  await expect(normal).toHaveClass(/active/);
  await expect(page.locator('.profile-card.active:not(.default-profile)')).toHaveCount(0);
});
test('widget gallery fits its controls and the system monitor separates readable CPU, RAM and disk details', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `\napi.systemToolsSnapshot=async()=>({cpuPercent:64,cores:Array(32).fill(64),coreCount:32,cpuModel:'Test Processor',memory:{total:8589934592,used:3221225472,free:5368709120,percent:37.5},process:{rss:100000000},disk:{total:1000000000,free:600000000,percent:40}});`,
    });
  });
  await page.setViewportSize({ width: 1000, height: 768 });
  await open(page);
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  await expect(page.getByRole('slider', { name: /bulanıklığı/ })).toHaveCount(0);
  const cards = page.locator('.widget-module-card');
  expect(await cards.evaluateAll((es) => es.every((e) => e.scrollWidth <= e.clientWidth))).toBe(
    true,
  );
  await cards
    .filter({ has: page.getByRole('heading', { name: 'Sistem göstergesi', exact: true }) })
    .getByRole('button', { name: 'Önizlemeyi aç', exact: true })
    .click();
  const monitor = page.locator('.system-monitor-widget');
  await expect(monitor).toContainText('64%');
  await expect(monitor).toContainText('38%');
  await monitor.getByRole('button', { name: 'CPU', exact: true }).click();
  await expect(monitor).toContainText('Test Processor');
  await expect(monitor.locator('.widget-cores > span')).toHaveCount(16);
  await monitor.getByRole('button', { name: 'Sonraki', exact: true }).click();
  await expect(monitor.locator('.monitor-pagination')).toContainText('2/2');
  await monitor.getByRole('button', { name: 'Bellek', exact: true }).click();
  await expect(monitor.locator('.monitor-detail-list')).toContainText('Kullanılan');
  await monitor.getByRole('button', { name: 'Disk', exact: true }).click();
  await expect(monitor).toContainText('40%');
  expect(
    await page
      .locator('.desktop-widget .widget-content')
      .evaluate((e) => getComputedStyle(e).scrollbarWidth),
  ).toBe('none');
});
test('category cards expose customization and explicitly apply the newly saved color to one Desktop folder', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()).replace('export const native =', 'export let native =') +
        `
const stats311=api.stats;api.stats=async()=>({...await stats311(),platform:'win32'});
api.applyFolderAppearance=async()=>({updated:1,unchanged:0,skipped:0,failed:0,details:[]});
api.prepareCategoryFolder=async id=>{window.__prepared311={id,settings:await api.getSettings()};return {updated:1,unchanged:0,skipped:0,failed:0,details:[]};};native=true;`,
    });
  });
  await open(page);
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await expect(page.locator('.folder-customize-guide')).toContainText(
    'Klasör görünümünü buradan değiştir',
  );
  const category = page
    .locator('.managed-group')
    .filter({ has: page.getByText('Yazılım & Geliştirme', { exact: true }).first() });
  await category.locator('.category-customize').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Okyanus', exact: true }).click();
  await dialog.getByRole('button', { name: 'Masaüstüne kaydet ve uygula', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const prepared = await page.evaluate(() => window.__prepared311);
  expect(prepared.id).toBe('software');
  expect(prepared.settings.categories.find((c) => c.id === 'software').customColor).toEqual({
    from: '#06b6d4',
    to: '#2563eb',
  });
});
test('a chosen scan source remains distinct from Desktop and installed applications', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()).replace('export const native =', 'export let native =') +
        `
const scan311=api.scan;let selected311=[];api.chooseScanLocation=async()=>{selected311=[{id:'custom-krita',name:'Krita.exe',kind:'installed',source:'D:\\Apps\\Krita.exe',target:'D:\\Apps\\Krita.exe',category:'design',origin:'custom',scope:'custom',size:100,modified:Date.now()}];return {path:'D:/Apps',items:selected311};};api.scan=async scope=>scope==='custom'?selected311:scan311(scope);native=true;`,
    });
  });
  await open(page);
  await page.getByRole('button', { name: 'Sistem Tarama', exact: true }).click();
  await page.getByRole('button', { name: 'Konum seç ve tara', exact: true }).click();
  await expect(page.locator('.scan-selected-location')).toContainText('D:/Apps');
  await expect(page.locator('.item-card')).toHaveCount(1);
  await expect(page.locator('.item-card')).toContainText('Krita.exe');
  await page.getByRole('button', { name: 'Masaüstü', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
});
test('the redesigned converter offers quick pairs and readable results on a small desktop', async ({
  page,
}) => {
  await page.route('https://api.frankfurter.dev/**', (r) =>
    r.fulfill({
      json: {
        base: 'USD',
        date: new Date().toISOString().slice(0, 10),
        rates: { EUR: 0.8, TRY: 40, GBP: 0.7 },
      },
    }),
  );
  await page.setViewportSize({ width: 900, height: 700 });
  await open(page);
  await page.getByRole('button', { name: 'Döviz Çevirici', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tutar', exact: true }).fill('50');
  await expect(page.locator('.currency-result')).toContainText('2.000 TRY');
  await page
    .getByRole('group', { name: 'Hızlı para birimi çiftleri' })
    .getByRole('button', { name: 'USD EUR', exact: true })
    .click();
  await expect(page.locator('.currency-result')).toContainText('40 EUR');
  expect(
    await page.locator('.conversion-workbench').evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
});
