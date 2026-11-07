// Local, bounded command-palette tools. No expression is executed as JavaScript.
const MAX_INPUT = 512;
const MAX_TOKENS = 256;
const MAX_DEPTH = 32;
const failure = (code) => Object.assign(Error(code), { code });
const decimal = (value) => Number(value.replace(',', '.'));

const normalizeUnit = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');

const units = new Map();
function register(id, dimension, factor, aliases = [], offset = 0) {
  const unit = { id, dimension, factor, offset };
  for (const name of [id, ...aliases]) units.set(normalizeUnit(name), unit);
}
register('m', 'length', 1, ['meter', 'meters', 'metre', 'metres']);
register('km', 'length', 1000, ['kilometer', 'kilometers', 'kilometre', 'kilometres']);
register('cm', 'length', 0.01, ['centimeter', 'centimeters', 'centimetre', 'santimetre']);
register('mm', 'length', 0.001, ['millimeter', 'millimeters', 'millimetre', 'milimetre']);
register('µm', 'length', 0.000001, ['um', 'micrometer', 'micrometre', 'mikrometre']);
register('in', 'length', 0.0254, ['inch', 'inches', 'inc', 'inç']);
register('ft', 'length', 0.3048, ['foot', 'feet']);
register('yd', 'length', 0.9144, ['yard', 'yards']);
register('mi', 'length', 1609.344, ['mile', 'miles', 'mil']);
register('kg', 'mass', 1, ['kilogram', 'kilograms']);
register('g', 'mass', 0.001, ['gram', 'grams']);
register('mg', 'mass', 0.000001, ['milligram', 'milligrams', 'miligram']);
register('t', 'mass', 1000, ['ton', 'tonne', 'tonnes']);
register('lb', 'mass', 0.45359237, ['lbs', 'pound', 'pounds']);
register('oz', 'mass', 0.028349523125, ['ounce', 'ounces']);
register('s', 'time', 1, ['sec', 'second', 'seconds', 'sn', 'saniye']);
register('ms', 'time', 0.001, ['millisecond', 'milliseconds', 'milisaniye']);
register('min', 'time', 60, ['minute', 'minutes', 'dk', 'dakika']);
register('h', 'time', 3600, ['hr', 'hour', 'hours', 'saat']);
register('d', 'time', 86400, ['day', 'days', 'gun', 'gün']);
register('wk', 'time', 604800, ['week', 'weeks', 'hafta']);
// All temperature conversions use Kelvin as their reference value.
register('K', 'temperature', 1, ['kelvin']);
register('°C', 'temperature', 1, ['c', 'celsius', 'santigrat'], 273.15);
register('°F', 'temperature', 5 / 9, ['f', 'fahrenheit'], 459.67);
register('B', 'data', 1, ['byte', 'bytes', 'bayt']);
for (const [prefix, power] of [
  ['k', 1],
  ['m', 2],
  ['g', 3],
  ['t', 4],
]) {
  const full = { k: 'kilo', m: 'mega', g: 'giga', t: 'tera' }[prefix];
  register(prefix.toUpperCase() + 'B', 'data', 1000 ** power, [
    full + 'byte',
    full + 'bytes',
    full + 'bayt',
  ]);
  register(prefix.toUpperCase() + 'iB', 'data', 1024 ** power);
  register(prefix + 'bit', 'data', 1000 ** power / 8, [prefix + 'bits']);
}
register('bit', 'data', 1 / 8, ['bits']);

function display(value, locale) {
  const rounded = Number(value.toPrecision(14));
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return {
    value: normalized,
    displayValue: new Intl.NumberFormat(locale, {
      maximumSignificantDigits: 14,
      notation:
        normalized !== 0 && (Math.abs(normalized) >= 1e15 || Math.abs(normalized) < 1e-9)
          ? 'scientific'
          : 'standard',
    }).format(normalized),
    copyText: String(normalized),
  };
}

function tokenize(source) {
  const tokens = [];
  let position = 0;
  while (position < source.length) {
    const rest = source.slice(position);
    if (/^\s/.test(rest)) {
      position++;
      continue;
    }
    const numeric = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(rest);
    if (numeric) {
      const value = Number(numeric[0]);
      if (!Number.isFinite(value)) throw failure('RESULT_OUT_OF_RANGE');
      tokens.push({ type: 'number', value });
      position += numeric[0].length;
    } else if (rest.startsWith('**')) {
      tokens.push({ type: '^' });
      position += 2;
    } else if (/^[+*/%^()\-]/.test(rest)) {
      tokens.push({ type: rest[0] });
      position++;
    } else {
      if (/^e[+-]?$/i.test(rest)) throw failure('INCOMPLETE_INPUT');
      throw failure('INVALID_EXPRESSION');
    }
    if (tokens.length > MAX_TOKENS) throw failure('EXPRESSION_TOO_COMPLEX');
  }
  return tokens;
}

