import catalog from './catalog.json' with { type: 'json' };
import { folderColorIds } from './folder-appearance.js';
import runtimeDefaults from './runtime-defaults.json' with { type: 'json' };
import { regexMatches } from './regex.js';
import { fileTypeCategory } from './file-types.js';
import { suggestTags } from './smart-tags.js';
import { findKnownApp, appInsight, leafName, gameLaunchCategory } from './app-insights.js';
export const icons = [
  'code',
  'palette',
  'gamepad',
  'file',
  'wrench',
  'music',
  'folder',
  'star',
  'rocket',
  'globe',
  'archive',
  'heart',
];
export const colors = folderColorIds;
export const defaultCategories = catalog;
export const defaultSettings = {
  schemaVersion: 5,
  ...runtimeDefaults,
  mode: 'move',
  autoScan: true,
  excludedExtensions: ['.ini', '.tmp'],
  overrides: {},
  itemIcons: {},
  itemDescriptions: {},
  categories: catalog,
  rules: [],
  launcherCommandFavorites: [],
  theme: 'midnight',
  uiScale: 100,
  density: 'comfortable',
  motion: 'system',
  language: 'tr',
  iconPack: 'lucide',
  fontFamily: 'system',
  folderTheme: 'gradient',
};
export const normalize = (value) =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function categoryId(value) {
  return Number.isInteger(value) ? catalog[value]?.id : value;
}
export function categorySegments(id, categories = catalog) {
  const result = [],
    seen = new Set();
  let current = categories.find((c) => c.id === categoryId(id));
  if (!current) throw Error('CATEGORY_MISSING');
  while (current) {
    if (seen.has(current.id) || result.length >= 16) throw Error('CATEGORY_CYCLE');
    seen.add(current.id);
    result.unshift(current.folder);
    current = current.parentId ? categories.find((c) => c.id === current.parentId) : null;
  }
  return result;
}
export function categoryRoot(id) {
  return (
    ['software', 'system', 'internet', 'learning', 'finance', 'ai'].find((root) =>
      id?.startsWith(root),
    ) || id
  );
}
export function defaultCategory(name, target = '', launchUrl = '') {
  const gameCategory = gameLaunchCategory(launchUrl);
  if (gameCategory) return gameCategory;
  const app = findKnownApp({ name, target });
  if (app) return categoryRoot(app.categoryId);
  const fileCategory = fileTypeCategory(name);
  if (fileCategory) return categoryRoot(fileCategory);
  const text = normalize(`${leafName(name)} ${leafName(target)}`);
  if (
    /\b(figma|adobe|photoshop|premiere|blender|davinci|illustrator|canva|inkscape|gimp)\b/.test(
      text,
    )
  )
    return 'design';
  if (/\b(steam|epic|game|oyun|valorant|discord|minecraft|ubisoft|gog)\b/.test(text))
    return 'games';
  if (
    /\b(vscode|code|github|gitkraken|docker|python|node|terminal|jetbrains|intellij|webstorm|pycharm|postman|insomnia)\b/.test(
      text,
    )
  )
    return 'software';
  if (/\b(word|excel|notion|office|obsidian|powerpoint|libreoffice|acrobat)\b/.test(text))
    return 'office';
  if (/\b(vlc|spotify|audacity|itunes|music|foobar)\b/.test(text)) return 'media';
  return 'system';
}
export function classify(item, settings = defaultSettings) {
  const categories = settings.categories || catalog;
  const known = new Set(categories.map((c) => c.id));
  const override = categoryId(settings.overrides?.[item.id]);
  if (known.has(override)) return override;
  for (const rule of settings.rules || [])
    if (rule.enabled !== false && known.has(rule.categoryId) && matchesRule(rule, item))
      return rule.categoryId;
  const gameCategory = gameLaunchCategory(item.launchUrl);
  if (gameCategory) return known.has(gameCategory) ? gameCategory : categories[0].id;
  const app = findKnownApp(item);
  if (app) {
    if (known.has(app.categoryId)) return app.categoryId;
    const root = categoryRoot(app.categoryId);
    if (known.has(root)) return root;
    const legacyFallback =
      root === 'internet'
        ? ['systemnetwork', 'system']
        : root === 'learning' || root === 'finance'
          ? ['office']
          : [];
    const availableFallback = legacyFallback.find((id) => known.has(id));
    if (availableFallback) return availableFallback;
  }
  let inferred = defaultCategory(item.name, item.target, item.launchUrl);
  const fileCategory = fileTypeCategory(item.name);
  const filename = normalize(leafName(item.name));
  const documentHint = !fileCategory || fileCategory === 'office';
  const contentGroup =
    documentHint &&
    /(?:^|[\s._-])(?:invoice|receipt|budget|fatura|butce|muhasebe)(?:$|[\s._-]|\d)/.test(filename)
      ? 'financeaccounting'
      : documentHint &&
          /(?:^|[\s._-])(?:course|lesson|lecture|kurs|ders)(?:$|[\s._-]|\d)/.test(filename)
        ? 'learningcourses'
        : fileCategory === 'learningreading'
          ? 'learningreading'
          : null;
  // Topic hints describe documents or unknown filenames. They do not turn a
  // source file, archive, image or recording into a document of that subject.
  if (contentGroup && known.has(contentGroup)) return contentGroup;

  if (fileCategory)
    return known.has(fileCategory)
      ? fileCategory
      : known.has(inferred)
        ? inferred
        : categories[0].id;
  const name = normalize(leafName(item.name) + ' ' + leafName(item.target));
  const sub = /setup|installer|driver.*update|update|install/.test(name)
    ? 'systeminstallers'
    : /driver|nvidia|radeon/.test(name)
      ? 'systemdrivers'
      : /vpn|firewall|network|wireshark|security/.test(name)
        ? 'systemnetwork'
        : /7-?zip|winrar|compress|unzip/.test(name)
          ? 'systemcompression'
          : /docker|kubernetes|devops|terraform/.test(name)
            ? 'softwaredevops'
            : /mysql|postgres|sqlite|database|mongodb|dbeaver/.test(name)
              ? 'softwaredatabase'
              : /terminal|powershell|cmd|putty|shell/.test(name)
                ? 'softwareterminal'
                : /vscode|visual studio|code|intellij|pycharm|webstorm|editor|android studio/.test(
                      name,
                    )
                  ? 'softwareide'
                  : null;
  if (sub && known.has(sub)) inferred = sub;
  return known.has(inferred) ? inferred : categories[0].id;
}
export function safeSegment(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 120 &&
    !/[<>:"/\\|?*\x00-\x1f]/.test(value) &&
    !/[. ]$/.test(value) &&
    !['.', '..'].includes(value) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)
  );
}

