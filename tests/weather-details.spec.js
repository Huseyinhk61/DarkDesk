import { test, expect } from '@playwright/test';
async function open(page, options = {}) {
  const now = Date.now();
  const forecast = Array.from({ length: 144 }, (_, i) => ({
    date: new Date(now + i * 3600000).toISOString(),
    temperature: 18 + (i % 8),
    humidity: 65,
    wind: 3,
    gust: 7.5,
    precipitation: i % 3 === 0 ? 1.2 : 0,
    precipitationHours: 1,
    category: i % 3 === 0 ? 'rain' : 'partly',
    isDay: true,
  }));
  await page.addInitScript((options) => {
    localStorage.setItem(
      'darkdesk-settings',
      JSON.stringify({ language: 'en', ...options.settings }),
    );
    localStorage.setItem(
      'darkdesk-preview-widgets',
      JSON.stringify({
        note: '',
        todos: [],
        placement: 'floating',
        weather: {
          location: { name: 'Tokyo', latitude: 35.68, longitude: 139.69, timeZone: 'Asia/Tokyo' },
          unit: 'celsius',
        },
        widgets: { weather: { enabled: true, bounds: null } },
      }),
    );
  }, options);
  await page.route('**/__darkdesk/weather', (route) =>
    route.fulfill({
      json: {
        temperature: 18,
        feelsLike: 17.2,
        humidity: 65,
        wind: 3,
        gust: 7.5,
        windDirection: 270,
        pressure: 1015.3,
        cloudCover: 40,
        precipitation: 1.2,
        precipitationHours: 1,
        precipitationProbability: 73,
        date: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        category: 'partly',
        isDay: true,
        forecast,
        ...options.result,
      },
    }),
  );
  await page.goto('/#widget=weather');
  await expect(page.locator('.weather-temperature strong')).toContainText('18');
}
async function contentsFit(page) {
  expect(
    await page.locator('.weather-view-panel').evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [...element.querySelectorAll('article,dl,button,.weather-current-view')]
        .filter((e) => e.getClientRects().length)
        .every((e) => {
          const r = e.getBoundingClientRect();
          return r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && r.right <= box.right + 1;
        });
    }),
  ).toBe(true);
  const widget = page.locator('.desktop-widget');
  expect(
    await widget
      .locator('.weather-credit')
      .evaluate(
        (e) =>
          e.getBoundingClientRect().bottom <=
          e.closest('.desktop-widget').getBoundingClientRect().bottom,
      ),
  ).toBe(true);
}
for (const [width, height] of [
  [292, 320],
  [365, 400],
  [438, 480],
])
  test(`forecast views stay fixed and readable at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    await contentsFit(page);
    await page.getByRole('tab', { name: 'Hourly', exact: true }).click();
    await expect(page.locator('.weather-hour')).toHaveCount(4);
    await contentsFit(page);
    const first = await page.locator('.weather-hour time').first().getAttribute('datetime');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    expect(await page.locator('.weather-hour time').first().getAttribute('datetime')).not.toBe(
      first,
    );
    await page.getByRole('tab', { name: '5 days', exact: true }).click();
    await expect(page.locator('.weather-day')).toHaveCount(5);
    await contentsFit(page);
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    await expect(page.locator('.weather-details')).toContainText('1,015.3 hPa');
    await expect(page.locator('.weather-details')).toContainText('27 km/h');
    await contentsFit(page);
  });
test('forecast tabs support arrow keys and city-local settings persist without losing coordinates', async ({
  page,
}) => {
  await page.setViewportSize({ width: 292, height: 320 });
  await open(page);
  const current = page.getByRole('tab', { name: 'Now', exact: true });
  await current.focus();
  await current.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Hourly', exact: true })).toBeFocused();
  await page.getByRole('tab', { name: 'Hourly', exact: true }).press('End');
  await expect(page.getByRole('tab', { name: 'Details', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Weather settings', exact: true }).click();
  await page.getByRole('button', { name: 'Custom location', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Location time zone', exact: true })
    .selectOption('Europe/London');
  await page
    .getByRole('combobox', { name: 'Temperature unit', exact: true })
    .selectOption('fahrenheit');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Now', exact: true }).click();
  await expect(page.locator('.weather-temperature strong')).toContainText('64');
  await expect(page.locator('.weather-location-heading small')).toContainText('Europe/London');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('darkdesk-preview-widgets')).weather,
  );
  expect(saved.location).toMatchObject({
    latitude: 35.68,
    longitude: 139.69,
    timeZone: 'Europe/London',
  });
  expect(saved.unit).toBe('fahrenheit');
});
test('missing optional metrics and empty forecasts show honest empty states', async ({ page }) => {
  await page.setViewportSize({ width: 292, height: 320 });
  await open(page, {
    result: { forecast: [], pressure: null, gust: null, precipitationProbability: null },
  });
  await page.getByRole('tab', { name: 'Hourly', exact: true }).click();
  await expect(page.locator('.weather-view-empty')).toBeVisible();
  await contentsFit(page);
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await expect(page.locator('.weather-details')).toContainText('— hPa');
  await expect(page.locator('.weather-details')).not.toContainText('0 hPa');
});
test('Help copies a bounded support summary and includes the current Default Mode shortcut', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Yardım & Başlangıç', exact: true }).click();
  await page.getByRole('button', { name: 'Destek bilgilerini kopyala', exact: true }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('version: 3.13.0');
  expect(text).toContain('channel: preview');
  expect(text).not.toMatch(/Desktop|Users|token/i);
  await expect(page.locator('.help-shortcuts')).toContainText('Varsayılan Mod');
  await expect(page.locator('.support-panel')).toContainText('Destek bilgileri panoya kopyalandı.');
});

test('compact custom location editor keeps the time zone and save controls separate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 292, height: 320 });
  await open(page);
  await page.getByRole('button', { name: 'Weather settings', exact: true }).click();
  await page.getByRole('button', { name: 'Custom location', exact: true }).click();
  const zone = await page
    .getByRole('combobox', { name: 'Location time zone', exact: true })
    .boundingBox();
  const save = await page.getByRole('button', { name: 'Save settings', exact: true }).boundingBox();
  const credit = await page.locator('.weather-credit').boundingBox();
  expect(zone.y + zone.height).toBeLessThanOrEqual(save.y - 2);
  expect(save.y + save.height).toBeLessThanOrEqual(credit.y - 2);
  expect(credit.y + credit.height).toBeLessThanOrEqual(320);
});
