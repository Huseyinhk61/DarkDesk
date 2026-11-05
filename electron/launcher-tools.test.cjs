const { test } = require('node:test');
const assert = require('node:assert/strict');
const { launcherTool, buildWebSearch } = require('../shared/launcher-tools.js');

test('calculator handles precedence, parentheses, unary signs, powers and decimal arithmetic locally', () => {
  for (const [expression, expected] of [
    ['120 * 45', 5400],
    ['2 + 3 * 4', 14],
    ['(2 + 3) * 4', 20],
    ['2^3^2', 512],
    ['2**3', 8],
    ['-2^2', -4],
    ['(-2)^2', 4],
    ['2^-2', 0.25],
    ['10 % 3', 1],
    ['0.1 + 0.2', 0.3],
    ['1,5 × 4', 6],
    ['20 ÷ 4 − 1', 4],
    ['1e3 + .5', 1000.5],
    ['= +5', 5],
    ['-0', 0],
  ]) {
    const result = launcherTool(expression);
    assert.equal(result.type, 'calculation', expression);
    assert.equal(result.status, 'success', expression);
    assert.equal(result.value, expected, expression);
    assert.ok(result.copyText.length > 0);
  }
  assert.equal(launcherTool('120 * 45', 'en-US').displayValue, '5,400');
  assert.equal(launcherTool('120 * 45', 'tr-TR').displayValue, '5.400');
  assert.equal(launcherTool('120 * 45', 'tr-TR').copyText, '5400');
});

test('calculator rejects nonfinite results and malformed or excessive expressions without evaluation', () => {
  for (const [expression, code] of [
    ['1/0', 'DIVISION_BY_ZERO'],
    ['1%0', 'DIVISION_BY_ZERO'],
    ['10^9999', 'RESULT_OUT_OF_RANGE'],
    ['(-1)^0.5', 'RESULT_OUT_OF_RANGE'],
    ['1e9999', 'RESULT_OUT_OF_RANGE'],
    ['1..2', 'INVALID_EXPRESSION'],
    ['2(3)', 'INVALID_EXPRESSION'],
    ['1+)', 'INVALID_EXPRESSION'],
    ['=globalThis.process.exit()', 'INVALID_EXPRESSION'],
    ['=' + '('.repeat(40) + '1' + ')'.repeat(40), 'EXPRESSION_TOO_COMPLEX'],
    ['1+'.repeat(200) + '1', 'EXPRESSION_TOO_COMPLEX'],
    ['1'.repeat(513), 'INPUT_TOO_LONG'],
  ]) {
    assert.equal(launcherTool(expression).status, 'error', expression);
    assert.equal(launcherTool(expression).error, code, expression);
  }
  for (const expression of ['1 +', '(1+2', '= ', '1e-']) {
    assert.equal(launcherTool(expression).status, 'incomplete', expression);
    assert.equal(launcherTool(expression).copyText, undefined);
  }
  for (const name of [
    '',
    'Visual Studio Code',
    '7-Zip',
    '3DMark',
    'report2026.pdf',
    'process.exit()',
    null,
  ])
    assert.equal(launcherTool(name), null, String(name));
});

test('converter supports explicit length, mass, time, data and temperature dimensions', () => {
  for (const [expression, expected, target] of [
    ['10km to m', 10000, 'm'],
    ['2,5 metre kaç cm', 250, 'cm'],
    ['12 in to cm', 30.48, 'cm'],
    ['1 mi in km', 1.609344, 'km'],
    ['2 kg = g', 2000, 'g'],
    ['1 lb -> kg', 0.45359237, 'kg'],
    ['1 saat to dakika', 60, 'min'],
    ['2 gün kaç saat', 48, 'h'],
    ['1 GB to MB', 1000, 'MB'],
    ['1 GiB to MiB', 1024, 'MiB'],
    ['8 bit to B', 1, 'B'],
    ['32 F to C', 0, '°C'],
    ['100 C to F', 212, '°F'],
    ['273.15 K to C', 0, '°C'],
  ]) {
    const result = launcherTool(expression);
    assert.equal(result?.type, 'conversion', expression);
    assert.equal(result.status, 'success', expression);
    assert.equal(result.value, expected, expression);
    assert.equal(result.toUnit, target, expression);
    assert.equal(result.copyText, expected + ' ' + target, expression);
  }
});

test('converter distinguishes unsupported, incomplete and incompatible requests', () => {
  for (const [expression, code] of [
    ['10 km to kg', 'INCOMPATIBLE_UNITS'],
    ['10 usd to eur', 'UNSUPPORTED_UNIT'],
    ['10 kg to process.exit()', 'UNSUPPORTED_UNIT'],
    ['-300 C to K', 'RESULT_OUT_OF_RANGE'],
    ['1e999 kg to g', 'RESULT_OUT_OF_RANGE'],
  ])
    assert.equal(launcherTool(expression).error, code, expression);
  for (const expression of ['10 km to', '10 km =', '10 m kaç', '32 F ->']) {
    assert.equal(launcherTool(expression).status, 'incomplete', expression);
    assert.equal(launcherTool(expression).copyText, undefined);
  }
});

test('web prefixes build only encoded fixed-domain HTTPS searches and never open a supplied URL', () => {
  for (const [prefix, provider, host, parameter] of [
    ['g', 'google', 'www.google.com', 'q'],
    ['yt', 'youtube', 'www.youtube.com', 'search_query'],
    ['gh', 'github', 'github.com', 'q'],
  ]) {
    const query = 'Türkçe & spaces #? "<script> https://evil.example';
    const result = launcherTool(prefix + ' ' + query);
    assert.equal(result.status, 'success');
    assert.equal(result.provider, provider);
    const url = new URL(result.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, host);
    assert.equal(url.searchParams.get(parameter), query);
    assert.equal(result.url, buildWebSearch(provider, query));
    assert.equal(launcherTool(prefix).status, 'incomplete');
  }
  assert.throws(() => buildWebSearch('__proto__', 'query'), /INVALID_WEB_SEARCH/);
  assert.throws(() => buildWebSearch('https://evil.example', 'query'), /INVALID_WEB_SEARCH/);
  assert.throws(() => buildWebSearch('google', 'a'.repeat(513)), /INPUT_TOO_LONG/);
  assert.throws(() => buildWebSearch('google', 'query\nnext'), /INVALID_WEB_SEARCH/);
  assert.equal(launcherTool('g ' + 'a'.repeat(513)).error, 'INPUT_TOO_LONG');
});
