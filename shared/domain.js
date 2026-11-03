import catalog from './catalog.json' with { type: 'json' };
import runtimeDefaults from './runtime-defaults.json' with { type: 'json' };
import { regexMatches } from './regex.js';
import { suggestTags } from './smart-tags.js';
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
export const colors = ['blue', 'purple', 'green', 'orange', 'slate', 'pink'];
export const defaultCategories = catalog;
export const defaultSettings = {
  schemaVersion: 3,
  ...runtimeDefaults,
  mode: 'move',
  autoScan: true,
  excludedExtensions: ['.ini', '.tmp'],
  overrides: {},
  itemIcons: {},
  categories: catalog,
  rules: [],
  theme: 'midnight',
  uiScale: 100,
  density: 'comfortable',
  motion: 'system',
  language: 'tr',
  iconPack: 'lucide',
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
export function defaultCategory(name, target = '') {
  const text = normalize(`${name} ${target}`),
    ext = normalize(name).split('.').at(-1);
  if (
    /figma|adobe|photoshop|premiere|blender|after effects|davinci|illustrator|canva|inkscape|gimp/.test(
      text,
    ) ||
    ['jpg', 'jpeg', 'png', 'svg', 'psd', 'ai', 'webp', 'gif', 'sketch'].includes(ext)
  )
    return 'design';
  if (/steam|epic|game|oyun|valorant|discord|minecraft|battle.net|ubisoft|gog/.test(text))
    return 'games';
  if (
    /vscode|visual studio|android studio|code|github|gitkraken|docker|python|node|terminal|jetbrains|intellij|webstorm|pycharm|postman|insomnia/.test(
      text,
    ) ||
    ['js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'go', 'rs', 'sql', 'sh'].includes(ext)
  )
    return 'software';
  if (
    /word|excel|notion|office|obsidian|powerpoint|libreoffice|acrobat/.test(text) ||
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'csv', 'md'].includes(ext)
  )
    return 'office';
  if (
    /vlc|spotify|audacity|itunes|music|foobar|obs studio|media player/.test(text) ||
    ['mp3', 'mp4', 'wav', 'flac', 'aac', 'ogg', 'mov', 'mkv', 'avi', 'webm'].includes(ext)
  )
    return 'media';
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
  let inferred = defaultCategory(item.name, item.target);
  const name = normalize(item.name + ' ' + (item.target || ''));
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
    defaultCategory(item.name, item.target) === 'system' &&
    !/system|utility|tool|chrome|browser|backup|security|network|driver|setup|installer|update|zip|rar/i.test(
      item.name,
    );
  return {
    ...item,
    category,
    suggestion: !explicit && fallback ? suggestTags(item, settings) : null,
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
