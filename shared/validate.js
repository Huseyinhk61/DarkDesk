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
import { normalizeCurrencyPreferences } from './currency.js';
import { languages, themeIds, iconPacks, fontIds } from './appearance.js';
import { folderThemes, normalizeFolderColor } from './folder-appearance.js';
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
    !Object.hasOwn(languages, value.language) ||
    !iconPacks.includes(value.iconPack) ||
    !fontIds.includes(value.fontFamily) ||
    !folderThemes.includes(value.folderTheme)
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
      if (
        [
          'software',
          'design',
          'games',
          'office',
          'system',
          'media',
          'internet',
          'learning',
          'finance',
          'internetbrowsers',
          'internetchat',
          'internetmeetings',
          'learningcourses',
          'learningreading',
          'financeaccounting',
        ].includes(builtin.id)
      )
        continue;
      if (!builtin.parentId || value.categories.some((c) => c.id === builtin.parentId))
        value.categories.push(structuredClone(builtin));
    }
  }
  if ((input.schemaVersion || 1) < 4) {
    // Versioned additions run once. A user deleting a new group after this
    // migration must not have that group silently recreated on the next save.
    const additions = new Set([
      'internet',
      'learning',
      'finance',
      'internetbrowsers',
      'internetchat',
      'internetmeetings',
      'learningcourses',
      'learningreading',
      'financeaccounting',
    ]);
    value.categories = [...value.categories];
    for (const builtin of defaultCategories.filter((category) => additions.has(category.id))) {
      if (value.categories.length >= 2000) break;
      if (
        value.categories.some(
          (category) =>
            category.id === builtin.id ||
            (category.parentId === builtin.parentId &&
              typeof category.folder === 'string' &&
              category.folder.normalize('NFC').toLowerCase() ===
                builtin.folder.normalize('NFC').toLowerCase()),
        )
      )
        continue;
      if (
        !builtin.parentId ||
        value.categories.some((category) => category.id === builtin.parentId)
      )
        value.categories.push(structuredClone(builtin));
    }
  }
  if ((input.schemaVersion || 1) < 5) {
    value.categories = [...value.categories];
    for (const builtin of defaultCategories.filter((c) => c.id === 'ai' || c.parentId === 'ai')) {
      if (
        value.categories.length < 2000 &&
        !value.categories.some(
          (c) =>
            c.id === builtin.id || (c.parentId === builtin.parentId && c.folder === builtin.folder),
        ) &&
        (!builtin.parentId || value.categories.some((c) => c.id === builtin.parentId))
      )
        value.categories.push(structuredClone(builtin));
    }
  }
  if ((input.schemaVersion || 1) < 5 && value.categories.some((c) => c.id === 'aicode'))
    value.profiles = value.profiles.map((profile) =>
      profile.id === 'coding' &&
      profile.labelKey === 'profiles.coding' &&
      JSON.stringify(profile.categories) === JSON.stringify(['software', 'internet'])
        ? { ...profile, categories: [...profile.categories, 'aicode'] }
        : profile,
    );
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
      (c.folderGlyphSize != null && !['small', 'normal', 'large'].includes(c.folderGlyphSize)) ||
      (c.folderTheme != null && !folderThemes.includes(c.folderTheme)) ||
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
      ...(c.folderGlyphSize == null ? {} : { folderGlyphSize: c.folderGlyphSize }),
      ...(c.folderTheme == null ? {} : { folderTheme: c.folderTheme }),
      ...(c.customColor === undefined || c.customColor === null
        ? {}
        : { customColor: normalizeFolderColor(c.customColor) }),
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
  const descriptions = value.itemDescriptions;
  if (
    !descriptions ||
    typeof descriptions !== 'object' ||
    Array.isArray(descriptions) ||
    Object.keys(descriptions).length > 10000
  )
    throw Error('DESCRIPTION_INVALID');
  const itemDescriptions = {};
  for (const [id, text] of Object.entries(descriptions)) {
    if (
      !id ||
      id.length > 512 ||
      /[\\/\0\r\n]/.test(id) ||
      typeof text !== 'string' ||
      text.length > 1000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)
    )
      throw Error('DESCRIPTION_INVALID');
    if (text.trim())
      Object.defineProperty(itemDescriptions, id, {
        value: text.trim(),
        enumerable: true,
        writable: true,
        configurable: true,
      });
  }
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
  const usedShortcuts = new Set([launcherShortcut, ...profiles.map((profile) => profile.shortcut)]);
  const restoreShortcut =
    input.restoreShortcut === undefined
      ? [
          defaults.restoreShortcut,
          'CommandOrControl+Alt+Shift+0',
          ...Array.from({ length: 24 }, (_, index) => 'CommandOrControl+Alt+Shift+F' + (index + 1)),
        ]
          .map(accelerator)
          .find((key) => !usedShortcuts.has(key))
      : accelerator(value.restoreShortcut);
  const currency = normalizeCurrencyPreferences(value.currency, value.language);
  if (
    new Set(profiles.map((p) => p.id)).size !== profiles.length ||
    new Set([
      launcherShortcut.toLowerCase(),
      restoreShortcut.toLowerCase(),
      ...profiles.map((p) => p.shortcut.toLowerCase()),
    ]).size !==
      profiles.length + 2
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
  const commandIds = new Set([
    'command:show',
    'command:organize',
    'command:restore',
    'system:lock',
    'system:mute',
    'system:unmute',
    'system:volume-up',
    'system:volume-down',
    'system:screenshot',
    'system:wifi-on',
    'system:wifi-off',
    'system:night-light',
    'system:clean-space',

    'system:shutdown',
    'system:empty-trash',
    ...profiles.map((p) => 'command:' + p.id),
  ]);
  if (
    !Array.isArray(value.launcherCommandFavorites) ||
    value.launcherCommandFavorites.length > 128 ||
    value.launcherCommandFavorites.some((id) => typeof id !== 'string')
  )
    throw Error('SETTINGS_INVALID');
  const launcherCommandFavorites = [
    ...new Set(value.launcherCommandFavorites.filter((id) => commandIds.has(id))),
  ];
  if (typeof value.smartTagging !== 'boolean') throw Error('SETTINGS_INVALID');
  return {
    schemaVersion: 5,
    launcherCommandFavorites,
    profiles,
    launcherShortcut,
    restoreShortcut,
    currency,
    scanFilters,
    automation,
    smartTagging: value.smartTagging,
    mode: value.mode,
    autoScan: value.autoScan,
    excludedExtensions: [...new Set(value.excludedExtensions.map((x) => x.toLowerCase()))],
    overrides,
    itemIcons: value.itemIcons,
    itemDescriptions,
    categories,
    rules,
    theme: value.theme,
    uiScale: value.uiScale,
    density: value.density,
    motion: value.motion,
    language: value.language,
    iconPack: value.iconPack,
    fontFamily: value.fontFamily,
    folderTheme: value.folderTheme,
  };
}
