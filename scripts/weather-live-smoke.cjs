const fs = require('node:fs/promises');
const { WeatherService } = require('../electron/runtime/weather.cjs');
const { weatherFetch } = require('./weather-network.cjs');
(async () => {
  const location = { name: 'İstanbul', latitude: 41.01, longitude: 28.98 };
  const result = await new WeatherService({ fetch: weatherFetch }).quote(location, {
    refresh: true,
  });
  if (
    result.cached ||
    !Number.isFinite(result.temperature) ||
    !result.updatedAt ||
    result.provider !== 'MET Norway'
  )
    throw Error('Expected a fresh, real provider response');
  const report = { ...result, location, verifiedAt: new Date().toISOString(), simulated: false };
  await fs.writeFile('weather-live-report.json', JSON.stringify(report, null, 2));
  console.log(
    `PASS: live MET Norway forecast, ${location.name}, ${result.temperature} °C, forecast ${result.date}, retrieved ${result.updatedAt}`,
  );
})().catch((error) => {
  console.error('Live weather verification failed:', error.message);
  process.exitCode = 1;
});
