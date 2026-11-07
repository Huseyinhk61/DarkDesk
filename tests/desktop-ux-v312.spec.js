import { test, expect } from '@playwright/test';
async function open(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
}
async function widgets(page) {
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
}
async function enable(page, title) {
  await page
    .locator('.widget-module-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .getByRole('button', { name: 'Önizlemeyi aç', exact: true })
    .click();
}
async function mockService(page, script) {
  await page.route('**/src/service.js*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + '\n' + script });
  });
}
async function fits(locator) {
  expect(
    await locator.evaluate(
      (element) =>
        element.scrollHeight <= element.clientHeight + 1 &&
        element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
}
test('custom currency pairs and saved default target work in launcher across reload', async ({
  page,
}) => {
  await page.route('https://api.frankfurter.dev/**', (route) =>
    route.fulfill({
      json: {
        base: 'USD',
        date: new Date().toISOString().slice(0, 10),
        rates: { TRY: 40, EUR: 0.8, GBP: 0.7 },
      },
    }),
  );
  await open(page);
  await page.getByRole('button', { name: 'Döviz Çevirici', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Hızlı Başlatıcı varsayılan para birimi', exact: true })
    .selectOption('GBP');
  await page.getByRole('combobox', { name: 'Hedef para birimi', exact: true }).selectOption('GBP');
  await page.getByRole('button', { name: 'USD / GBP çiftini sabitle', exact: true }).click();
  await expect(page.locator('.saved-currency-pair').last()).toContainText('USD');
  await page.reload();
  await page.keyboard.press('Alt+x');
  const query = page.getByRole('combobox', { name: 'Hızlı arama', exact: true });
  await query.fill('1 usd');
  await expect(page.locator('.launcher-results')).toContainText('0,7 GBP');
  await query.fill('1 usd tl karşılığı');
  await expect(page.locator('.launcher-results')).toContainText('40 TRY');
  await query.fill('?');
  await expect(page.locator('.launcher-prefix-heading')).toContainText('50 eur → GBP');
});
test('notes and todos page instead of scrolling and preserve the full saved content', async ({
  page,
}) => {
  await open(page);
  await widgets(page);
  await enable(page, 'Hızlı not');
  await enable(page, 'Yapılacaklar');
  const text = 'Uzun not 😀 WWW '.repeat(200);
  await page.evaluate(async (text) => {
    const { api } = await import('/src/service.js');
    await api.saveWidgets({
      note: text,
      todos: Array.from({ length: 12 }, (_, i) => ({
        id: 't' + i,
        text: 'Görev ' + i + ' '.repeat(2) + 'a'.repeat(100),
        done: false,
      })),
    });
  }, text);
  const note = page.locator('[data-widget=note]');
  await expect(note.locator('textarea')).not.toHaveValue(text);
  await fits(note.locator('.widget-content'));
  await fits(note.locator('textarea'));
  await note.getByRole('button', { name: 'Sonraki', exact: true }).click();
  await fits(note.locator('textarea'));
  await note.locator('textarea').press('End');
  await note.locator('textarea').pressSequentially('ek');
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('darkdesk-preview-widgets')).note.length),
    )
    .toBe(text.length + 2);
  const todo = page.locator('[data-widget=todos]');
  await expect(todo.locator('li')).toHaveCount(3);
  await fits(todo.locator('.widget-content'));
  await todo.getByRole('button', { name: 'Sonraki', exact: true }).click();
  await expect(todo).toContainText('Görev 3');
  expect(await todo.locator('.widget-content').evaluate((e) => getComputedStyle(e).overflowY)).toBe(
    'hidden',
  );
});
test('weather settings and all disk pages remain fixed and editable', async ({ page }) => {
  await mockService(
    page,
    `api.weatherQuote=async()=>({temperature:18,humidity:62,wind:3,date:new Date().toISOString(),category:'rain'}); api.systemToolsSnapshot=async()=>({cpuPercent:30,cores:[30],memory:{total:1000,used:300,free:700,percent:30},disks:[{path:'C:',label:'System',total:1000,free:600,percent:40},{path:'D:',label:'Data',total:2000,free:1000,percent:50},{path:'E:',label:'Backup',total:3000,free:750,percent:75}]});`,
  );
  await open(page);
  await widgets(page);
  await enable(page, 'Hava Durumu');
  await enable(page, 'Sistem göstergesi');
  const weather = page.locator('[data-widget=weather]');
  await fits(weather.locator('.widget-content'));
  await weather.getByRole('button', { name: 'Hava durumu ayarları', exact: true }).click();
  await weather.getByRole('combobox', { name: 'Şehir seç', exact: true }).selectOption('5');
  await weather.getByRole('button', { name: 'Ayarları kaydet', exact: true }).click();
  await expect(weather).toContainText('Trabzon');
  await expect(weather).toContainText('18');
  await fits(weather.locator('.widget-content'));
  const monitor = page.locator('.system-monitor-widget');
  await monitor.getByRole('button', { name: 'Disk', exact: true }).click();
  await expect(monitor).toContainText('C:');
  await monitor.getByRole('button', { name: 'Sonraki', exact: true }).click();
  await expect(monitor).toContainText('D:');
  await expect(monitor).toContainText('50%');
  await monitor.getByRole('button', { name: 'Sonraki', exact: true }).click();
  await expect(monitor).toContainText('E:');
  await fits(page.locator('[data-widget=system] .widget-content'));
});
test('default-mode key binding can be changed and restores normal mode', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Çalışma Profilleri', exact: true }).click();
  const binder = page.getByRole('textbox', { name: 'Varsayılan Mod', exact: true });
  await binder.click();
  await binder.press('Control+Alt+9');
  await page
    .locator('.profile-shortcut-editor')
    .getByRole('button', { name: 'Ayarları kaydet', exact: true })
    .click();
  await expect(page.locator('.default-profile kbd')).toContainText('9');
  await page.getByRole('button', { name: /^Oyun Modu/ }).click();
  await expect(page.locator('.default-profile')).not.toHaveClass(/active/);
  await page.keyboard.press('Control+Alt+9');
  await expect(page.locator('.default-profile')).toHaveClass(/active/);
});
for (const [language, title] of [
  ['de', 'Einstellungen'],
  ['fr', 'Paramètres'],
  ['es', 'Configuración'],
])
  test(`beta ${language} localization persists with readable settings`, async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
    await page.getByRole('combobox', { name: 'Dil', exact: true }).selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(
      page.getByRole('combobox', {
        name: { de: 'Sprache', fr: 'Langue', es: 'Idioma' }[language],
        exact: true,
      }),
    ).toHaveValue(language);
    expect(await page.locator('main').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  });
