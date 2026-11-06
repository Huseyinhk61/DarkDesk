const { readCurrencyResponse } = require('../../shared/currency-response.js');
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
    this.lastFailure = false;
  }
  async rates(force = false) {
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
      !force &&
      saved &&
      Number.isFinite(saved.fetchedAt) &&
      saved.fetchedAt <= now &&
      now - saved.fetchedAt < 3600000
    )
      return { ...saved, cached: false };
    if (this.inflight) return this.inflight;
    if (
      this.lastAttempt &&
      now >= this.lastAttempt &&
      now - this.lastAttempt < (force ? 5000 : 30000)
    ) {
      if (saved) return { ...saved, cached: this.lastFailure };
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
        const value = { ...(await readCurrencyResponse(response, now)), fetchedAt: now };
        this.lastFailure = false;
        this.memory = value;
        await this.store.write(value).catch(() => {});
        return { ...value, cached: false };
      } catch {
        this.lastFailure = true;
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
    const data = await this.rates(query.refresh === true);
    return { ...convertCurrency(query, data), cached: data.cached };
  }
}
module.exports = { CurrencyService, endpoint };
