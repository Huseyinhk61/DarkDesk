const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { SettingsStore, validateSettings } = require('./settings.cjs');
const { themes, themeIds, sanitizeAppearance, resolveTheme } = require('../shared/appearance.js');
test('appearance defaults migrate older settings without changing file operations', () => {
  const value = validateSettings({ mode: 'copy', excludedExtensions: ['.bak'], autoScan: false });
  assert.equal(value.uiScale, 100);
  assert.equal(value.density, 'comfortable');
  assert.equal(value.motion, 'system');
  assert.equal(value.mode, 'copy');
  assert.deepEqual(value.excludedExtensions, ['.bak']);
});
test('all shared catalog themes and accessibility choices persist through native settings', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-appearance-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new SettingsStore(root);
  for (const theme of themeIds) {
    const saved = await store.write({
      ...(await store.read()),
      theme,
      uiScale: 130,
      density: 'compact',
      motion: 'reduced',
      mode: 'copy',
    });
    assert.deepEqual(await new SettingsStore(root).read(), saved);
    assert.equal(saved.theme, theme);
    assert.equal(saved.uiScale, 130);
    assert.equal(saved.mode, 'copy');
  }
});
test('invalid native appearance options are rejected rather than entering the CSS engine', () => {
  for (const input of [
    { theme: 'url(injected)' },
    { uiScale: 0 },
    { uiScale: '130' },
    { density: 'unknown' },
    { motion: 'full' },
  ])
    assert.throws(() => validateSettings(input), /SETTINGS_INVALID/);
});
test('untrusted appearance cache only returns validated presentation keys', () => {
  for (const value of [
    null,
    [],
    'dark',
    { theme: {}, language: 'unknown', uiScale: 999, mode: 'move', categories: [] },
  ]) {
    const safe = sanitizeAppearance(value);
    assert.equal(safe.theme, 'midnight');
    assert.equal(safe.uiScale, 100);
    assert.equal(safe.language, 'tr');
    assert.equal(safe.mode, undefined);
    assert.equal(safe.categories, undefined);
  }
  assert.equal(sanitizeAppearance({ theme: 'forest', motion: 'reduced' }).theme, 'forest');
});
test('system theme resolution follows OS appearance without changing explicit choices', () => {
  assert.equal(resolveTheme('system', true).id, 'midnight');
  assert.equal(resolveTheme('system', false).id, 'slate');
  assert.equal(resolveTheme('rose', true).id, 'rose');
  assert.equal(resolveTheme('bad', true).id, 'midnight');
});
function luminance(hex) {
  const rgb = hex
    .replace('#', '')
    .match(/../g)
    .map((component) => parseInt(component, 16) / 255)
    .map((component) =>
      component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4,
    );
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(first, second) {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
test('catalog text and primary button tokens meet normal-text contrast on base surfaces', () => {
  for (const theme of themes.filter((theme) => theme.tokens)) {
    for (const foreground of ['ink', 'muted', 'faint'])
      for (const background of ['bg', 'sidebar', 'surface', 'raised', 'field'])
        assert.ok(
          contrast(theme.tokens[foreground], theme.tokens[background]) >= 4.5,
          `${theme.id} ${foreground}/${background}`,
        );
    assert.ok(
      contrast(theme.tokens.accent, theme.tokens['primary-ink']) >= 4.5,
      theme.id + ' button',
    );
  }
});
