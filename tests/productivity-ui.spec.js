import { test, expect } from '@playwright/test';
import en from '../src/locales/en.json' with { type: 'json' };
async function open(page) {
  await page.addInitScript(() =>
    localStorage.setItem('darkdesk-settings', JSON.stringify({ language: 'en' })),
  );
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
}
async function instrument(page, code) {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + '\n' + code });
  });
}
test('widget preview persists immediate note navigation and task completion without fabricating system metrics', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: en['nav.widgets'], exact: true }).click();
  await expect(page.getByText(en['widgetPlus.previewHint'])).toBeVisible();
  for (const title of ['widgetPlus.system', 'widgetPlus.note', 'widgetPlus.todos'])
    await page
      .locator('.widget-module-card')
      .filter({ has: page.getByRole('heading', { name: en[title], exact: true }) })
      .getByRole('button', { name: en['widgetPlus.previewButton'] })
      .click();
  await expect(page.getByText(en['widgetPlus.metricsDesktop'])).toBeVisible();
  await expect(page.locator('.widget-metric-row strong')).toHaveText(['—', '—']);
  await page
    .getByRole('textbox', { name: en['widgetPlus.noteLabel'] })
    .fill('Keep this draft after navigation');
  await page.getByRole('button', { name: en['nav.groups'], exact: true }).click();
  await page.getByRole('button', { name: en['nav.widgets'], exact: true }).click();
  await expect(page.getByRole('textbox', { name: en['widgetPlus.noteLabel'] })).toHaveValue(
    'Keep this draft after navigation',
  );
  await page.getByRole('textbox', { name: en['widgetPlus.taskLabel'] }).fill('Review release');
  await page.getByRole('button', { name: en['widgetPlus.addTask'], exact: true }).click();
  await page.getByRole('checkbox', { name: 'Review release', exact: true }).check();
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: en['nav.widgets'], exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Review release', exact: true })).toBeChecked();
  await page
    .getByRole('button', {
      name: en['widgetPlus.removeTask'].replace('{name}', 'Review release'),
      exact: true,
    })
    .click();
  await expect(page.getByText(en['widgetPlus.emptyTodos'])).toBeVisible();
});
test('startup controls affect only editable fixture entries and refresh changed records', async ({
  page,
}) => {
  await instrument(
    page,
    `
let startupFixture={supported:true,platform:'win32',warnings:[],items:[{id:'user:editor',name:'Editor',command:'C:\\\\Apps\\\\Editor.exe',source:'user-run',enabled:true,canEdit:true},{id:'machine:helper',name:'Machine Helper',command:'C:\\\\Helper.exe',source:'machine-run',enabled:true,canEdit:false,reason:'machine-managed'}]};
api.getStartupApps=async()=>structuredClone(startupFixture);
api.setStartupAppEnabled=async(id,enabled)=>{window.__startupWrites||=[];window.__startupWrites.push({id,enabled});if(window.__startupStale)throw Error('STARTUP_CHANGED');startupFixture.items.find(item=>item.id===id).enabled=enabled;return structuredClone(startupFixture);};`,
  );
  await open(page);
  await page.getByRole('button', { name: en['nav.systemTools'], exact: true }).click();
  await expect(page.locator('.startup-row')).toHaveCount(2);
  await expect(
    page.locator('.startup-row').filter({ hasText: 'Machine Helper' }).getByRole('switch'),
  ).toHaveCount(0);
  const toggle = page.getByRole('switch', {
    name: en['startupPlus.toggle'].replace('{name}', 'Editor'),
  });
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await expect(page.getByRole('status')).toContainText('Editor is disabled');
  await page.getByRole('textbox', { name: en['startupPlus.search'] }).fill('Editor');
  await expect(page.locator('.startup-row')).toHaveCount(1);
  await page.evaluate(() => (window.__startupStale = true));
  await toggle.click();
  await expect(page.getByRole('alert')).toContainText(en['errors.STARTUP_CHANGED']);
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => window.__startupWrites)).toEqual([
    { id: 'user:editor', enabled: false },
    { id: 'user:editor', enabled: true },
  ]);
});
test('analytics keeps foreground and concurrent open time separate and requires confirmation to clear', async ({
  page,
}) => {
  await instrument(
    page,
    `
const d=new Date();const fixtureDay=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
let analyticsFixture={enabled:false,supported:true,paused:false,samplingAvailable:true,runningAvailable:true,sampleIntervalSeconds:15,retentionDays:90,days:[{date:fixtureDay,activeSeconds:1800,apps:[{id:'app:editor',name:'Editor',seconds:900,runningSeconds:1800},{id:'app:browser',name:'Browser',seconds:900,runningSeconds:1800}],profiles:[{id:'normal',seconds:1800}]}]};
api.analyticsStatus=async()=>structuredClone(analyticsFixture);
api.setAnalyticsEnabled=async enabled=>{analyticsFixture.enabled=enabled;window.__analyticsEnabled=enabled;return structuredClone(analyticsFixture);};
api.clearAnalytics=async()=>{window.__analyticsClears=(window.__analyticsClears||0)+1;analyticsFixture.days=[];return structuredClone(analyticsFixture);};`,
  );
  await open(page);
  await page.getByRole('button', { name: en['nav.analytics'], exact: true }).click();
  const consent = page.getByRole('checkbox', { name: en['analyticsPlus.enable'], exact: true });
  await expect(consent).not.toBeChecked();
  await consent.check();
  await expect(consent).toBeChecked();
  const row = page.locator('.analytics-apps tr').filter({ hasText: 'Editor' });
  await expect(row.locator('td')).toHaveText(['15 min', '30 min']);
  await expect(page.locator('.analytics-summary section').first()).toContainText('30 min');
  await page
    .getByRole('button', { name: en['analyticsPlus.days'].replace('{count}', '30'), exact: true })
    .click();
  await expect(page.locator('.analytics-chart-column')).toHaveCount(30);
  await page.getByRole('button', { name: en['analyticsPlus.clear'], exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: en['common.cancel'], exact: true }).click();
  expect(await page.evaluate(() => window.__analyticsClears || 0)).toBe(0);
  await page.getByRole('button', { name: en['analyticsPlus.clear'], exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: en['analyticsPlus.clearConfirm'], exact: true })
    .click();
  await expect(page.locator('.analytics-apps')).toContainText(en['analyticsPlus.noApps']);
  expect(await page.evaluate(() => window.__analyticsClears)).toBe(1);
});
test('unsupported preview and short desktop windows keep every destination reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await open(page);
  await page.getByRole('button', { name: en['nav.systemTools'], exact: true }).click();
  await expect(
    page.getByRole('heading', { name: en['startupPlus.demoTitle'], exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: en['nav.analytics'], exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: en['analyticsPlus.enable'], exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(en['analyticsPlus.unsupported'])).toBeVisible();
  await page.getByRole('button', { name: en['nav.help'], exact: true }).click();
  await expect(page.locator('.help-page')).toBeVisible();
  await expect(page.locator('.titlebar')).toBeInViewport();
  expect(await page.locator('main').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
});
