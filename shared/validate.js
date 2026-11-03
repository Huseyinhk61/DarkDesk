import {
  defaultSettings,
  defaultCategories,
  icons,
  colors,
  safeSegment,
  categorySegments,
  categoryId,
} from './domain.js';
const defaults = defaultSettings;
export function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('SETTINGS_INVALID');
  const value = { ...structuredClone(defaults), ...input };
  if (
    !['move', 'copy'].includes(value.mode) ||
    typeof value.autoScan !== 'boolean' ||
    !['midnight', 'cyberpunk', 'slate'].includes(value.theme) ||
    !['tr', 'en'].includes(value.language) ||
    !['lucide', 'tabler', 'minimal'].includes(value.iconPack)
  )
    throw Error('SETTINGS_INVALID');
  if (
    !Array.isArray(value.excludedExtensions) ||
    value.excludedExtensions.length > 50 ||
    value.excludedExtensions.some((x) => typeof x !== 'string' || !/^\.[a-z0-9]{1,12}$/i.test(x))
  )
    throw Error('EXTENSIONS_INVALID');
  if (
    !Array.isArray(value.categories) ||
    !value.categories.length ||
    value.categories.length > 2000
  )
    throw Error('CATEGORIES_INVALID');
  const categories = value.categories.map((c) => {
    if (
      !c ||
      typeof c.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(c.id) ||
      typeof c.name !== 'string' ||
      !c.name.trim() ||
      c.name.length > 120 ||
      !safeSegment(c.folder) ||
      !icons.includes(c.icon) ||
      !colors.includes(c.color) ||
      !(c.parentId === null || typeof c.parentId === 'string')
    )
      throw Error('CATEGORY_INVALID');
    return {
      id: c.id,
      name: c.name.trim(),
      folder: c.folder,
      parentId: c.parentId || null,
      icon: c.icon,
      color: c.color,
      ...(defaultCategories.some((d) => d.id === c.id && d.labelKey === c.labelKey)
        ? { labelKey: c.labelKey }
        : {}),
    };
  });
  const ids = new Set(categories.map((c) => c.id));
  if (ids.size !== categories.length) throw Error('CATEGORY_DUPLICATE');
  const paths = new Set();
  for (const c of categories) {
    if (c.parentId && !ids.has(c.parentId)) throw Error('CATEGORY_PARENT');
    const key = categorySegments(c.id, categories).join('/').normalize('NFC').toLowerCase();
    if (paths.has(key)) throw Error('CATEGORY_DUPLICATE');
    paths.add(key);
  }
  for (const key of ['overrides', 'itemIcons']) {
    const record = value[key];
    if (
      !record ||
      typeof record !== 'object' ||
      Array.isArray(record) ||
      Object.keys(record).length > 10000
    )
      throw Error('SETTINGS_INVALID');
    for (const [id, v] of Object.entries(record)) {
      if (!id || id.length > 500 || /[\\/\0]/.test(id)) throw Error('SETTINGS_INVALID');
      if (key === 'overrides') {
        if (typeof v !== 'string' && !Number.isInteger(v)) throw Error('CATEGORY_INVALID');
      } else if (!icons.includes(v)) throw Error('ICON_INVALID');
    }
  }
  const overrides = Object.fromEntries(
    Object.entries(value.overrides)
      .map(([k, v]) => [k, categoryId(v)])
      .filter(([, v]) => ids.has(v)),
  );
  if (!Array.isArray(value.rules) || value.rules.length > 5000) throw Error('RULE_INVALID');
  const rules = value.rules.map((r) => {
    if (
      !r ||
      typeof r.id !== 'string' ||
      !r.id ||
      !['contains', 'extension'].includes(r.match) ||
      typeof r.pattern !== 'string' ||
      !r.pattern.trim() ||
      r.pattern.length > 120 ||
      (r.match === 'extension' && !/^\.?[a-z0-9]{1,12}$/i.test(r.pattern.trim())) ||
      !ids.has(r.categoryId) ||
      typeof r.enabled !== 'boolean'
    )
      throw Error('RULE_INVALID');
    return {
      id: r.id,
      match: r.match,
      pattern: r.pattern.trim(),
      categoryId: r.categoryId,
      enabled: r.enabled,
    };
  });
  if (new Set(rules.map((r) => r.id)).size !== rules.length) throw Error('RULE_INVALID');
  return {
    schemaVersion: 2,
    mode: value.mode,
    autoScan: value.autoScan,
    excludedExtensions: [...new Set(value.excludedExtensions.map((x) => x.toLowerCase()))],
    overrides,
    itemIcons: value.itemIcons,
    categories,
    rules,
    theme: value.theme,
    language: value.language,
    iconPack: value.iconPack,
  };
}