test('every compact widget has a fixed canvas and one consistent opacity layer', async ({
  page,
}) => {
  await page.route('**/__darkdesk/weather', (route) =>
    route.fulfill({
      json: {
        temperature: 18,
        humidity: 62,
        wind: 3,
        date: new Date().toISOString(),
        category: 'rain',
        provider: 'Test',
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  await page.route('https://api.frankfurter.dev/**', (route) =>
    route.fulfill({
      json: { base: 'USD', date: new Date().toISOString().slice(0, 10), rates: { TRY: 40 } },
    }),
  );
  await open(page);
  await widgets(page);
  for (const title of [
    'Sistem göstergesi',
    'Hızlı not',
    'Yapılacaklar',
    'Döviz çevirici',
    'Saat & tarih',
    'Odak sayacı',
    'Hava Durumu',
  ])
    await enable(page, title);
  for (const widget of await page.locator('.desktop-widget').all()) {
    await fits(widget.locator('.widget-content'));
    const result = await widget
      .locator('.widget-content')
      .evaluate((element) =>
        [
          ...element.querySelectorAll(
            'textarea,input:not([type=checkbox]):not([type=range]),select,.monitor-stat,.currency-quote-panel,.currency-result',
          ),
        ].every((child) => getComputedStyle(child).backgroundColor === 'rgba(0, 0, 0, 0)'),
      );
    expect(result).toBe(true);
  }
  const focus = page.locator('.focus-widget');
  await focus.locator('summary').click();
  await fits(page.locator('[data-widget=focus] .widget-content'));
  await focus.getByRole('button', { name: 'Süre bitiminde zil', exact: true }).click();
  await fits(page.locator('[data-widget=focus] .widget-content'));
  await page.getByRole('slider', { name: 'Hava Durumu opaklığı', exact: true }).fill('35');
  await expect
    .poll(() =>
      page
        .locator('[data-widget=weather]')
        .evaluate((e) => e.style.getPropertyValue('--widget-opacity')),
    )
    .toBe('35%');
  await page.screenshot({ path: '/tmp/darkdesk312-widgets.png', fullPage: true });
});
test('wide Unicode notes and tabs remain readable on fixed pages', async ({ page }) => {
  await open(page);
  await widgets(page);
  await enable(page, 'Hızlı not');
  const note = page.locator('[data-widget=note]');
  for (const text of ['😀'.repeat(200), '漢字'.repeat(200), '\tWWW\t😀\n'.repeat(90)]) {
    await page.evaluate(async (text) => {
      const { api } = await import('/src/service.js');
      await api.saveWidgets({ note: text });
    }, text);
    for (let i = 0; i < 3; i++) {
      await fits(note.locator('textarea'));
      const next = note.getByRole('button', { name: 'Sonraki', exact: true });
      if (await next.isDisabled()) break;
      await next.click();
    }
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('darkdesk-preview-widgets')).note),
    ).toBe(text);
  }
});
test('Store edition exposes Store updates and never offers an external installer', async ({
  page,
}) => {
  await mockService(
    page,
    `api.updateStatus=async()=>({state:'unsupported',reason:'store',currentVersion:'3.12.0'});api.openStoreUpdates=async()=>{window.__storeOpened=true};`,
  );
  await open(page);
  await page.getByRole('button', { name: 'Otomasyon & Ayarlar', exact: true }).click();
  await expect(page.locator('#updates')).toContainText('Microsoft Store tarafından yönetilir');
  await expect(page.locator('#updates .update-manual')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Microsoft Store güncellemelerini aç', exact: true })
    .click();
  expect(await page.evaluate(() => window.__storeOpened)).toBe(true);
});
