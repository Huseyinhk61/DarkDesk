import { test, expect } from '@playwright/test';
async function openWeather(page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  const card = page
    .locator('.widget-module-card')
    .filter({ has: page.getByRole('heading', { name: 'Hava Durumu', exact: true }) });
  await card.getByRole('combobox', { name: 'Hava durumu şehri', exact: true }).selectOption('5');
  await card.getByRole('button', { name: 'Önizlemeyi aç', exact: true }).click();
  return page.locator('[data-widget=weather]');
}
test('selected city activates a connected widget, refreshes readings and keeps its controls fixed', async ({
  page,
}) => {
  const calls = [];
  await page.route('**/__darkdesk/weather', (route) => {
    const input = route.request().postDataJSON();
    calls.push(input);
    route.fulfill({
      json: {
        temperature: input.options?.refresh ? 20 : 18,
        humidity: 65,
        wind: 3,
        date: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        provider: 'MET Norway',
        category: 'clear',
        cached: false,
      },
    });
  });
  const widget = await openWeather(page);
  await expect(widget.locator('.weather-temperature strong')).toContainText('18');
  await expect(widget).toContainText('Trabzon');
  expect(calls[0].location).toMatchObject({ name: 'Trabzon', latitude: 41, longitude: 39.72 });
  const refresh = widget.getByRole('button', { name: 'Şimdi yenile', exact: true });
  await expect(refresh).toBeEnabled({ timeout: 9000 });
  await refresh.click();
  await expect(widget.locator('.weather-temperature strong')).toContainText('20');
  expect(calls.at(-1).options.refresh).toBe(true);
  const geometry = await widget.evaluate((element) => {
    const rect = element.getBoundingClientRect(),
      button = element.querySelector('.weather-refresh').getBoundingClientRect(),
      credit = element.querySelector('.weather-credit').getBoundingClientRect();
    return button.bottom <= rect.bottom && credit.bottom <= rect.bottom;
  });
  expect(geometry).toBe(true);
});
test('offline weather offers retry and recovers without losing the saved city', async ({
  page,
}) => {
  let online = false;
  await page.route('**/__darkdesk/weather', (route) =>
    online
      ? route.fulfill({
          json: {
            temperature: 22,
            humidity: 55,
            wind: 2,
            date: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            provider: 'MET Norway',
            category: 'clear',
          },
        })
      : route.fulfill({ status: 503, json: { error: 'WEATHER_UNAVAILABLE' } }),
  );
  const widget = await openWeather(page);
  await expect(widget.getByRole('alert')).toContainText('otomatik olarak yeniden denenecek');
  online = true;
  const retry = widget.getByRole('button', { name: 'Bağlantıyı yeniden dene', exact: true });
  await expect(retry).toBeEnabled({ timeout: 9000 });
  await retry.click();
  await expect(widget.locator('.weather-temperature strong')).toContainText('22');
  await expect(widget).toContainText('Trabzon');
  await expect(widget.getByRole('alert')).toHaveCount(0);
});
test('standalone weather window boots as a widget instead of the main desktop application', async ({
  page,
}) => {
  await page.setViewportSize({ width: 292, height: 320 });
  await page.addInitScript(() =>
    localStorage.setItem(
      'darkdesk-preview-widgets',
      JSON.stringify({
        note: '',
        todos: [],
        placement: 'floating',
        weather: { location: { name: 'Trabzon', latitude: 41, longitude: 39.72 }, unit: 'celsius' },
        widgets: { weather: { enabled: true, bounds: null } },
      }),
    ),
  );
  await page.route('**/__darkdesk/weather', (route) =>
    route.fulfill({
      json: {
        temperature: 17,
        humidity: 60,
        wind: 2,
        date: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        provider: 'MET Norway',
        category: 'clear',
      },
    }),
  );
  await page.goto('/#widget=weather');
  await expect(page.locator('html')).toHaveAttribute('data-window', 'widget');
  await expect(page.locator('.desktop-widget')).toHaveCount(1);
  await expect(page.locator('.weather-temperature strong')).toContainText('17');
  await expect(page.locator('aside')).toHaveCount(0);
});