function calculate(source) {
  const tokens = tokenize(source);
  let cursor = 0;
  const peek = () => tokens[cursor]?.type;
  const finite = (value) => {
    if (!Number.isFinite(value)) throw failure('RESULT_OUT_OF_RANGE');
    return value;
  };
  const descend = (depth) => {
    if (depth > MAX_DEPTH) throw failure('EXPRESSION_TOO_COMPLEX');
  };
  const primary = (depth) => {
    descend(depth);
    if (!peek()) throw failure('INCOMPLETE_INPUT');
    if (peek() === 'number') return tokens[cursor++].value;
    if (peek() !== '(') throw failure('INVALID_EXPRESSION');
    cursor++;
    const value = sum(depth + 1);
    if (!peek()) throw failure('INCOMPLETE_INPUT');
    if (peek() !== ')') throw failure('INVALID_EXPRESSION');
    cursor++;
    return value;
  };
  const power = (depth) => {
    let value = primary(depth);
    if (peek() === '^') {
      cursor++;
      value = finite(value ** unary(depth + 1));
    }
    return value;
  };
  const unary = (depth) => {
    descend(depth);
    if (peek() === '+' || peek() === '-') {
      const sign = tokens[cursor++].type === '-' ? -1 : 1;
      return sign * unary(depth + 1);
    }
    return power(depth);
  };
  const product = (depth) => {
    let value = unary(depth);
    while (['*', '/', '%'].includes(peek())) {
      const operator = tokens[cursor++].type;
      const right = unary(depth);
      if ((operator === '/' || operator === '%') && right === 0) throw failure('DIVISION_BY_ZERO');
      value = finite(
        operator === '*' ? value * right : operator === '/' ? value / right : value % right,
      );
    }
    return value;
  };
  const sum = (depth) => {
    let value = product(depth);
    while (peek() === '+' || peek() === '-') {
      const operator = tokens[cursor++].type;
      const right = product(depth);
      value = finite(operator === '+' ? value + right : value - right);
    }
    return value;
  };
  const result = sum(0);
  if (cursor !== tokens.length) throw failure('INVALID_EXPRESSION');
  return finite(result);
}

const providers = {
  google: ['https://www.google.com/search', 'q'],
  youtube: ['https://www.youtube.com/results', 'search_query'],
  github: ['https://github.com/search', 'q'],
};
export function buildWebSearch(provider, query) {
  if (
    typeof provider !== 'string' ||
    !Object.hasOwn(providers, provider) ||
    typeof query !== 'string'
  )
    throw failure('INVALID_WEB_SEARCH');
  const cleaned = query.trim();
  if (!cleaned) throw failure('INCOMPLETE_INPUT');
  if (cleaned.length > MAX_INPUT) throw failure('INPUT_TOO_LONG');
  if (/[\u0000-\u001f\u007f]/.test(cleaned)) throw failure('INVALID_WEB_SEARCH');
  const [base, parameter] = providers[provider];
  const url = new URL(base);
  url.searchParams.set(parameter, cleaned);
  return url.href;
}

const systemAliases = {
  'empty-trash': [
    'empty-trash',
    'trash',
    'empty trash',
    'recycle',
    'empty recycle bin',
    'çöp',
    'çöpü boşalt',
    'çöp kutusunu boşalt',
  ],
  lock: ['lock', 'lock screen', 'kilitle', 'ekranı kilitle'],
  shutdown: ['shutdown', 'shut down', 'power off', 'kapat', 'sistemi kapat', 'bilgisayarı kapat'],
  mute: ['mute', 'sessiz', 'sesi kapat'],
  unmute: ['unmute', 'sesi aç'],
  'volume-up': ['volume up', 'ses artır', 'sesi yükselt'],
  'volume-down': ['volume down', 'ses azalt', 'sesi azalt'],
  screenshot: ['screenshot', 'screen capture', 'ekran görüntüsü al'],
  'wifi-on': ['wifi on', 'wi-fi on', 'wifi aç'],
  'wifi-off': ['wifi off', 'wi-fi off', 'wifi kapat'],
  'night-light': ['night light', 'gece ışığı'],
  'clean-space': ['clean space', 'storage cleanup', 'boş alanı temizle'],
};
const normalizeCommand = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .trim()
    .replace(/\s+/g, ' ');
