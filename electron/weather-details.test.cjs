const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeWeather,
  weatherTimeZone,
  weatherCities,
  validateWeatherResponse,
  dailyWeatherForecast,
  feelsLikeEstimate,
} = require('../shared/weather.js');
const { supportInfo, formatSupportInfo, supportLinks } = require('../shared/support.js');
const { installEnvironment } = require('../scripts/install-electron.cjs');
function row(
  time,
  temp = 18,
  extra = {},
  period = { precipitation_amount: 0, probability_of_precipitation: 45 },
) {
  return {
    time: new Date(time).toISOString(),
    data: {
      instant: {
        details: { air_temperature: temp, relative_humidity: 65, wind_speed: 3, ...extra },
      },
      next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: period },
    },
  };
}
test('extended weather preserves real zero values, optional missing data and provider forecast intervals', () => {
  const now = Date.now(),
    result = validateWeatherResponse(
      {
        properties: {
          meta: { updated_at: new Date(now - 1000).toISOString() },
          timeseries: [
            row(now, 18, {
              wind_from_direction: 270,
              wind_speed_of_gust: 0,
              air_pressure_at_sea_level: 1012,
              cloud_area_fraction: 0,
            }),
          ],
        },
      },
      now,
    );
  assert.equal(result.category, 'partly');
  assert.equal(result.precipitation, 0);
  assert.equal(result.precipitationHours, 1);
  assert.equal(result.gust, 0);
  assert.equal(result.cloudCover, 0);
  assert.equal(result.pressure, 1012);
  assert.equal(result.windDirection, 270);
  assert.equal(result.precipitationProbability, 45);
  const missing = validateWeatherResponse(
    { properties: { timeseries: [row(now, 18, {}, {})] } },
    now,
  );
  assert.equal(missing.precipitation, null);
  const noSymbol = row(now);
  delete noSymbol.data.next_1_hours;
  assert.equal(
    validateWeatherResponse({ properties: { timeseries: [noSymbol] } }, now).category,
    'unknown',
  );
  assert.equal(missing.gust, null);
  assert.equal(missing.pressure, null);
});
test('forecasts are sorted, deduplicated, bounded, and exclude invalid temperatures without inventing samples', () => {
  const now = Date.now();
  const samples = [
    row(now + 3600000, 20),
    row(now, 18),
    row(now, 19),
    row(now + 2 * 3600000, Infinity),
    row(now + 7 * 86400000, 23),
  ];
  const result = validateWeatherResponse({ properties: { timeseries: samples } }, now);
  assert.equal(result.forecast.length, 2);
  assert.equal(result.forecast[0].temperature, 19);
  assert.equal(result.forecast[1].temperature, 20);
  assert.throws(
    () =>
      validateWeatherResponse(
        { properties: { timeseries: [row(now, 18, { wind_speed: 500 })] } },
        now,
      ),
    /WEATHER_UNAVAILABLE/,
  );
});
test('city time zones migrate without changing legacy saved locations and invalid custom zones are rejected', () => {
  const location = { name: 'Tokyo', latitude: 35.68, longitude: 139.69 };
  assert.equal(weatherTimeZone(location), 'Asia/Tokyo');
  assert.deepEqual(normalizeWeather({ location, unit: 'celsius' }).location, location);
  assert.equal(
    normalizeWeather({ location: { ...location, timeZone: 'Europe/London' }, unit: 'fahrenheit' })
      .location.timeZone,
    'Europe/London',
  );
  assert.throws(
    () =>
      normalizeWeather({
        location: { ...location, timeZone: 'Invalid/TimeZone' },
        unit: 'celsius',
      }),
    /WEATHER_INVALID/,
  );
  assert.ok(weatherCities.every((city) => city.timeZone));
});
test('daily ranges follow city-local days, handle DST repetitions and never fill absent days', () => {
  const now = Date.parse('2026-11-01T05:00:00Z');
  const samples = [
    { date: '2026-11-01T05:30:00Z', temperature: 10, category: 'clear' },
    { date: '2026-11-01T06:30:00Z', temperature: 12, category: 'rain' },
  ];
  const days = dailyWeatherForecast(samples, 'America/New_York', now);
  assert.equal(days.length, 1);
  assert.equal(days[0].samples, 2);
  assert.equal(days[0].minimum, 10);
  assert.equal(days[0].maximum, 12);
  assert.equal(days[0].partial, true);
  const tokyo = dailyWeatherForecast(
    [{ date: '2026-01-31T23:00:00Z', temperature: 4, category: 'clear' }],
    'Asia/Tokyo',
    Date.parse('2026-01-31T22:30:00Z'),
  );
  assert.equal(tokyo[0].day, '2026-02-01');
  assert.deepEqual(dailyWeatherForecast([], 'UTC', now), []);
});
test('six-hour precipitation is shown as its real interval and feels-like estimates respect their regimes', () => {
  const now = Date.now(),
    sample = row(now);
  sample.data.next_6_hours = {
    summary: { symbol_code: 'rain' },
    details: { precipitation_amount: 5 },
  };
  delete sample.data.next_1_hours;
  const result = validateWeatherResponse({ properties: { timeseries: [sample] } }, now);
  assert.equal(result.precipitation, 5);
  assert.equal(result.precipitationHours, 6);
  assert.equal(result.precipitationProbability, null);
  assert.ok(feelsLikeEstimate(0, 60, 8) < 0);
  assert.ok(feelsLikeEstimate(34, 80, 2) > 34);
  assert.equal(feelsLikeEstimate(18, 60, 3), 18);
  assert.equal(feelsLikeEstimate(null, 60, 3), null);
});
test('support information includes only its published fields and links are a fixed HTTPS allowlist', () => {
  const value = supportInfo({
    version: '3.13.0',
    platform: 'win32',
    architecture: 'x64',
    channel: 'store',
    language: 'tr',
    theme: 'midnight',
    desktop: 'C:\\Private\\Desktop',
    token: 'secret',
  });
  assert.equal(value.channel, 'store');
  assert.equal(Object.keys(value).length, 6);
  const text = formatSupportInfo(value);
  assert.ok(!text.includes('Private'));
  assert.ok(!text.includes('secret'));
  assert.ok(text.includes('3.13.0'));
  assert.equal(supportInfo({ version: 'bad\nvalue' }).version, 'unknown');
  assert.ok(Object.values(supportLinks).every((link) => new URL(link).protocol === 'https:'));
  assert.equal(Object.hasOwn(supportLinks, '__proto__'), false);
});
test('source installation retains configured proxy and CA settings while enabling Node environment proxy support', () => {
  const original = {
    HTTPS_PROXY: 'http://proxy.invalid:8080',
    NO_PROXY: 'localhost,127.0.0.1',
    NODE_EXTRA_CA_CERTS: '/test/ca.pem',
  };
  const next = installEnvironment(original);
  assert.equal(next.HTTPS_PROXY, original.HTTPS_PROXY);
  assert.equal(next.NO_PROXY, original.NO_PROXY);
  assert.equal(next.NODE_EXTRA_CA_CERTS, original.NODE_EXTRA_CA_CERTS);
  assert.equal(next.NODE_USE_ENV_PROXY, '1');
  assert.equal(original.NODE_USE_ENV_PROXY, undefined);
  assert.equal(installEnvironment({}).NODE_USE_ENV_PROXY, undefined);
});
