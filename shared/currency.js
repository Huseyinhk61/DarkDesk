export const currencies = new Set(
  'USD EUR TRY GBP JPY CHF CAD AUD NZD CNY INR BRL MXN SEK NOK DKK PLN CZK HUF RON BGN ISK ZAR KRW IDR MYR PHP SGD THB HKD ILS'.split(
    ' ',
  ),
);
export function normalizeCurrencyPreferences(value, language = 'tr') {
  if (value === undefined)
    return {
      target: language === 'tr' ? 'TRY' : 'USD',
      pairs: [
        ['USD', 'TRY'],
        ['EUR', 'TRY'],
        ['USD', 'EUR'],
        ['GBP', 'TRY'],
      ],
    };
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !currencies.has(value.target) ||
    !Array.isArray(value.pairs) ||
    value.pairs.length > 12
  )
    throw Error('FX_INVALID');
  const pairs = [];
  for (const pair of value.pairs) {
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      pair.some((code) => !currencies.has(code)) ||
      pair[0] === pair[1]
    )
      throw Error('FX_INVALID');
    if (!pairs.some((saved) => saved[0] === pair[0] && saved[1] === pair[1])) pairs.push([...pair]);
  }
  return { target: value.target, pairs };
}
export function parseCurrencyInput(input, target = 'TRY') {
  if (typeof input !== 'string' || input.length > 128) return null;
  const text = input
    .trim()
    .replace(/\s+karşılığı$/iu, '')
    .replace(/\btl\b/gi, 'TRY');
  const match =
    /^(?:(\d+(?:[.,]\d{1,8})?)\s*)?([a-z]{3})(?:\s+(?:(?:to|in|=)\s*)?([a-z]{3}))?$/i.exec(text);
  if (!match) return null;
  const from = match[2].toUpperCase(),
    to = (match[3] || target).toUpperCase();
  if (!currencies.has(from) || !currencies.has(to)) return null;
  const amount = match[1] === undefined ? 1 : Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount > 1e12) return null;
  return { amount, from, to };
}
export function validateRates(data, now = Date.now()) {
  if (
    !data ||
    data.base !== 'USD' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    !data.rates ||
    typeof data.rates !== 'object'
  )
    throw Error('FX_UNAVAILABLE');
  const date = Date.parse(data.date + 'T00:00:00Z');
  if (
    !Number.isFinite(date) ||
    new Date(date).toISOString().slice(0, 10) !== data.date ||
    date > now + 86400000 ||
    now - date > 7 * 86400000
  )
    throw Error('FX_UNAVAILABLE');
  const rates = { USD: 1 };
  for (const [code, value] of Object.entries(data.rates))
    if (
      code !== 'USD' &&
      currencies.has(code) &&
      Number.isFinite(value) &&
      value > 0 &&
      value < 1e12
    )
      rates[code] = value;
  if (Object.keys(rates).length < 2) throw Error('FX_UNAVAILABLE');
  return { base: 'USD', date: data.date, rates };
}
export function validCurrencyQuery(query) {
  return (
    !!query &&
    typeof query === 'object' &&
    !Array.isArray(query) &&
    currencies.has(query.from) &&
    currencies.has(query.to) &&
    Number.isFinite(query.amount) &&
    query.amount >= 0 &&
    query.amount <= 1e12
  );
}
export function convertCurrency(query, data) {
  if (!validCurrencyQuery(query)) throw Error('FX_INVALID');
  const from = data.rates[query.from],
    to = data.rates[query.to];
  if (!from || !to) throw Error('FX_UNAVAILABLE');
  const value = (query.amount * to) / from;
  if (!Number.isFinite(value)) throw Error('FX_UNAVAILABLE');
  return {
    ...query,
    value: Number(value.toPrecision(12)),
    rate: to / from,
    date: data.date,
    provider: 'Frankfurter / institutional reference rates',
  };
}
