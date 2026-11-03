import { test, expect } from '@playwright/test';

async function mockUpdates(page, unsupported = false) {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const updateTestListeners = new Set();
let updateTestState = {state:${JSON.stringify(unsupported ? 'unsupported' : 'idle')},currentVersion:'3.4.0',version:null,reason:${JSON.stringify(unsupported ? 'portable' : null)}};
const sendUpdateTest = (patch) => {updateTestState={...updateTestState,...patch};for(const fn of updateTestListeners)fn({...updateTestState});return {...updateTestState};};
window.updateTest = { installs:0, opens:0, failNext:false, finish:()=>sendUpdateTest({state:'downloaded',progress:null}) };
api.updateStatus = async()=>({...updateTestState});
api.onUpdateChanged = (fn)=>{updateTestListeners.add(fn);return ()=>updateTestListeners.delete(fn);};
api.checkUpdates = async()=>window.updateTest.failNext?(window.updateTest.failNext=false,sendUpdateTest({state:'error',errorCode:'UPDATE_SOURCE_UNAVAILABLE'})):sendUpdateTest({state:'available',version:'3.5.0',errorCode:null});
api.downloadUpdate = async()=>sendUpdateTest({state:'downloading',progress:{percent:40}});
api.installUpdate = async()=>{window.updateTest.installs++;return sendUpdateTest({state:'downloaded',installing:true});};
api.openDownloads = async()=>{window.updateTest.opens++;};
`,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await expect(page.locator('.update-panel')).toBeVisible();
}

test('updates are downloaded explicitly and installation waits until a package is ready', async ({
  page,
}) => {
  await mockUpdates(page);
  const panel = page.locator('.update-panel');
  await panel.getByRole('button', { name: 'Güncellemeleri kontrol et', exact: true }).click();
  await expect(panel).toContainText('3.5.0');
  await expect(
    panel.getByRole('button', { name: 'Yeniden başlat ve güncelle', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.update-notice')).toContainText('3.5.0');
  await panel.getByRole('button', { name: 'Güncellemeyi indir', exact: true }).click();
  await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  expect(await page.evaluate(() => window.updateTest.installs)).toBe(0);
  await page.evaluate(() => window.updateTest.finish());
  const install = panel.getByRole('button', { name: 'Yeniden başlat ve güncelle', exact: true });
  await expect(install).toBeEnabled();
  await install.click();
  expect(await page.evaluate(() => window.updateTest.installs)).toBe(1);
});

test('an inaccessible update feed is explained without claiming the app is up to date', async ({
  page,
}) => {
  await mockUpdates(page);
  const panel = page.locator('.update-panel');
  await page.evaluate(() => {
    window.updateTest.failNext = true;
  });
  await panel.getByRole('button', { name: 'Güncellemeleri kontrol et', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Güncelleme dosyalarına erişilemiyor');
  await expect(panel.locator('.update-state')).not.toHaveText('Güncelsin');
  await panel.getByRole('button', { name: 'Güncellemeleri kontrol et', exact: true }).click();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(
    panel.getByRole('button', { name: 'Güncellemeyi indir', exact: true }),
  ).toBeEnabled();
});

test('portable installations offer a manual EXE download and do not offer an in-app install', async ({
  page,
}) => {
  await mockUpdates(page, true);
  const panel = page.locator('.update-panel');
  await expect(panel).toContainText('Taşınabilir sürümü');
  await expect(
    panel.getByRole('button', { name: 'Güncellemeleri kontrol et', exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole('button', { name: 'Yeniden başlat ve güncelle', exact: true }),
  ).toHaveCount(0);
  await panel.getByRole('button', { name: 'EXE indirme sayfasını aç', exact: true }).click();
  expect(await page.evaluate(() => window.updateTest.opens)).toBe(1);
});
