import { test, expect } from '@playwright/test';

test('an obsolete launcher refresh failure cannot replace a newer successful view', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const originalRefreshEntries = api.launcherEntries;
api.launcherEntries = async () => {
  if (window.__holdLauncherRefresh) {
    window.__holdLauncherRefresh = false;
    return new Promise((_resolve, reject) => {
      window.__rejectOldLauncherRefresh = () => reject(Error('obsolete launcher refresh failure'));
    });
  }
  return originalRefreshEntries();
};
api.onLauncherShown = (listener) => {
  window.__showLauncherAgain = listener;
  return () => {
    if (window.__showLauncherAgain === listener) delete window.__showLauncherAgain;
  };
};
`,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  const search = page.getByRole('combobox', { name: 'Hızlı arama' });
  await expect(search).toBeVisible();
  await expect(page.locator('.launcher-search .spin')).toHaveCount(0);

  await page.evaluate(() => {
    window.__holdLauncherRefresh = true;
    window.__showLauncherAgain();
  });
  await expect(page.locator('.launcher-search .spin')).toHaveCount(1);
  await page.evaluate(() => window.__showLauncherAgain());
  await expect(page.locator('.launcher-search .spin')).toHaveCount(0);
  await search.fill('Visual Studio Code');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.evaluate(async () => {
    window.__rejectOldLauncherRefresh();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(page.locator('.launcher-error')).toHaveCount(0);
  await expect(search).toHaveValue('Visual Studio Code');
  await expect(page.getByRole('option')).toContainText('Visual Studio Code');
});

test('a completed launch from a closed palette cannot close its replacement', async ({ page }) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
api.launch = async () => new Promise((resolve) => { window.__completeOldLaunch = resolve; });
`,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  const trigger = page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true });
  await trigger.click();
  const search = page.getByRole('combobox', { name: 'Hızlı arama' });
  await search.fill('Visual Studio Code');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toBeEnabled();
  await search.press('Enter');
  await expect(page.locator('.launcher-search .spin')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.launcher-panel')).toHaveCount(0);
  await trigger.click();
  await search.fill('Figma');
  await expect(page.getByRole('option').first()).toContainText('Figma');
  await page.evaluate(async () => {
    window.__completeOldLaunch();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(page.locator('.launcher-panel')).toBeVisible();
  await expect(search).toHaveValue('Figma');
});

test('showing the native palette again discards an earlier pending confirmation', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const originalReopenEntries = api.launcherEntries;
api.launcherEntries = async () => ({
  ...await originalReopenEntries(),
  capabilities: {system:['shutdown'],copy:true,web:true,reveal:false,admin:false},
});
api.onLauncherShown = (listener) => {
  window.__showLauncherAgain = listener;
  return () => { if(window.__showLauncherAgain === listener) delete window.__showLauncherAgain; };
};
api.launcherAction = async (input) => {
  if(input.type === 'prepare-system') return new Promise((resolve) => {
    window.__completeOldPreparation = () => resolve({id:'shutdown',token:'fixture-only',expiresAt:Date.now()+30000});
  });
  throw Error('Unexpected fixture action');
};
`,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  const search = page.getByRole('combobox', { name: 'Hızlı arama' });
  await search.fill('Sistemi Kapat');
  await expect(page.getByRole('option').first()).toBeEnabled();
  await search.press('Enter');
  await expect(page.locator('.launcher-search .spin')).toHaveCount(1);
  await page.evaluate(() => window.__showLauncherAgain());
  await search.fill('Figma');
  await expect(page.getByRole('option').first()).toContainText('Figma');
  await page.evaluate(async () => {
    window.__completeOldPreparation();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(search).toHaveValue('Figma');
  await expect(page.getByRole('option').first()).toBeEnabled();
});

test('Escape cannot imply cancellation after a system command was confirmed and dispatched', async ({
  page,
}) => {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        `
const originalConfirmedEntries = api.launcherEntries;
api.launcherEntries = async () => ({
  ...await originalConfirmedEntries(),
  capabilities: {system:['shutdown'],copy:true,web:true,reveal:false,admin:false},
});
api.launcherAction = async (input) => {
  if(input.type === 'prepare-system') return {id:'shutdown',token:'fixture-only',expiresAt:Date.now()+30000};
  if(input.type === 'confirm-system') return new Promise((resolve) => {
    window.__completeConfirmedSystemAction = () => resolve({type:'system',id:'shutdown',requested:true});
  });
  throw Error('Unexpected fixture action');
};
`,
    });
  });
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Hızlı Başlatıcı', exact: true }).click();
  const search = page.getByRole('combobox', { name: 'Hızlı arama' });
  await search.fill('Sistemi Kapat');
  await expect(page.getByRole('option').first()).toBeEnabled();
  await search.press('Enter');
  const confirmation = page.getByRole('alertdialog');
  await confirmation.getByRole('button', { name: 'Onayla ve uygula' }).click();
  await expect(confirmation.getByRole('button', { name: 'Vazgeç', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(confirmation).toBeVisible();
  await page.evaluate(() => window.__completeConfirmedSystemAction());
  await expect(page.locator('.launcher-panel')).toHaveCount(0);
});
