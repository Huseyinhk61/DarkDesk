import { test, expect } from '@playwright/test';
const settled = (page) => expect(page.locator('.activity-bar')).toHaveCount(0);
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await settled(page);
  await page.getByRole('button', { name: 'Sistem Tarama', exact: true }).click();
}
async function instrument(page) {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
      const originalScanSystem=api.scanSystem;
      api.scanSystem=async()=>{window.deepScans=(window.deepScans||0)+1;return originalScanSystem();};
    `,
    });
  });
}
test('scanner sources and scan buttons follow Desktop, installed apps and Downloads independently', async ({
  page,
}) => {
  await instrument(page);
  await open(page);
  const scanner = page.locator('.scanner-panel');
  await expect(scanner.getByRole('button', { name: 'Masaüstü', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await scanner.getByRole('button', { name: 'Masaüstünü tara', exact: true }).click();
  await settled(page);
  await expect(page.locator('.item-card')).toHaveCount(12);
  expect(await page.evaluate(() => window.deepScans || 0)).toBe(0);
  await scanner.getByRole('button', { name: 'Yüklü uygulamalar', exact: true }).click();
  await settled(page);
  await expect(page.locator('.item-card')).toHaveCount(0);
  await scanner.getByRole('button', { name: 'Derin taramayı başlat', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(8);
  await settled(page);
  await scanner.getByRole('button', { name: 'Masaüstü', exact: true }).click();
  await settled(page);
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(scanner.locator('.scan-source-chips')).not.toContainText('Program Files');
  await scanner.getByRole('button', { name: 'İndirilenler', exact: true }).click();
  await settled(page);
  await scanner.getByRole('button', { name: 'İndirilenleri tara', exact: true }).click();
  await settled(page);
  await expect(page.locator('.item-card')).toHaveCount(3);
  await expect(page.locator('.item-card').filter({ hasText: 'Capture.png' })).toBeVisible();
  await scanner.getByRole('button', { name: 'Yüklü uygulamalar', exact: true }).click();
  await settled(page);
  await expect(page.locator('.item-card')).toHaveCount(8);
  expect(await page.evaluate(() => window.deepScans)).toBe(1);
});
test('switching source clears filters that would hide another collection', async ({ page }) => {
  await open(page);
  const scanner = page.locator('.scanner-panel');
  await scanner.getByRole('button', { name: 'Yüklü uygulamalar', exact: true }).click();
  await settled(page);
  await scanner.getByRole('button', { name: 'Derin taramayı başlat', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(8);
  await settled(page);
  await scanner.getByRole('button', { name: 'Masaüstü', exact: true }).click();
  await settled(page);
  await page.locator('.category').filter({ hasText: 'Yazılım & Geliştirme' }).click();
  await page.getByRole('textbox', { name: 'Öğe ara', exact: true }).fill('this-does-not-match');
  await expect(page.locator('.item-card')).toHaveCount(0);
  await scanner.getByRole('button', { name: 'Yüklü uygulamalar', exact: true }).click();
  await settled(page);
  await expect(page.getByRole('textbox', { name: 'Öğe ara', exact: true })).toHaveValue('');
  await expect(page.locator('.category.selected')).toHaveCount(0);
  await expect(page.locator('.item-card')).toHaveCount(8);
});
test('a failed source read never leaves the previous collection under the wrong tab', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
      const sourceScan=api.scan;
      api.scan=async(scope)=>{if(scope==='downloads'&&!window.allowDownloads)throw Error('DESKTOP_READ');return sourceScan(scope);};
    `,
    });
  });
  await open(page);
  const scanner = page.locator('.scanner-panel');
  await scanner.getByRole('button', { name: 'İndirilenler', exact: true }).click();
  await settled(page);
  await expect(scanner.getByRole('button', { name: 'İndirilenler', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.item-card')).toHaveCount(0);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(() => {
    window.allowDownloads = true;
  });
  await scanner.getByRole('button', { name: 'İndirilenleri tara', exact: true }).click();
  await settled(page);
  await expect(page.locator('.item-card')).toHaveCount(3);
});
