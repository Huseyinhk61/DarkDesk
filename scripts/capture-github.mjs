import { chromium, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Run `npm run dev` first. Captures the real English browser demo, not native
// filesystem or updater results. A fresh context keeps existing user data intact.
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
});
const baseURL = process.env.DARKDESK_CAPTURE_URL || 'http://127.0.0.1:5173';
const asset = (name) => fileURLToPath(new URL(`../docs/assets/${name}-en.png`, import.meta.url));

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    const appearance = { language: 'en', theme: 'midnight', motion: 'reduced' };
    localStorage.setItem('darkdesk-settings', JSON.stringify(appearance));
    localStorage.setItem('darkdesk-appearance', JSON.stringify(appearance));
  });
  const page = await context.newPage();
  const settled = async () => {
    await expect(page.locator('.activity-bar')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
  };
  const dismiss = async () => {
    const buttons = page.locator('.toast button[aria-label]');
    while (await buttons.count()) await buttons.first().click();
  };
  const navigate = async (name) => {
    await page.getByRole('button', { name, exact: true }).click();
    await settled();
    await dismiss();
    await page.locator('main').evaluate((main) => {
      main.scrollTop = 0;
    });
  };
  const capture = async (name, locator = page) => {
    await settled();
    await dismiss();
    await locator.screenshot({ path: asset(name), animations: 'disabled' });
    console.log(`Captured ${name}-en.png`);
  };

  await page.goto(baseURL);
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(page.getByRole('button', { name: 'Smart Groups', exact: true })).toBeVisible();
  await capture('workspace');

  await page.getByRole('button', { name: 'Organize Demo Desktop', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture('preview');
  await page.getByRole('button', { name: 'Move 12 items', exact: true }).click();
  await settled();
  await expect(page.locator('.operation-receipt')).toBeVisible();
  await page.locator('.operation-receipt summary').click();
  await capture('result');
  await page.getByRole('button', { name: 'Undo this organization', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);

  await navigate('System Scanner');
  await page.getByRole('button', { name: 'Installed apps', exact: true }).click();
  await settled();
  await page.getByRole('button', { name: 'Start deep scan', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(8);
  await capture('scanner');

  await navigate('Workspace Profiles');
  await page.locator('.profile-activate').filter({ hasText: 'Coding Workspace' }).click();
  await settled();
  await capture('profiles');

  await navigate('Quick Launcher');
  await page.getByRole('combobox', { name: 'Quick search' }).fill('code');
  await expect(page.locator('.launcher-panel').getByRole('option').first()).toContainText('Code');
  await capture('launcher');
  await page.keyboard.press('Escape');

  await navigate('Workspace Profiles');
  await page.getByRole('button', { name: 'Restore desktop visibility', exact: true }).click();
  await settled();
  await navigate('System Scanner');
  await page.getByRole('button', { name: 'Desktop', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await navigate('Automation & Settings');
  await capture('appearance', page.locator('.appearance-panel'));
  await page.getByRole('button', { name: 'Lavender Light', exact: true }).click();
  await settled();
  await dismiss();
  await navigate('Smart Groups');
  await capture('lavender');

  await context.close();
} finally {
  await browser.close();
}
