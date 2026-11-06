import { test, expect } from '@playwright/test';

async function mockUpdates(page, unsupported = false, privateAccess = false) {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const updateTestListeners = new Set();
let updateTestState = {state:${JSON.stringify(unsupported ? 'unsupported' : 'idle')},currentVersion:'3.4.0',version:null,reason:${JSON.stringify(unsupported ? 'portable' : null)},authenticationRequired:${JSON.stringify(privateAccess)},accessConfigured:false,accessSupported:true};
const sendUpdateTest = (patch) => {updateTestState={...updateTestState,...patch};for(const fn of updateTestListeners)fn({...updateTestState});return {...updateTestState};};
window.updateTest = { installs:0, opens:0, failNext:false, finish:()=>sendUpdateTest({state:'downloaded',progress:null}) };
api.updateStatus = async()=>({...updateTestState});
api.onUpdateChanged = (fn)=>{updateTestListeners.add(fn);return ()=>updateTestListeners.delete(fn);};
api.checkUpdates = async()=>window.updateTest.failNext?(window.updateTest.failNext=false,sendUpdateTest({state:'error',errorCode:'UPDATE_SOURCE_UNAVAILABLE'})):sendUpdateTest({state:'available',version:'3.5.0',errorCode:null});
api.downloadUpdate = async()=>sendUpdateTest({state:'downloading',progress:{percent:40}});
api.installUpdate = async()=>{window.updateTest.installs++;return sendUpdateTest({state:'downloaded',installing:true});};
api.openDownloads = async()=>{window.updateTest.opens++;};
api.saveUpdateAccess = async(token)=>{window.updateTest.savedArgument=token;return sendUpdateTest({accessConfigured:true,errorCode:null,state:'idle'});};
api.clearUpdateAccess = async()=>sendUpdateTest({accessConfigured:false,errorCode:'UPDATE_AUTH_REQUIRED',state:'idle'});
window.updateTest.status=()=>({...updateTestState});
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
  await expect(panel.locator('.update-access')).toHaveCount(0);
  await expect(panel.getByLabel('GitHub erişim anahtarı', { exact: true })).toHaveCount(0);
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
  await panel.getByRole('button', { name: 'İndirme sayfasını aç', exact: true }).click();
  expect(await page.evaluate(() => window.updateTest.opens)).toBe(1);
});

test('private updates require access and clear the password field after secure save', async ({
  page,
}) => {
  await mockUpdates(page, false, true);
  const panel = page.locator('.update-panel');
  const check = panel.getByRole('button', { name: 'Güncellemeleri kontrol et', exact: true });
  await expect(check).toBeDisabled();
  const tokenField = panel.getByLabel('GitHub erişim anahtarı', { exact: true });
  await expect(tokenField).toHaveAttribute('type', 'password');
  await expect(tokenField).toHaveValue('');
  const dummyToken = 'TEST_ONLY_DUMMY_ACCESS_VALUE_1234567890';
  await tokenField.fill(dummyToken);
  await panel.getByRole('button', { name: 'Erişimi kaydet', exact: true }).click();
  await expect(tokenField).toHaveValue('');
  await expect(check).toBeEnabled();
  expect(await page.evaluate(() => window.updateTest.savedArgument)).toBe(dummyToken);
  expect(await page.evaluate(() => JSON.stringify(window.updateTest.status()))).not.toContain(
    dummyToken,
  );
  await expect(panel).toContainText('Güncelleme erişimi bu cihazda yapılandırıldı.');
});

test('removing private repository access disables future update checks and exposes no saved token', async ({
  page,
}) => {
  await mockUpdates(page, false, true);
  const panel = page.locator('.update-panel');
  const tokenField = panel.getByLabel('GitHub erişim anahtarı', { exact: true });
  await tokenField.fill('TEST_ONLY_DUMMY_ACCESS_VALUE_9876543210');
  await panel.getByRole('button', { name: 'Erişimi kaydet', exact: true }).click();
  await expect(tokenField).toHaveValue('');
  await panel.getByRole('button', { name: 'Kayıtlı erişimi kaldır', exact: true }).click();
  await expect(
    panel.getByRole('button', { name: 'Güncellemeleri kontrol et', exact: true }),
  ).toBeDisabled();
  await expect(tokenField).toHaveValue('');
  await expect(
    panel.getByRole('button', { name: 'Kayıtlı erişimi kaldır', exact: true }),
  ).toHaveCount(0);
  await expect(panel.getByRole('alert')).toContainText('GitHub erişim anahtarı ekleyin');
  expect(await page.evaluate(() => window.updateTest.status().accessConfigured)).toBe(false);
});

test('the release notes action opens details without downloading or installing', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
window.__releaseActions=[];
api.updateStatus=async()=>({state:'available',currentVersion:'3.8.1',version:'3.8.2'});
api.openReleaseNotes=async()=>window.__releaseActions.push('notes');
api.downloadUpdate=async()=>window.__releaseActions.push('download');
api.installUpdate=async()=>window.__releaseActions.push('install');`,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await page.getByRole('button', { name: 'Sürümdeki yenilikler', exact: true }).click();
  expect(await page.evaluate(() => window.__releaseActions)).toEqual(['notes']);
});

test('a delayed initial status error cannot hide a newer available-update event', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
api.updateStatus=()=>new Promise((resolve,reject)=>{window.__rejectOldUpdateStatus=()=>reject(Error('old request failed'));});
api.onUpdateChanged=fn=>{window.__updateListener=fn;return()=>{};};`,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.evaluate(() =>
    window.__updateListener({ state: 'available', currentVersion: '3.8.1', version: '3.8.2' }),
  );
  await expect(page.locator('.update-notice')).toContainText('3.8.2');
  await page.evaluate(() => window.__rejectOldUpdateStatus());
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await expect(page.locator('.update-panel .update-state')).toHaveText('Yeni sürüm var');
  await expect(page.locator('.update-notice')).toContainText('3.8.2');
});

test('an available update stays discoverable in navigation after its notice is dismissed', async ({
  page,
}) => {
  await mockUpdates(page);
  await page
    .locator('.update-panel')
    .getByRole('button', { name: 'Güncellemeleri kontrol et', exact: true })
    .click();
  await expect(page.locator('.sidebar-update-badge')).toBeVisible();
  await page.locator('.update-notice-close').click();
  await expect(page.locator('.update-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await expect(page.locator('.sidebar-update-badge')).toBeVisible();
  await expect(page.locator('.sidebar-update-badge')).toHaveAttribute('title', /3.5.0/);
});