function systemTool(input, query) {
  if (query.length > MAX_INPUT)
    return {
      id: 'tool:system',
      type: 'system',
      input: input.slice(0, MAX_INPUT + 4),
      query: '',
      matches: [],
      status: 'error',
      error: 'INPUT_TOO_LONG',
    };
  const normalized = normalizeCommand(query);
  const exact = Object.entries(systemAliases).find(([, aliases]) =>
    aliases.some((alias) => normalizeCommand(alias) === normalized),
  );
  const matches = exact
    ? [exact[0]]
    : Object.entries(systemAliases)
        .filter(
          ([, aliases]) =>
            !normalized || aliases.some((alias) => normalizeCommand(alias).startsWith(normalized)),
        )
        .map(([id]) => id);
  return {
    id: 'tool:system',
    type: 'system',
    input,
    query,
    matches,
    ...(exact ? { system: exact[0] } : {}),
    status: exact ? 'success' : matches.length ? 'incomplete' : 'error',
    ...(!exact
      ? { error: matches.length ? 'INCOMPLETE_SYSTEM_COMMAND' : 'UNKNOWN_SYSTEM_COMMAND' }
      : {}),
  };
}
function arithmeticTool(expression, input, locale, explicitPrefix) {
  const explicit = explicitPrefix === 'calc' || expression.startsWith('=');
  const source = (expression.startsWith('=') ? expression.slice(1) : expression)
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '.');
  if (!explicit && (!/\d/.test(source) || !/^[\d.eE+*/%^()\s\-]+$/.test(source))) return null;
  const result = {
    id: 'tool:calculator',
    type: 'calculation',
    input,
    ...(explicitPrefix ? { explicitPrefix } : {}),
  };
  if (source.length > MAX_INPUT) return { ...result, status: 'error', error: 'INPUT_TOO_LONG' };
  try {
    return { ...result, status: 'success', ...display(calculate(source), locale) };
  } catch (error) {
    return {
      ...result,
      status: error.code === 'INCOMPLETE_INPUT' ? 'incomplete' : 'error',
      error: error.code || 'INVALID_EXPRESSION',
    };
  }
}

export function launcherTool(query, locale = 'en-US') {
  if (typeof query !== 'string') return null;
  const input = query.trim();
  if (!input) return null;
  if (input.length > MAX_INPUT + 8)
    return {
      id: 'tool:calculator',
      type: 'calculation',
      input: input.slice(0, MAX_INPUT),
      status: 'error',
      error: 'INPUT_TOO_LONG',
    };
  const calc = /^calc(?:\s+([\s\S]*))?$/i.exec(input);
  if (calc) return arithmeticTool(calc[1] || '', input, locale, 'calc');
  const system = /^sys(?:\s+([\s\S]*))?$/i.exec(input);
  if (system) return systemTool(input, system[1] || '');
  const web = /^(g|yt|gh)(?:\s+([\s\S]*))?$/i.exec(input);
  if (web) {
    const provider = { g: 'google', yt: 'youtube', gh: 'github' }[web[1].toLowerCase()];
    const result = { id: 'tool:web', type: 'web', input, provider, query: (web[2] || '').trim() };
    try {
      return { ...result, status: 'success', url: buildWebSearch(provider, result.query) };
    } catch (error) {
      return {
        ...result,
        status: error.code === 'INCOMPLETE_INPUT' ? 'incomplete' : 'error',
        error: error.code,
      };
    }
  }
  const number = '[+-]?(?:\\d+(?:[.,]\\d*)?|[.,]\\d+)(?:e[+-]?\\d+)?';
  const conversion =
    new RegExp(
      `^(${number})\\s*([^\\d=<>]+?)\\s+(?:to|in|kaç|kac|olarak)(?:\\s+(.+))?$`,
      'iu',
    ).exec(input) ||
    new RegExp(`^(${number})\\s*([^\\d=<>]+?)\\s*(?:->|=>|=)\\s*(.*)$`, 'iu').exec(input);
  if (conversion) {
    const result = { id: 'tool:conversion', type: 'conversion', input };
    if (input.length > MAX_INPUT) return { ...result, status: 'error', error: 'INPUT_TOO_LONG' };
    if (!conversion[3]?.trim())
      return { ...result, status: 'incomplete', error: 'INCOMPLETE_INPUT' };
    const from = units.get(normalizeUnit(conversion[2]));
    const to = units.get(normalizeUnit(conversion[3]));
    if (!from || !to) return { ...result, status: 'error', error: 'UNSUPPORTED_UNIT' };
    if (from.dimension !== to.dimension)
      return { ...result, status: 'error', error: 'INCOMPATIBLE_UNITS' };
    const amount = decimal(conversion[1]);
    const reference = (amount + from.offset) * from.factor;
    const raw = reference / to.factor - to.offset;
    const value = from.dimension === 'temperature' && Math.abs(raw) < 1e-10 ? 0 : raw;
    if (
      !Number.isFinite(reference) ||
      !Number.isFinite(value) ||
      (from.dimension === 'temperature' && reference < -1e-10)
    )
      return { ...result, status: 'error', error: 'RESULT_OUT_OF_RANGE' };
    const formatted = display(value, locale);
    return {
      ...result,
      status: 'success',
      ...formatted,
      copyText: formatted.copyText + ' ' + to.id,
      fromUnit: from.id,
      toUnit: to.id,
    };
  }
  return arithmeticTool(input, input, locale);
}
