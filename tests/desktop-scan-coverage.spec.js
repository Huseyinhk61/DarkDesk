import { test, expect } from '@playwright/test';

async function desktopCoverage(page, mode = 'move') {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const coverageScan = api.scan, coverageRuntime = api.runtimeStatus, coveragePreview = api.preview, coverageSettings = api.getSettings;
const coverageShared = new Set();
api.getSettings = async()=>({...await coverageSettings(),mode:${JSON.stringify(mode)}});
api.scan = async(scope)=>{
  const items = await coverageScan(scope);
  if(scope!=='desktop')return items;
  return items.map((item,index)=>{
    const shared=index<3;
    if(shared)coverageShared.add(item.id);
    return {...item,shared,sourceScope:shared?'shared':'desktop',source:shared?'C:/Users/Public/Desktop/'+item.name:item.source};
  }).filter(item=>!window.coverageDenied||!item.shared);
};
api.runtimeStatus = async()=>({...await coverageRuntime(),desktopScanReport:{
 sources:[{scope:'desktop',path:'C:/Users/User/Desktop',status:'ready',count:9},{scope:'shared',path:'C:/Users/Public/Desktop',status:window.coverageDenied?'denied':'ready',count:window.coverageDenied?0:3}],
 excluded:{folders:2,hidden:1,extensions:2},warnings:window.coverageDenied?[{scope:'shared',code:'SHARED_DESKTOP_ACCESS'}]:[],total:window.coverageDenied?9:12
}});
api.preview=async(...args)=>{
 const plan=await coveragePreview(...args);
 return {...plan,entries:plan.entries.map(entry=>coverageShared.has(entry.id)?{...entry,shared:true,sourceScope:'shared',source:'C:/Users/Public/Desktop/'+entry.name}:entry)};
};
`,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(page.locator('.desktop-scan-summary')).toBeVisible();
}

test('desktop coverage includes shared items and explains intentionally excluded folders', async ({
  page,
}) => {
  await desktopCoverage(page);
  const panel = page.getByRole('region', { name: 'Masaüstü tarama kapsamı', exact: true });
  await expect(panel).toContainText('12 öğe bulundu');
  await expect(
    panel.locator('.desktop-scan-source').filter({ hasText: 'Senin masaüstün' }),
  ).toContainText('9');
  await expect(
    panel.locator('.desktop-scan-source').filter({ hasText: 'Ortak masaüstü' }),
  ).toContainText('3');
  await expect(page.locator('.item-card .shared-item-badge')).toHaveCount(3);
  await panel.locator('summary').click();
  await expect(panel).toContainText('C:/Users/Public/Desktop');
  await expect(panel).toContainText('2 klasör yerinde bırakıldı');
  await expect(panel).toContainText('1 gizli dosya');
});

test('unreadable shared sources remain visible while personal desktop items stay available', async ({
  page,
}) => {
  await desktopCoverage(page);
  await page.evaluate(() => {
    window.coverageDenied = true;
  });
  await page.getByRole('button', { name: 'Akıllı Taramaya Başla', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(9);
  const panel = page.locator('.desktop-scan-summary');
  await expect(panel).toContainText('9 öğe bulundu');
  await expect(
    panel.locator('.desktop-scan-source').filter({ hasText: 'Ortak masaüstü' }),
  ).toContainText('Erişim izni yok');
  await expect(panel.getByRole('status')).toContainText('Bir masaüstü kaynağı okunamadı');
});

test('coverage explains hidden search results and clears filters without another scan', async ({
  page,
}) => {
  await desktopCoverage(page);
  const search = page.getByRole('textbox', { name: 'Öğe ara', exact: true });
  await search.fill('no-such-application');
  await expect(page.locator('.item-card')).toHaveCount(0);
  const panel = page.locator('.desktop-scan-summary');
  await expect(panel).toContainText('12 öğenin 0 tanesini');
  await panel.getByRole('button', { name: 'Filtreleri temizle', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.item-card')).toHaveCount(12);
});

test('shared move preview identifies affected users, source paths, and actual row actions', async ({
  page,
}) => {
  await desktopCoverage(page);
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.preview-shared-notice')).toContainText(
    'diğer kullanıcıların masaüstünden de kaldırılır',
  );
  await expect(dialog.locator('.preview-entry .shared-item-badge')).toHaveCount(3);
  await expect(dialog.locator('.preview-source-path').first()).toContainText(
    'C:/Users/Public/Desktop',
  );
  await expect(dialog.locator('.preview-action').first()).toContainText('Taşı');
  await expect(dialog.getByRole('button', { name: '12 öğeyi taşı', exact: true })).toBeEnabled();
});

test('copy mode clearly explains why original desktop files remain in place', async ({ page }) => {
  await desktopCoverage(page, 'copy');
  await expect(page.locator('.desktop-scan-copy')).toContainText('asıl dosyalar masaüstünde kalır');
  await page.getByRole('button', { name: 'Masaüstünü Demo Düzenle', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.preview-mode-notice')).toContainText(
    'asıl dosyalar masaüstünde kalır',
  );
  await expect(dialog.locator('.preview-shared-notice')).toContainText(
    'asılları tüm kullanıcılara görünür kalır',
  );
  await expect(dialog.locator('.preview-action').first()).toContainText('Kopyala');
  await expect(dialog.getByRole('button', { name: '12 öğeyi kopyala', exact: true })).toBeEnabled();
});

test('coverage and shared item notices follow the English interface language', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('darkdesk-settings', JSON.stringify({ language: 'en' }));
    localStorage.setItem('darkdesk-appearance', JSON.stringify({ language: 'en' }));
  });
  await desktopCoverage(page, 'copy');
  await expect(
    page.getByRole('region', { name: 'Desktop scan coverage', exact: true }),
  ).toContainText('12 items found');
  await expect(page.locator('.item-card .shared-item-badge').first()).toHaveText('Shared desktop');
  await page.getByRole('button', { name: 'Organize Demo Desktop', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.preview-shared-notice')).toContainText(
    'originals visible to all users',
  );
});
