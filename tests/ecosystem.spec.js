import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
});
const settled = (page) => expect(page.locator('.activity-bar')).toHaveCount(0);
test('workspace profiles switch visibility simulation and can restore the desktop', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Çalışma Profilleri', exact: true }).click();
  await page.locator('.profile-activate').filter({ hasText: 'Yazılım & Kodlama Modu' }).click();
  await settled(page);
  await expect(page.locator('.profile-card.active')).toHaveCount(1);
  await expect(page.locator('.profiles-heading')).toContainText('geçici gizli');
  await page.getByRole('button', { name: 'Tümünü geri göster', exact: true }).click();
  await settled(page);
  await expect(page.locator('.profile-card.active')).toHaveCount(0);
});
test('profile hotkeys work in the focused web demo and shortcut collisions are rejected', async ({
  page,
}) => {
  await page.keyboard.press('Control+Alt+1');
  await settled(page);
  await expect(page.locator('.profile-card.active')).toHaveCount(1);
  await page.getByRole('button', { name: 'Çalışma Profilleri', exact: true }).click();
  await page.getByRole('button', { name: 'Düzenle Yazılım & Kodlama', exact: true }).click();
  const modal = page.getByRole('dialog');
  const binder = modal.getByLabel('Klavye kısayolu', { exact: true });
  await binder.click();
  await page.keyboard.press('Alt+Space');
  await expect(modal.locator('.key-binder')).toContainText('başka bir işleve atanmış');
  await expect(binder).toHaveValue('Ctrl+Alt+1');
  await expect(page.locator('.launcher-panel')).toHaveCount(0);
  await binder.click();
  await page.keyboard.press('Control+Alt+K');
  await expect(binder).toHaveValue('Ctrl+Alt+K');
  await modal.getByRole('button', { name: 'Profili kaydet' }).click();
  await expect(modal).toHaveCount(0);
  await settled(page);
  await page.getByRole('button', { name: 'Tümünü geri göster', exact: true }).click();
  await settled(page);
  await page.keyboard.press('Control+Alt+K');
  await settled(page);
  await expect(page.locator('.profile-card.active')).toHaveCount(1);
});
test('Spotlight fuzzy search can select an application with Enter', async ({ page }) => {
  await page.keyboard.press('Control+Space');
  const dialog = page.getByRole('dialog', { name: 'Hızlı Başlatıcı' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Hızlı arama' }).fill('vsc');
  await expect(dialog.getByRole('option').first()).toContainText('Visual Studio Code');
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await page.getByRole('combobox', { name: 'Hızlı arama' }).fill('eşleşmeyen-xyz');
  await expect(page.locator('.launcher-empty')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.launcher-panel')).toHaveCount(0);
});
test('Spotlight system commands open a review instead of silently moving files', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  await page.getByRole('combobox', { name: 'Hızlı arama' }).fill('Masaüstünü Düzenle');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Son bir göz atalım.' })).toBeVisible();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
});
test('regex rules route filename matches and invalid lookaround is rejected', async ({ page }) => {
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await page.getByLabel('Adı veya hedefi içeriyor', { exact: true }).selectOption('regex');
  await page.getByRole('textbox', { name: 'Eşleşecek metin' }).fill('^Google.*');
  await page.getByLabel('Hedef kategori', { exact: true }).selectOption('systemnetwork');
  await page.getByRole('button', { name: 'Kural ekle', exact: true }).click();
  await settled(page);
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await expect(page.getByLabel('Google Chrome.lnk hedef klasörü')).toHaveValue('systemnetwork');
  await page.getByRole('button', { name: 'Kategoriler & Kurallar', exact: true }).click();
  await page.getByLabel('Adı veya hedefi içeriyor', { exact: true }).selectOption('regex');
  await page.getByRole('textbox', { name: 'Eşleşecek metin' }).fill('(?=Google)');
  await page.getByRole('button', { name: 'Kural ekle', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Regex geçersiz');
});
test('dragging a card changes its category without a physical operation', async ({ page }) => {
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await transfer.evaluate((data) => data.setData('application/x-darkdesk-item', 'Figma.lnk'));
  const category = page.locator('.category').filter({ hasText: 'Yazılım & Geliştirme' });
  await category.dispatchEvent('dragover', { dataTransfer: transfer });
  await expect(category).toHaveClass(/drag-hover/);
  await category.dispatchEvent('drop', { dataTransfer: transfer });
  await settled(page);
  await expect(page.getByLabel('Figma.lnk hedef klasörü')).toHaveValue('software');
  await expect(page.locator('.item-card')).toHaveCount(12);
});
test('external drop opens a physical operation preview and supports cancellation', async ({
  page,
}) => {
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['sample'], 'Dropped.pdf', { type: 'application/pdf' }));
    return data;
  });
  await page
    .locator('.category')
    .filter({ hasText: 'Ofis & Dokümanlar' })
    .dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByRole('dialog', { name: 'Son bir göz atalım.' })).toContainText(
    'Dropped.pdf',
  );
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
});
test('archive automation is off by default, previews candidates and runs after saving consent', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Otomasyon Merkezi', exact: true }).click();
  const run = page.getByRole('button', { name: 'Etkin kuralları şimdi çalıştır' });
  await expect(run).toBeDisabled();
  await page.getByRole('button', { name: 'Kuralları önizle', exact: true }).click();
  await expect(page.locator('.preview-totals')).toContainText('1 arşiv adayı');
  await page.getByRole('checkbox', { name: 'Bekleyen dosyaları arşivle', exact: true }).check();
  await page.getByRole('button', { name: 'Kuralları kaydet', exact: true }).click();
  await settled(page);
  await run.click();
  await settled(page);
  await page.getByRole('button', { name: 'Akıllı Gruplar', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(11);
  await page.locator('main').getByRole('button', { name: 'Geri al', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
});
test('local tagging provides an explicit suggestion for an unknown download', async ({ page }) => {
  await page.getByRole('button', { name: 'Sistem Tarama', exact: true }).click();
  await page.getByRole('button', { name: 'İndirilenler', exact: true }).click();
  const card = page.locator('.item-card').filter({ hasText: 'migration_cluster.blob' });
  await expect(card.locator('.smart-suggestion')).toContainText('Veritabanı');
  await card.getByRole('button', { name: 'Öneriyi uygula', exact: true }).click();
  await settled(page);
  await expect(page.getByLabel('migration_cluster.blob hedef klasörü')).toHaveValue(
    'softwaredatabase',
  );
});
test('usage suggestions state their observation scope and allow an archive assignment', async ({
  page,
}) => {
  const steam = page.locator('.item-card').filter({ hasText: 'Steam' });
  await expect(steam.locator('.inactivity-note')).toContainText('DarkDesk');
  await steam.getByRole('button', { name: 'Arşiv kategorisini öner' }).click();
  await settled(page);
  await expect(page.getByLabel('Steam.lnk hedef klasörü')).toHaveValue('archive');
  await expect(page.locator('.item-card')).toHaveCount(12);
});
test('profile and automation screens stay within a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Çalışma Profilleri', 'Otomasyon Merkezi']) {
    await page.getByRole('button', { name, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.keyboard.press('Control+Space');
  await expect(page.locator('.launcher-panel')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('key recorder Escape cancels without closing the profile editor or changing its assignment', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Çalışma Profilleri', exact: true }).click();
  await page.getByRole('button', { name: 'Düzenle Yazılım & Kodlama', exact: true }).click();
  const modal = page.getByRole('dialog');
  const binder = modal.getByLabel('Klavye kısayolu', { exact: true });
  await binder.click();
  await expect(binder).toHaveValue('Tuş kombinasyonuna bas…');
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  await expect(binder).toHaveValue('Ctrl+Alt+1');
  await expect(modal.locator('.key-binder.recording')).toHaveCount(0);
});
