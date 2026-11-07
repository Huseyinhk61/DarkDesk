import { leafName, unrelatedLaunchHost } from './app-insights.js';
// Bounded local hints complement exact catalog matches. No file contents,
// installation-parent names or online inventory requests enter these rules.
export function purposeCategory(item) {
  if (
    !['installed', 'shortcut'].includes(item.kind) &&
    !/\.(exe|lnk|url|desktop|appimage|app)$/i.test(item.name || '')
  )
    return null;
  const desktopCategories = new Set(
    Array.isArray(item.desktopCategories) ? item.desktopCategories.slice(0, 32) : [],
  );
  for (const [native, category] of [
    ['WebBrowser', 'internetbrowsers'],
    ['InstantMessaging', 'internetchat'],
    ['Email', 'internetchat'],
    ['IDE', 'softwareide'],
    ['Database', 'softwaredatabase'],
    ['Game', 'games'],
    ['Graphics', 'design'],
    ['Development', 'software'],
    ['Office', 'office'],
    ['Education', 'learning'],
    ['Finance', 'finance'],
    ['AudioVideo', 'media'],
    ['Network', 'systemnetwork'],
  ])
    if (desktopCategories.has(native)) return category;
  const target = unrelatedLaunchHost(item) ? '' : leafName(item.target);
  const fields = [leafName(item.name), target, item.fileDescription, item.desktopDescription];
  const text = fields
    .filter((v) => typeof v === 'string')
    .map((v) => v.slice(0, 1024))
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_./-]+/g, ' ');
  if (/\b(uninstall|uninstaller|updater|setup|installer)\b/.test(text)) return 'systeminstallers';
  if (/\b(llm|diffusion|language model|local model|ai assistant)\b/.test(text))
    return /\b(diffusion|image|video)\b/.test(text) ? 'aicreative' : 'ailocal';
  if (/\b(web browser|internet browser|browser)\b/.test(text)) return 'internetbrowsers';
  if (
    /\b(video|image|photo|vector|graphic|3d|cad)\b.{0,50}\b(editor|editing|design|drawing|model|render)\b/.test(
      text,
    )
  )
    return 'design';
  if (/\b(code|text|source)\b.{0,30}\b(editor|development)\b|\bide\b/.test(text))
    return 'softwareide';
  if (/\b(database|postgresql|mysql|mongodb|redis|sql client|sql manager)\b/.test(text))
    return 'softwaredatabase';
  if (/\b(container|kubernetes|terraform|devops|docker)\b/.test(text)) return 'softwaredevops';
  if (/\b(terminal|ssh client|command shell)\b/.test(text)) return 'softwareterminal';
  if (
    /\b(vpn|firewall|network scanner|ip scanner|remote desktop|remote access|security|antivirus)\b/.test(
      text,
    )
  )
    return 'systemnetwork';
  if (/\b(audio|music|podcast)\b.{0,35}\b(editor|player|record|mix|recording)\b/.test(text))
    return 'media';
  if (/\b(video player|media player)\b/.test(text)) return 'media';
  if (/\b(word processor|spreadsheet|presentation|pdf reader|note taking)\b/.test(text))
    return 'office';
  if (/\b(archive manager|compression|unzip|extractor)\b/.test(text)) return 'systemcompression';
  return null;
}
