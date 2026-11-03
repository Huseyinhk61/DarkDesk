import {
  defaultSettings,
  defaultCategories,
  icons,
  colors,
  safeSegment,
  categorySegments,
  categoryId,
} from './domain.js';
import { compileRule } from './regex.js';
import { themeIds } from './appearance.js';
const defaults = defaultSettings;
export function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('SETTINGS_INVALID');
  const value = { ...structuredClone(defaults), ...input };
  if (
    !['move', 'copy'].includes(value.mode) ||
    typeof value.autoScan !== 'boolean' ||
    !themeIds.includes(value.theme) ||
    ![100, 115, 130].includes(value.uiScale) ||
    !['comfortable', 'compact'].includes(value.density) ||
    !['system', 'reduced'].includes(value.motion) ||
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
  if ((input.schemaVersion || 1) < 3) {
    value.categories = [...value.categories];
    for (const builtin of defaultCategories) {
      if (
        value.categories.some((c) => c.id === builtin.id) ||
        value.categories.some((c) => c.folder === builtin.folder && c.parentId === builtin.parentId)
      )
        continue;
      if (['software', 'design', 'games', 'office', 'system', 'media'].includes(builtin.id))
        continue;
      if (!builtin.parentId || value.categories.some((c) => c.id === builtin.parentId))
        value.categories.push(structuredClone(builtin));
    }
  }
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
      !['contains', 'extension', 'regex'].includes(r.match) ||
      typeof r.pattern !== 'string' ||
      !r.pattern.trim() ||
      r.pattern.length > 256 ||
      (r.match === 'extension' && !/^\.?[a-z0-9]{1,12}$/i.test(r.pattern.trim())) ||
      !ids.has(r.categoryId) ||
      typeof r.enabled !== 'boolean'
    )
      throw Error('RULE_INVALID');
    if (r.match === 'regex') compileRule(r.pattern);
    return {
      id: r.id,
      match: r.match,
      pattern: r.pattern.trim(),
      categoryId: r.categoryId,
      enabled: r.enabled,
    };
  });
  if (new Set(rules.map((r) => r.id)).size !== rules.length) throw Error('RULE_INVALID');
  const textList = (list, max = 100) => {
    if (
      !Array.isArray(list) ||
      list.length > max ||
      list.some((v) => typeof v !== 'string' || !v.trim() || v.length > 100 || /[\r\n\0]/.test(v))
    )
      throw Error('FILTER_INVALID');
    return [...new Set(list.map((v) => v.trim()))];
  };
  const accelerator = (value) => {
    if (
      typeof value !== 'string' ||
      value.length > 80 ||
      !/^(?:(?:CommandOrControl|Control|Ctrl|Alt|Shift|Super|Meta|Command|Cmd)\+)+(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space)$/i.test(
        value,
      )
    )
      throw Error('SHORTCUT_INVALID');
    const parts = value.split('+'),
      key = parts.pop();
    const names = {
      commandorcontrol: 'CommandOrControl',
      ctrl: 'CommandOrControl',
      control: 'CommandOrControl',
      alt: 'Alt',
      shift: 'Shift',
      super: 'Super',
      meta: 'Super',
      command: 'Command',
      cmd: 'Command',
    };
    const modifiers = [...new Set(parts.map((part) => names[part.toLowerCase()]))].sort(
      (a, b) =>
        ['CommandOrControl', 'Command', 'Alt', 'Shift', 'Super'].indexOf(a) -
        ['CommandOrControl', 'Command', 'Alt', 'Shift', 'Super'].indexOf(b),
    );
    return [...modifiers, key.toLowerCase() === 'space' ? 'Space' : key.toUpperCase()].join('+');
  };
  if (!Array.isArray(value.profiles) || !value.profiles.length || value.profiles.length > 24)
    throw Error('PROFILE_INVALID');
  const profiles = value.profiles.map((p) => {
    if (
      !p ||
      typeof p.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      p.name.length > 100 ||
      !Array.isArray(p.categories) ||
      !icons.includes(p.icon)
    )
      throw Error('PROFILE_INVALID');
    return {
      id: p.id,
      name: p.name.trim(),
      categories: [...new Set(p.categories.filter((id) => ids.has(id)))],
      icon: p.icon,
      visibleNames: textList(p.visibleNames || [], 500),
      shortcut: accelerator(p.shortcut),
      ...(defaults.profiles.some((d) => d.id === p.id && d.labelKey === p.labelKey)
        ? { labelKey: p.labelKey }
        : {}),
    };
  });
  const launcherShortcut = accelerator(value.launcherShortcut);
  if (
    new Set(profiles.map((p) => p.id)).size !== profiles.length ||
    new Set([launcherShortcut.toLowerCase(), ...profiles.map((p) => p.shortcut.toLowerCase())])
      .size !==
      profiles.length + 1
  )
    throw Error('SHORTCUT_DUPLICATE');
  const filters = value.scanFilters;
  if (
    !filters ||
    !Number.isInteger(filters.maxDepth) ||
    filters.maxDepth < 1 ||
    filters.maxDepth > 12
  )
    throw Error('FILTER_INVALID');
  const scanFilters = {
    excludedDirectories: textList(filters.excludedDirectories),
    excludedNames: textList(filters.excludedNames),
    allowedNames: textList(filters.allowedNames),
    maxDepth: filters.maxDepth,
  };
  const auto = value.automation;
  if (
    !auto ||
    typeof auto.archiveEnabled !== 'boolean' ||
    typeof auto.downloadsEnabled !== 'boolean' ||
    !Number.isInteger(auto.archiveDays) ||
    auto.archiveDays < 1 ||
    auto.archiveDays > 3650 ||
    !['move', 'copy'].includes(auto.downloadMode) ||
    !Number.isInteger(auto.settleSeconds) ||
    auto.settleSeconds < 5 ||
    auto.settleSeconds > 300
  )
    throw Error('AUTOMATION_INVALID');
  const automation = {
    ...auto,
    archiveEnabled: auto.archiveEnabled && ids.has(auto.archiveCategoryId),
    archiveCategoryId: ids.has(auto.archiveCategoryId)
      ? auto.archiveCategoryId
      : ids.has('archive')
        ? 'archive'
        : categories[0].id,
  };
  if (typeof value.smartTagging !== 'boolean') throw Error('SETTINGS_INVALID');
  return {
    schemaVersion: 3,
    profiles,
    launcherShortcut,
    scanFilters,
    automation,
    smartTagging: value.smartTagging,
    mode: value.mode,
    autoScan: value.autoScan,
    excludedExtensions: [...new Set(value.excludedExtensions.map((x) => x.toLowerCase()))],
    overrides,
    itemIcons: value.itemIcons,
    categories,
    rules,
    theme: value.theme,
    uiScale: value.uiScale,
    density: value.density,
    motion: value.motion,
    language: value.language,
    iconPack: value.iconPack,
  };
}
