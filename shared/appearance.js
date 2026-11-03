import themes from './themes.json' with { type: 'json' };
export { themes };
export const themeIds = themes.map((theme) => theme.id);
export const appearanceKeys = ['theme', 'language', 'iconPack', 'uiScale', 'density', 'motion'];
const options = {
  theme: themeIds,
  language: ['tr', 'en'],
  iconPack: ['lucide', 'tabler', 'minimal'],
  uiScale: [100, 115, 130],
  density: ['comfortable', 'compact'],
  motion: ['system', 'reduced'],
};
const fallback = {
  theme: 'midnight',
  language: 'tr',
  iconPack: 'lucide',
  uiScale: 100,
  density: 'comfortable',
  motion: 'system',
};
// Appearance storage is a small untrusted cache. Never merge arbitrary objects or
// operation settings from it into the native settings model.
export function sanitizeAppearance(input) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return Object.fromEntries(
    appearanceKeys.map((key) => [
      key,
      options[key].includes(value[key]) ? value[key] : fallback[key],
    ]),
  );
}
export function resolveTheme(id, dark = false) {
  const resolved = id === 'system' ? (dark ? 'midnight' : 'slate') : id;
  return themes.find((theme) => theme.id === resolved && theme.tokens) || themes[0];
}
