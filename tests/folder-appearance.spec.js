import { test, expect } from '@playwright/test';
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
}
const settled = (page) => expect(page.locator('.activity-bar')).toHaveCount(0);

test('folder styles and new application palettes apply and persist across reload', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await page.getByRole('button', { name: 'Çizgisel', exact: true }).click();
  await settled(page);
  await expect(page.locator('html')).toHaveAttribute('data-folder-theme', 'outline');
  await page.getByRole('button', { name: 'Paper Ivory', exact: true }).click();
  await settled(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-folder-theme', 'outline');
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await expect(page.locator('button.category .folder-preview').first()).toHaveAttribute(
    'src',
    /dd-outline-blue-code/,
  );
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await page.getByRole('button', { name: 'Solarized Night', exact: true }).click();
  await settled(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'solarized');
  await expect(
    page.getByRole('button', { name: 'Masaüstü klasörlerine uygula', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('.folder-appearance-panel')).toContainText(
    'Windows masaüstü sürümünde',
  );
});

test('category colors have live previews and color-only editing preserves localized builtin labels', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await page.getByRole('button', { name: 'Düzenle Yazılım & Geliştirme', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Turkuaz', exact: true }).click();
  await expect(dialog.locator('.folder-preview')).toHaveAttribute('src', /dd-gradient-teal-code/);
  await dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await page.getByLabel('Dil', { exact: true }).selectOption('en');
  await settled(page);
  await page.getByRole('button', { name: 'Smart Groups', exact: true }).click();
  const card = page.locator('button.category').filter({ hasText: 'Software & Development' });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveClass(/teal/);
  await expect(card.locator('.folder-preview')).toHaveAttribute('src', /dd-gradient-teal-code/);
});

test('category search, quick subgroups and a rule preview expose the affected source items', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Kategori ara', exact: true });
  await search.fill('veritabanı');
  await expect(page.locator('.managed-group')).toHaveCount(1);
  await expect(page.locator('.managed-group')).toContainText('Veritabanı');
  await search.fill('');
  await page
    .getByRole('button', { name: 'Yazılım & Geliştirme için alt grup ekle', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Ad', { exact: true }).fill('Research Tools');
  await expect(dialog.getByLabel('Üst grup', { exact: true })).toHaveValue('software');
  await dialog.getByRole('button', { name: 'Kategoriyi kaydet', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.managed-groups')).toContainText('Research Tools');
  await page.getByRole('textbox', { name: 'Eşleşecek metin', exact: true }).fill('Figma');
  await expect(page.locator('.rule-preview')).toContainText('1 öğe kuralla eşleşiyor');
  await expect(page.locator('.rule-preview')).toContainText('Figma.lnk');
});

test('review filtering explains uncertain assignments and respects a manual correction', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
 const baseReviewScan=api.scan;api.scan=async(scope)=>{const result=await baseReviewScan(scope);if(scope!=='desktop')return result;return [...result,enrichItem({id:'MysteryApp.exe',name:'MysteryApp.exe',source:'Desktop/MysteryApp.exe',scope:'desktop',kind:'file',size:1234,modified:Date.now()},await api.getSettings())];};
 `,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(13);
  const review = page.locator('.group-review-toggle');
  await expect(review).toContainText('1');
  await review.click();
  await expect(page.locator('.item-card')).toHaveCount(1);
  await expect(page.locator('.classification-reason')).toContainText('Grubu gözden geçir');
  await page.getByLabel('MysteryApp.exe hedef klasörü', { exact: true }).selectOption('software');
  await settled(page);
  await expect(review).toContainText('0');
  await review.click();
  await expect(page.locator('.item-card')).toHaveCount(13);
  await expect(
    page.locator('.item-card').filter({ hasText: 'MysteryApp' }).locator('.classification-reason'),
  ).toHaveText('Senin seçimin');
});

test('scrollbars follow themes while window controls stay fixed during settings scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  const main = page.locator('main');
  await expect(main).toHaveCSS('scrollbar-gutter', 'stable');
  const before = await page.locator('.titlebar').boundingBox();
  const styles = await main.evaluate((element) => ({
    width: getComputedStyle(element, '::-webkit-scrollbar').width,
    radius: getComputedStyle(element, '::-webkit-scrollbar-thumb').borderRadius,
  }));
  expect(styles.width).toBe('12px');
  expect(styles.radius).toBe('12px');
  await main.evaluate((element) => {
    element.scrollTop = 500;
  });
  expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
  expect((await page.locator('.titlebar').boundingBox()).y).toBe(before.y);
  await page.getByRole('button', { name: 'Paper Ivory', exact: true }).click();
  await settled(page);
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
});
