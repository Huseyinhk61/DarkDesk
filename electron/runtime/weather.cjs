const { normalizeWeather, validateWeatherResponse } = require('../../shared/weather.js');
const endpoint = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
class WeatherService {
  constructor({ fetch = globalThis.fetch, clock = () => Date.now() } = {}) {
    this.fetch = fetch;
    this.clock = clock;
    this.cache = new Map();
    this.inflight = new Map();
    this.attempts = new Map();
  }
  async quote(input) {
    const { location } = normalizeWeather({ location: input, unit: 'celsius' });
    if (!location) throw Error('WEATHER_INVALID');
    const key = location.latitude + ',' + location.longitude,
      now = this.clock(),
      saved = this.cache.get(key);
    if (saved && now >= saved.at && now - saved.at < 900000)
      return { ...saved.value, cached: false };
    if (this.inflight.has(key)) return this.inflight.get(key);
    if (this.inflight.size >= 4) throw Error('WEATHER_UNAVAILABLE');
    const last = this.attempts.get(key);
    if (last !== undefined && now >= last && now - last < 60000) {
      if (saved && now - saved.at < 3600000) return { ...saved.value, cached: true };
      throw Error('WEATHER_UNAVAILABLE');
    }
    // Bounded city caches prevent untrusted widget requests from growing memory indefinitely.
    if (this.attempts.size >= 64) {
      const oldest = this.attempts.keys().next().value;
      this.attempts.delete(oldest);
      this.cache.delete(oldest);
    }
    this.attempts.set(key, now);
    const request = (async () => {
      try {
        const response = await this.fetch(
          `${endpoint}?lat=${location.latitude}&lon=${location.longitude}`,
          {
            signal: AbortSignal.timeout(8000),
            redirect: 'error',
            headers: {
              Accept: 'application/json',
              'User-Agent': 'DarkDesk/3.12.0 https://github.com/Huseyinhk61/DarkDesk',
            },
          },
        );
        if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') || ''))
          throw Error('WEATHER_UNAVAILABLE');
        let bytes = 0;
        const reader = response.body.getReader(),
          chunks = [];
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.length;
            if (bytes > 2 * 1024 * 1024) throw Error('WEATHER_UNAVAILABLE');
            chunks.push(Buffer.from(value));
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        const value = validateWeatherResponse(
          JSON.parse(Buffer.concat(chunks).toString('utf8')),
          now,
        );
        this.cache.set(key, { at: now, value });
        return { ...value, cached: false };
      } catch {
        if (saved && now >= saved.at && now - saved.at < 3600000)
          return { ...saved.value, cached: true };
        throw Error('WEATHER_UNAVAILABLE');
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, request);
    return request;
  }
}
module.exports = { WeatherService, endpoint };
