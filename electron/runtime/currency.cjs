const path = require('node:path');
const { JsonStore } = require('./json-store.cjs');
const { validateRates, convertCurrency, validCurrencyQuery } = require('../../shared/currency.js');
const endpoint = 'https://api.frankfurter.dev/v1/latest?base=USD';
class CurrencyService {
  constructor({ data, fetch: request = globalThis.fetch, clock = () => Date.now() } = {}) {
    this.store = new JsonStore(path.join(data, 'fx-rates.json'), {});
    this.request = request;
    this.clock = clock;
    this.inflight = null;
    this.memory = null;
    this.lastAttempt = 0;
  }
  async rates() {
    const now = this.clock();
    let saved = this.memory;
    if (!saved)
      try {
        const record = await this.store.read();
        saved = { ...validateRates(record, now), fetchedAt: record.fetchedAt };
      } catch {}
    if (saved)
      try {
        validateRates(saved, now);
      } catch {
        saved = null;
      }
    if (
      saved &&
      Number.isFinite(saved.fetchedAt) &&
      saved.fetchedAt <= now &&
      now - saved.fetchedAt < 3600000
    )
      return { ...saved, cached: false };
    if (this.inflight) return this.inflight;
    if (this.lastAttempt && now - this.lastAttempt < 30000) {
      if (saved) return { ...saved, cached: true };
      throw Error('FX_UNAVAILABLE');
    }
    this.lastAttempt = now;
    this.inflight = (async () => {
      try {
        const response = await this.request(endpoint, {
          signal: AbortSignal.timeout(7000),
          redirect: 'error',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw Error('FX_UNAVAILABLE');
        let text = '';
        let size = 0;
        const decoder = new TextDecoder();
        for await (const chunk of response.body) {
          size += chunk.byteLength;
          if (size > 131072) throw Error('FX_UNAVAILABLE');
          text += decoder.decode(chunk, { stream: true });
        }
        text += decoder.decode();
        const value = { ...validateRates(JSON.parse(text), now), fetchedAt: now };
        this.memory = value;
        await this.store.write(value).catch(() => {});
        return { ...value, cached: false };
      } catch {
        if (saved) return { ...saved, cached: true };
        throw Error('FX_UNAVAILABLE');
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }
  async quote(query) {
    if (!validCurrencyQuery(query)) throw Error('FX_INVALID');
    const data = await this.rates();
    return { ...convertCurrency(query, data), cached: data.cached };
  }
}
module.exports = { CurrencyService, endpoint };
