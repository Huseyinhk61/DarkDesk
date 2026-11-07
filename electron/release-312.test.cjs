const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSettings } = require('../shared/validate.js');
const { parseCurrencyInput, normalizeCurrencyPreferences } = require('../shared/currency.js');
const { notePages } = require('../shared/note-pages.js');
const { normalizeWidgetState, validateWidgetPatch } = require('../shared/widget-model.js');
const { SystemMetrics } = require('./runtime/system-metrics.cjs');
const { linuxMounts } = require('./runtime/volumes.cjs');
const { WeatherService } = require('./runtime/weather.cjs');
const { discoverActions } = require('./runtime/platform-actions.cjs');
const { createUpdates, StoreUpdates } = require('./runtime/updates.cjs');
const { validateIdentity } = require('../scripts/store-config.cjs');

test('currency preferences migrate, validate, deduplicate and accept Turkish TL launcher expressions', () => {
  assert.deepEqual(parseCurrencyInput('1 usd tl karşılığı'), { amount: 1, from: 'USD', to: 'TRY' });
  assert.deepEqual(parseCurrencyInput('EUR', 'GBP'), { amount: 1, from: 'EUR', to: 'GBP' });
  assert.equal(validateSettings({ language: 'en' }).currency.target, 'USD');
  const currency = {
    target: 'CHF',
    pairs: [
      ['USD', 'CHF'],
      ['USD', 'CHF'],
    ],
  };
  assert.deepEqual(validateSettings({ currency }).currency, {
    target: 'CHF',
    pairs: [['USD', 'CHF']],
  });
  for (const value of [
    { target: 'BAD', pairs: [] },
    { target: 'USD', pairs: [['USD', 'USD']] },
    { target: 'TRY', pairs: [['USD', 'javascript:']] },
  ])
    assert.throws(() => normalizeCurrencyPreferences(value), /FX_INVALID/);
});
test('default-mode shortcut is persisted, normalized and protected from launcher/profile collisions', () => {
  const value = validateSettings({ restoreShortcut: 'Ctrl+Alt+0' });
  assert.equal(value.restoreShortcut, 'CommandOrControl+Alt+0');
  assert.throws(() => validateSettings({ restoreShortcut: 'Alt+X' }), /SHORTCUT_DUPLICATE/);
  assert.throws(() => validateSettings({ restoreShortcut: 'Ctrl+Alt+1' }), /SHORTCUT_DUPLICATE/);
});
test('beta language choices survive validation and appearance caching', () => {
  const { sanitizeAppearance } = require('../shared/appearance.js');
  const en = require('../src/locales/en.json');
  for (const language of ['de', 'fr', 'es']) {
    assert.equal(validateSettings({ language }).language, language);
    assert.equal(sanitizeAppearance({ language }).language, language);
    const dictionary = require('../src/locales/' + language + '.json');
    assert.ok(Object.keys(dictionary).length >= 90);
    for (const [key, text] of Object.entries(dictionary)) {
      assert.ok(en[key], key);
      assert.deepEqual(
        [...text.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
        [...en[key].matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
        key,
      );
    }
  }
});
test('note pagination never loses Unicode or line breaks, including page-boundary newlines', () => {
  for (const text of [
    '',
    'a\nb\nc\nd\ne\nf',
    '😀'.repeat(170),
    'W'.repeat(500),
    'word '.repeat(600),
  ]) {
    const pages = notePages(text, 17, 4);
    assert.equal(pages.map((p) => text.slice(p.start, p.end)).join(''), text);
    assert.ok(pages.every((p) => !/[\uD800-\uDBFF]$/.test(text.slice(p.start, p.end))));
  }
});
test('all disks retain independent values and inaccessible volumes remain visible; polling is cached', async () => {
  let reads = 0,
    now = 0;
  const metrics = new SystemMetrics({
    clock: () => now,
    listVolumes: async () => {
      reads++;
      return [
        { path: 'C:\\', label: 'System', total: 1000, free: 400 },
        { path: 'D:\\', label: 'Data', total: 2000, free: 1500 },
        { path: 'E:\\', label: 'Locked' },
      ];
    },
    statfs: async () => {
      throw Error('denied');
    },
    cpus: () => [],
    total: () => 100,
    free: () => 25,
  });
  const first = await metrics.detailedSnapshot();
  assert.equal(first.disks.length, 3);
  assert.equal(first.disks[1].percent, 25);
  assert.equal(first.disks[2].unavailable, true);
  await metrics.detailedSnapshot();
  assert.equal(reads, 1);
  now = 15001;
  await metrics.detailedSnapshot();
  assert.equal(reads, 2);
});
test('Linux volume discovery excludes virtual mounts, deduplicates bind mounts and decodes spaces', () => {
  const result = linuxMounts(
    '1 0 0:1 / /proc rw - proc proc rw\n2 0 8:1 / / rw - ext4 /dev/sda1 rw\n3 0 8:1 /home /home rw - ext4 /dev/sda1 rw\n4 0 8:2 / /media/My\\040Disk rw - ext4 /dev/sdb1 rw',
  );
  assert.deepEqual(
    result.map((v) => v.path),
    ['/', '/media/My Disk'],
  );
});
const forecast = (now) => ({
  properties: {
    timeseries: [
      {
        time: new Date(now).toISOString(),
        data: {
          instant: { details: { air_temperature: 17.5, relative_humidity: 65, wind_speed: 4 } },
          next_1_hours: { summary: { symbol_code: 'rain' } },
        },
      },
    ],
  },
});
test('free weather uses a fixed provider, identified requests, bounded coordinates and deduplicated caching', async () => {
  const now = Date.now();
  let calls = 0;
  const service = new WeatherService({
    clock: () => now,
    fetch: async (url, options) => {
      calls++;
      assert.match(
        url,
        /^https:\/\/api.met.no\/weatherapi\/locationforecast\/2.0\/compact\?lat=41.01&lon=28.98$/,
      );
      assert.match(options.headers['User-Agent'], /DarkDesk/);
      return Response.json(forecast(now));
    },
  });
  const location = { name: 'İstanbul', latitude: 41.01, longitude: 28.98 };
  const results = await Promise.all([service.quote(location), service.quote(location)]);
  assert.equal(calls, 1);
  assert.equal(results[0].temperature, 17.5);
  assert.equal(results[0].category, 'rain');
  await service.quote(location);
  assert.equal(calls, 1);
  await assert.rejects(service.quote({ ...location, latitude: 91 }), /WEATHER_INVALID/);
});
test('weather reports unavailable instead of inventing readings and rejects malformed or oversized data', async () => {
  const location = { name: 'City', latitude: 1, longitude: 1 };
  for (const fetch of [
    async () => {
      throw Error('network');
    },
    async () => Response.json({}),
    async () =>
      new Response('x'.repeat(2 * 1024 * 1024 + 1), {
        headers: { 'content-type': 'application/json' },
      }),
  ])
    await assert.rejects(new WeatherService({ fetch }).quote(location), /WEATHER_UNAVAILABLE/);
  const state = normalizeWidgetState();
  assert.equal(state.widgets.weather.enabled, false);
  assert.deepEqual(
    validateWidgetPatch(state, { weather: { location, unit: 'fahrenheit' } }).weather,
    { location, unit: 'fahrenheit' },
  );
  assert.throws(
    () =>
      validateWidgetPatch(state, {
        weather: { location: { ...location, longitude: 181 }, unit: 'celsius' },
      }),
    /WEATHER_INVALID/,
  );
});
test('Linux native actions discover working providers without mutating audio during probing', async () => {
  const calls = [];
  const actions = await discoverActions({
    platform: 'linux',
    env: {},
    exists: async (file) => file === '/usr/bin/wpctl',
    run: async (...args) => {
      calls.push(args);
      return { stdout: 'Volume: 0.50' };
    },
  });
  assert.deepEqual(
    calls.map((c) => c[1]),
    [['get-volume', '@DEFAULT_AUDIO_SINK@']],
  );
  await actions['volume-up']();
  assert.deepEqual(calls[1][1], ['set-volume', '--limit', '1', '@DEFAULT_AUDIO_SINK@', '5%+']);
  assert.equal(actions.shutdown, undefined);
  assert.equal(actions.lock, undefined);
});
test('Store edition never configures GitHub updating or installs an external update', async () => {
  let feeds = 0;
  const store = createUpdates({
    windowsStore: true,
    appVersion: '3.12.0',
    autoUpdater: {
      setFeedURL() {
        feeds++;
      },
    },
  });
  assert.ok(store instanceof StoreUpdates);
  assert.equal(store.status().reason, 'store');
  assert.equal(feeds, 0);
  await assert.rejects(store.download(), /UPDATE_STORE_MANAGED/);
  await assert.rejects(store.install(), /UPDATE_STORE_MANAGED/);
});
test('Store packaging requires a real identity and rejects placeholders and XML injection', () => {
  assert.throws(
    () => validateIdentity(require('../build/store-identity.example.json')),
    /Invalid Store identity/,
  );
  assert.throws(
    () =>
      validateIdentity({
        identityName: 'Test.DarkDesk',
        publisher: 'CN=<bad>',
        publisherDisplayName: 'Name',
        displayName: 'DarkDesk',
      }),
    /Invalid/,
  );
  assert.equal(
    validateIdentity({
      identityName: 'Example.DarkDesk',
      publisher: 'CN=1234',
      publisherDisplayName: 'Example',
      displayName: 'DarkDesk',
    }).identityName,
    'Example.DarkDesk',
  );
});
test('existing user shortcuts are preserved when migrating the new default-mode binding', () => {
  const { defaultSettings } = require('../shared/domain.js');
  const profiles = structuredClone(defaultSettings.profiles);
  profiles[0].shortcut = 'CommandOrControl+Alt+0';
  const saved = validateSettings({ profiles });
  assert.equal(saved.profiles[0].shortcut, 'CommandOrControl+Alt+0');
  assert.notEqual(saved.restoreShortcut, saved.profiles[0].shortcut);
  const callbacks = new Map(),
    calls = [];
  const { ShortcutManager } = require('./runtime/shortcuts.cjs');
  const manager = new ShortcutManager(
    {
      register: (key, callback) => {
        callbacks.set(key, callback);
        return true;
      },
      unregister: (key) => callbacks.delete(key),
    },
    { restore: () => calls.push('restore') },
  );
  manager.configure(saved);
  callbacks.get(saved.restoreShortcut)();
  assert.deepEqual(calls, ['restore']);
  manager.dispose();
});
test('old undersized widget bounds grow to keep fixed controls visible while staying on screen', () => {
  const { restoreWidgetBounds, widgetSizes } = require('../shared/widget-model.js');
  const display = { x: 0, y: 0, width: 1024, height: 768 };
  for (const [id, size] of Object.entries(widgetSizes)) {
    const bounds = restoreWidgetBounds(id, { x: 800, y: 600, width: 240, height: 180 }, [display]);
    assert.ok(bounds.width >= size.width && bounds.height >= size.height);
    assert.ok(bounds.x + bounds.width <= 1024 && bounds.y + bounds.height <= 768);
  }
});