export function matchesRule(rule, item) {
  const text = normalize(`${item.name} ${item.target || ''}`),
    extension = normalize(item.name).split('.').at(-1);
  return rule.match === 'regex'
    ? regexMatches(rule.pattern, item.name) ||
        (!!item.target && regexMatches(rule.pattern, item.target))
    : rule.match === 'extension'
      ? extension === normalize(rule.pattern).replace(/^\./, '')
      : text.includes(normalize(rule.pattern));
}
export function enrichItem(item, settings = defaultSettings) {
  const category = classify(item, settings);
  const explicit =
    Object.hasOwn(settings.overrides || {}, item.id) ||
    (settings.rules || []).some((r) => r.enabled && matchesRule(r, item));
  const fallback =
    defaultCategory(item.name, item.target, item.launchUrl) === 'system' &&
    !/system|utility|tool|chrome|browser|backup|security|network|driver|setup|installer|update|zip|rar/i.test(
      item.name,
    );
  return {
    ...item,
    category,
    suggestion: !explicit && fallback && !findKnownApp(item) ? suggestTags(item, settings) : null,
    insight: appInsight(item, category, settings.itemDescriptions?.[item.id]),
  };
}
export function isDescendant(id, parent, categories) {
  let c = categories.find((c) => c.id === id);
  while (c) {
    if (c.id === parent) return true;
    c = c.parentId ? categories.find((x) => x.id === c.parentId) : null;
  }
  return false;
}
