const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { WeatherService } = require('./runtime/weather.cjs');
const { validateWeatherResponse } = require('../shared/weather.js');
const { weatherMiddleware } = require('../scripts/weather-preview.cjs');
const location = { name: 'İstanbul', latitude: 41.01, longitude: 28.98 };
const forecast = (now, temperature = 18) => ({
  properties: {
    timeseries: [
      {
        time: new Date(now).toISOString(),
        data: {
          instant: {
            details: { air_temperature: temperature, relative_humidity: 55, wind_speed: 2 },
          },
          next_1_hours: { summary: { symbol_code: 'clearsky_day' } },
        },
      },
    ],
  },
});
test('manual weather refresh retrieves new real responses after its cooldown and timestamps the reading', async () => {
  let now = Date.now(),
    calls = 0;
  const service = new WeatherService({
    clock: () => now,
    fetch: async () => Response.json(forecast(now, ++calls)),
  });
  const first = await service.quote(location);
  assert.equal(first.temperature, 1);
  assert.equal(first.updatedAt, new Date(now).toISOString());
  now += 1000;
  await service.quote(location, { refresh: true });
  assert.equal(calls, 1);
  now += 5000;
  const next = await service.quote(location, { refresh: true });
  assert.equal(calls, 2);
  assert.equal(next.temperature, 2);
  assert.equal((await service.quote(location)).temperature, 2);
});
test('weather honors provider Retry-After across locations and labels a bounded offline cache', async () => {
  let now = Date.now(),
    calls = 0,
    fail = false;
  const service = new WeatherService({
    clock: () => now,
    fetch: async () => {
      calls++;
      return fail
        ? new Response('', { status: 429, headers: { 'retry-after': '120' } })
        : Response.json(forecast(now));
    },
  });
  await service.quote(location);
  now += 900001;
  fail = true;
  assert.equal((await service.quote(location)).cached, true);
  assert.equal(calls, 2);
  await assert.rejects(
    service.quote({ ...location, latitude: 42 }, { refresh: true }),
    /WEATHER_UNAVAILABLE/,
  );
  assert.equal(calls, 2);
  now += 120001;
  await service.quote(location, { refresh: true });
  assert.equal(calls, 3);
  now += 3600001;
  await assert.rejects(service.quote(location), /WEATHER_UNAVAILABLE/);
});
test('forecast selection uses the closest timestamp, and malformed or stale forecasts fail explicitly', () => {
  const now = Date.now(),
    data = forecast(now - 2 * 3600000, 5);
  data.properties.timeseries.push(...forecast(now, 20).properties.timeseries);
  assert.equal(validateWeatherResponse(data, now).temperature, 20);
  for (const data of [
    { properties: { timeseries: {} } },
    forecast(now - 10 * 3600000),
    forecast(now + 4 * 3600000),
  ])
    assert.throws(() => validateWeatherResponse(data, now), /WEATHER_UNAVAILABLE/);
});
async function preview(t, service) {
  const middleware = weatherMiddleware(service),
    server = http.createServer((req, res) =>
      middleware(req, res, () => {
        res.statusCode = 404;
        res.end();
      }),
    );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/__darkdesk/weather`;
}
test('preview weather endpoint uses the same identified native provider and preserves refresh semantics', async (t) => {
  const calls = [];
  const url = await preview(t, {
    quote: async (...args) => {
      calls.push(args);
      return { temperature: 19, provider: 'MET Norway' };
    },
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ location, options: { refresh: true } }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).temperature, 19);
  assert.deepEqual(calls, [[location, { refresh: true }]]);
});
test('preview weather rejects cross-origin, oversized and malformed requests without reaching a provider', async (t) => {
  let calls = 0;
  const url = await preview(t, {
    quote: async () => {
      calls++;
    },
  });
  for (const [options, status] of [
    [{ method: 'GET' }, 405],
    [{ method: 'POST', headers: { origin: 'https://untrusted.invalid' }, body: '{}' }, 403],
    [{ method: 'POST', body: 'x'.repeat(1025) }, 413],
    [{ method: 'POST', body: '{broken' }, 400],
  ]) {
    const response = await fetch(url, options);
    assert.equal(response.status, status);
    await response.text();
  }
  assert.equal(calls, 0);
});
