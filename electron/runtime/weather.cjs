const { normalizeWeather, validateWeatherResponse } = require('../../shared/weather.js');
const { version } = require('../../package.json');
const endpoint = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
class WeatherService {
  constructor({ fetch = globalThis.fetch, clock = () => Date.now() } = {}) {
    this.fetch = fetch;
    this.clock = clock;
    this.cache = new Map();
    this.inflight = new Map();
    this.attempts = new Map();
    this.providerRetryAt = 0;
  }
  async quote(input, options = {}) {
    const { location } = normalizeWeather({ location: input, unit: 'celsius' });
    if (
      !location ||
      !options ||
      typeof options !== 'object' ||
      Array.isArray(options) ||
      ('refresh' in options && typeof options.refresh !== 'boolean')
    )
      throw Error('WEATHER_INVALID');
    const key = location.latitude + ',' + location.longitude,
      now = this.clock(),
      saved = this.cache.get(key);
    const decorate = (record, cached) => ({
      ...record.value,
      cached,
      updatedAt: new Date(record.at).toISOString(),
    });
    const fallback = () => {
      if (saved && now >= saved.at && now - saved.at < 3600000) return decorate(saved, true);
      throw Error('WEATHER_UNAVAILABLE');
    };
    if (!options.refresh && saved && now >= saved.at && now - saved.at < 900000)
      return decorate(saved, false);
    if (this.inflight.has(key)) return this.inflight.get(key);
    if (this.inflight.size >= 4 || now < this.providerRetryAt) return fallback();
    const last = this.attempts.get(key);
    if (last !== undefined && now >= last && now - last < (options.refresh ? 5000 : 60000))
      return fallback();
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
              'User-Agent': `DarkDesk/${version} https://github.com/Huseyinhk61/DarkDesk`,
            },
          },
        );
        if (response.status === 429 || response.status === 503) {
          const retry = response.headers.get('retry-after');
          const delay = /^\d+$/.test(retry || '') ? Number(retry) * 1000 : Date.parse(retry) - now;
          this.providerRetryAt =
            now + Math.max(60000, Math.min(3600000, Number.isFinite(delay) ? delay : 60000));
        }
        if (
          !response.ok ||
          !/application\/json/i.test(response.headers.get('content-type') || '') ||
          Number(response.headers.get('content-length') || 0) > 2 * 1024 * 1024
        )
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
          ),
          record = { at: now, value };
        this.cache.set(key, record);
        return decorate(record, false);
      } catch {
        return fallback();
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, request);
    return request;
  }
}
module.exports = { WeatherService, endpoint };
