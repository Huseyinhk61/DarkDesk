const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { parseCurrencyInput, validateRates, convertCurrency } = require('../shared/currency.js');
const { CurrencyService, endpoint } = require('./runtime/currency.cjs');
const { defaultSettings, classify } = require('../shared/domain.js');
const { validateSettings } = require('../shared/validate.js');
test('currency parsing keeps units separate and computes cross rates without arithmetic execution', () => {
  assert.deepEqual(parseCurrencyInput('50 USD to TRY'), { amount: 50, from: 'USD', to: 'TRY' });
  assert.deepEqual(parseCurrencyInput('100 EUR'), { amount: 100, from: 'EUR', to: 'TRY' });
  assert.deepEqual(parseCurrencyInput('USD to TRY'), { amount: 1, from: 'USD', to: 'TRY' });
  assert.deepEqual(parseCurrencyInput('EUR'), { amount: 1, from: 'EUR', to: 'TRY' });
  assert.deepEqual(parseCurrencyInput('eur in usd'), { amount: 1, from: 'EUR', to: 'USD' });
  for (const input of ['to TRY', '-1 USD', 'USD to', '1e3 USD', 'EUR extra'])
    assert.equal(parseCurrencyInput(input), null, input);
  assert.equal(parseCurrencyInput('10 km to m'), null);
  assert.equal(parseCurrencyInput('2 XYZ to TRY'), null);
  assert.equal(parseCurrencyInput('Infinity USD'), null);
  const rates = validateRates(
    { base: 'USD', date: '2026-11-06', rates: { EUR: 0.8, TRY: 40 } },
    Date.parse('2026-11-06T12:00Z'),
  );
  assert.equal(convertCurrency({ amount: 100, from: 'EUR', to: 'TRY' }, rates).value, 5000);
  assert.throws(
    () => validateRates({ ...rates, date: '2020-01-01' }, Date.parse('2026-11-06')),
    /FX_UNAVAILABLE/,
  );
});
test('fixed-endpoint FX fetch deduplicates requests, survives restart offline, and refuses expired cache', async (t) => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-fx-'));
  t.after(() => fs.rm(data, { recursive: true, force: true }));
  let now = Date.parse('2026-11-06T12:00Z'),
    calls = 0;
  const service = new CurrencyService({
    data,
    clock: () => now,
    fetch: async (url) => {
      assert.equal(url, endpoint);
      calls++;
      return new Response(
        JSON.stringify({ base: 'USD', date: '2026-11-06', rates: { EUR: 0.8, TRY: 40 } }),
      );
    },
  });
  const query = { amount: 50, from: 'USD', to: 'TRY' };
  assert.deepEqual(
    (await Promise.all([service.quote(query), service.quote(query)])).map((r) => r.value),
    [2000, 2000],
  );
  assert.equal(calls, 1);
  now += 7200000;
  const offline = new CurrencyService({
    data,
    clock: () => now,
    fetch: async () => {
      throw Error('offline');
    },
  });
  assert.equal((await offline.quote(query)).cached, true);
  now += 8 * 86400000;
  await assert.rejects(offline.quote(query), /FX_UNAVAILABLE/);
  await assert.rejects(offline.quote({ from: 'oops' }), /FX_INVALID/);
});
test('AI migration is one-time, preserves custom groups and respects manual routing', () => {
  const old = structuredClone(defaultSettings);
  old.schemaVersion = 4;
  old.categories = old.categories.filter((c) => !c.id.startsWith('ai'));
  const settings = validateSettings(old);
  assert.ok(settings.categories.some((c) => c.id === 'ai'));
  for (const name of [
    'Claude.lnk',
    'ChatGPT.exe',
    'Cursor.exe',
    'Ollama.exe',
    'LM Studio.lnk',
    'ComfyUI.exe',
  ])
    assert.ok(classify({ name }, settings).startsWith('ai'), name);
  settings.overrides['Cursor.exe'] = 'software';
  assert.equal(classify({ id: 'Cursor.exe', name: 'Cursor.exe' }, settings), 'software');
  settings.categories = settings.categories.filter((c) => !c.id.startsWith('ai'));
  assert.ok(!validateSettings(settings).categories.some((c) => c.id === 'ai'));
  const pinned = validateSettings({
    ...settings,
    launcherCommandFavorites: ['command:show', 'system:lock', 'malicious:run'],
  });
  assert.deepEqual(pinned.launcherCommandFavorites, ['command:show', 'system:lock']);
});
test('manual currency refresh fetches newer data and oversized responses never become rates', async (t) => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-fx-refresh-'));
  t.after(() => fs.rm(data, { recursive: true, force: true }));
  let now = Date.parse('2026-11-06T12:00Z'),
    calls = 0;
  const service = new CurrencyService({
    data,
    clock: () => now,
    fetch: async () =>
      new Response(
        JSON.stringify({
          base: 'USD',
          date: '2026-11-06',
          rates: { TRY: ++calls === 1 ? 40 : 41 },
        }),
      ),
  });
  const query = { amount: 50, from: 'USD', to: 'TRY' };
  assert.equal((await service.quote(query)).value, 2000);
  assert.equal((await service.quote({ ...query, refresh: true })).cached, false);
  now += 6000;
  assert.equal((await service.quote({ ...query, refresh: true })).value, 2050);
  assert.equal(calls, 2);
  const { readCurrencyResponse } = require('../shared/currency-response.js');
  await assert.rejects(readCurrencyResponse(new Response('x'.repeat(131073))), /FX_UNAVAILABLE/);
  assert.throws(
    () => validateRates({ base: 'USD', date: '2026-11-06', rates: {} }, now),
    /FX_UNAVAILABLE/,
  );
});
