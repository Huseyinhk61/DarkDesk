import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    reducedMotion: 'reduce',
    locale: 'en-US',
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.addInitScript(() => {
    const appearance = { language: 'en', theme: 'midnight', motion: 'reduced' };
    localStorage.setItem('darkdesk-settings', JSON.stringify(appearance));
    localStorage.setItem('darkdesk-appearance', JSON.stringify(appearance));
  });
  const page = await context.newPage();
  const capture = async (name, locator) => {
    await page.evaluate(() => document.fonts.ready);
    await locator.screenshot({
      path: fileURLToPath(new URL('../docs/assets/' + name + '-en.png', import.meta.url)),
      animations: 'disabled',
    });
    console.log('Captured ' + name + '-en.png');
  };
  await page.goto(process.env.DARKDESK_CAPTURE_URL || 'http://127.0.0.1:5173');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await capture('usage', page.locator('.item-card').filter({ hasText: 'Visual Studio Code' }));
  await page.getByRole('button', { name: 'Categories & Rules', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Software & Development', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('button', { name: 'Sunset', exact: true }).click();
  await capture('custom-colors', editor);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Quick Launcher', exact: true }).click();
  const search = page.getByRole('combobox', { name: 'Quick search' });
  await search.fill('120 * 45');
  await expect(page.getByRole('option')).toContainText('5,400');
  await search.press('Enter');
  await expect(page.locator('.launcher-notice')).toContainText('Copied: 5400');
  await capture('launcher-calculator', page.locator('.launcher-panel'));
  await search.fill('Visual Studio Code');
  await expect(page.getByRole('option')).toHaveCount(1);
  await search.press('Tab');
  await expect(page.getByRole('menu')).toBeVisible();
  await capture('launcher-actions', page.locator('.launcher-panel'));
  await context.close();
} finally {
  await browser.close();
}
