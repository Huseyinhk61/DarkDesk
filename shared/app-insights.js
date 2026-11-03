import knowledge from './app-knowledge.json' with { type: 'json' };

const appExtensions = new Set([
  'exe',
  'lnk',
  'url',
  'desktop',
  'app',
  'appimage',
  'webloc',
  'bat',
  'cmd',
]);
const helpers =
  /(?:^|[ ._-])(unins\d*|uninstall(?:er)?|updat(?:e|er)|crash(?:pad|reporter)?|notification[ ._-]?helper)(?:$|[ ._-])/i;
export function leafName(value = '') {
  let text = String(value).slice(0, 8192).trim();
  const quoted = /^"([^"]+)"(?:\s|$)/.exec(text);
  if (quoted) text = quoted[1];
  else text = text.replace(/(\.exe)\s+.*$/i, '$1');
  return text.replace(/\\/g, '/').split('/').at(-1) || '';
}
export function normalizeAppName(value) {
  return String(value)
    .slice(0, 512)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/\.(exe|lnk|url|desktop|appimage|app|webloc|bat|cmd)$/i, '')
    .replace(/\.(exe|lnk)$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/(?:\s*[-–—]\s*)?(?:kisayol|shortcut)\s*$/, '')
    .replace(/\s*[([](?:x64|x86|64[ -]?bit|32[ -]?bit)[)\]]\s*$/, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
const aliases = new Map();
for (const app of knowledge)
  for (const alias of [app.name, ...app.aliases]) aliases.set(normalizeAppName(alias), app);
export { knowledge as appKnowledge };
// A launch host may open another application, game or script. Its target alone
// cannot identify the purpose of a differently named shortcut.
const launchHosts = new Set([
  'explorer',
  'rundll32',
  'cmd',
  'powershell',
  'pwsh',
  'wscript',
  'cscript',
  'java',
  'javaw',
  'dotnet',
  'python',
  'pythonw',
  'node',
  'steam',
  'epicgameslauncher',
  'riotclientservices',
  'eadesktop',
  'ubisoftconnect',
  'upc',
  'galaxyclient',
]);
export function findKnownApp(item) {
  const name = leafName(item.name || item.source),
    extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  const appLike =
    appExtensions.has(extension) || ['shortcut', 'installed'].includes(item.kind) || !extension;
  if (!appLike) return null;
  const target = leafName(item.target);
  // A product's installation directory does not identify helper executables.
  if ((target && helpers.test(target)) || (!target && helpers.test(name))) return null;
  const productName = typeof item.productName === 'string' ? item.productName : '';
  const candidates = launchHosts.has(normalizeAppName(target))
    ? [name, productName]
    : [target, name, productName];
  for (const candidate of candidates) {
    const app = aliases.get(normalizeAppName(candidate));
    if (app) return app;
  }
  return null;
}
const categoryDescriptions = {
  internet: [
    'Ad ve sınıflandırma kurallarına göre web erişimi veya iletişimle ilgili olabilir. Bu bir kategori tahminidir.',
    'Name and classification rules suggest web access or communication. This is a category-based estimate.',
  ],
  learning: [
    'Ad ve dosya türüne göre öğrenme veya okuma içeriği olabilir. Bu bir kategori tahminidir; içerik okunmadı.',
    'Name and file type suggest learning or reading material. This is a category-based estimate; content was not read.',
  ],
  finance: [
    'Ad ve dosya türüne göre bütçe veya muhasebe işleriyle ilgili olabilir. Bu bir kategori tahminidir; içerik okunmadı.',
    'Name and file type suggest budgeting or bookkeeping. This is a category-based estimate; content was not read.',
  ],
  software: [
    'Ad ve sınıflandırma kurallarına göre geliştirme aracı olabilir. Uygulamaya özgü açıklama yerel katalogda bulunamadı.',
    'Name and classification rules suggest a development tool. No app-specific description was found in the local catalog.',
  ],
  design: [
    'Ad ve sınıflandırma kurallarına göre görsel tasarım veya video çalışmalarıyla ilgili olabilir. Bu bir kategori tahminidir.',
    'Name and classification rules suggest visual design or video work. This is a category-based estimate.',
  ],
  games: [
    'Ad ve sınıflandırma kurallarına göre oyun veya eğlenceyle ilgili olabilir. Bu bir kategori tahminidir.',
    'Name and classification rules suggest gaming or entertainment. This is a category-based estimate.',
  ],
  office: [
    'Ad ve sınıflandırma kurallarına göre belge, not veya ofis işleriyle ilgili olabilir. Bu bir kategori tahminidir.',
    'Name and classification rules suggest documents, notes or office work. This is a category-based estimate.',
  ],
  system: [
    'Bu uygulamanın amacı adından güvenilir biçimde belirlenemedi. Önerilen grubu ve dosya konumunu kontrol edin.',
    'The purpose of this app could not be reliably identified from its name. Check its suggested group and file location.',
  ],
  media: [
    'Ad ve sınıflandırma kurallarına göre ses veya medya çalışmalarıyla ilgili olabilir. Bu bir kategori tahminidir.',
    'Name and classification rules suggest audio or media work. This is a category-based estimate.',
  ],
  archive: [
    'Bu öğe arşiv grubuna atanmış. Dosyanın işlevi bu atamadan belirlenemez.',
    'This item is assigned to the archive group. Its function cannot be determined from that assignment.',
  ],
};
const files = [
  [
    ['pdf'],
    'PDF belgesi. İçeriği okunmadan yalnızca dosya türü açıklanır.',
    'A PDF document. This description is based on file type; its content was not read.',
  ],
  [
    ['doc', 'docx', 'odt', 'rtf', 'txt', 'md'],
    'Metin veya belge dosyası. Not, rapor ya da yazılı içerik saklamak için kullanılabilir.',
    'A text or document file that can contain notes, reports or other written content.',
  ],
  [
    ['xls', 'xlsx', 'ods', 'csv'],
    'Tablo veya veri dosyası. Tabloları, listeleri veya hesaplama verilerini saklamak için kullanılabilir.',
    'A spreadsheet or data file that can hold tables, lists or calculation data.',
  ],
  [
    ['ppt', 'pptx', 'odp'],
    'Sunum dosyası. Slaytlar ve sunum içeriği saklamak için kullanılabilir.',
    'A presentation file that can hold slides and presentation content.',
  ],
  [
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'psd', 'ai', 'sketch'],
    'Görsel veya tasarım dosyası. Açıklama yalnızca uzantıya dayanır; görüntü içeriği analiz edilmez.',
    'An image or design file. This is based only on its extension; image content was not analyzed.',
  ],
  [
    ['mp3', 'wav', 'flac', 'aac', 'ogg', 'mp4', 'mkv', 'mov', 'avi', 'webm'],
    'Ses veya video dosyası. Açıklama dosya türüne dayanır; medya içeriği analiz edilmez.',
    'An audio or video file. This description uses the file type; media content was not analyzed.',
  ],
  [
    ['zip', 'rar', '7z', 'tar', 'gz'],
    'Sıkıştırılmış arşiv dosyası. Bir veya daha fazla dosyayı birlikte saklamak için kullanılabilir.',
    'A compressed archive that can store one or more files together.',
  ],
  [
    ['js', 'jsx', 'ts', 'tsx', 'py', 'go', 'rs', 'sql', 'html', 'css', 'json', 'sh'],
    'Kaynak kodu veya yapılandırma dosyası. Açıklama uzantıya dayanır; dosya içeriği okunmaz.',
    'A source code or configuration file. This description uses its extension; file content was not read.',
  ],
];
const parentCategory = (id) =>
  ['software', 'system', 'internet', 'learning', 'finance'].find((root) => id?.startsWith(root)) ||
  id;
export function appInsight(item, categoryId) {
  const app = findKnownApp(item);
  if (app)
    return {
      appId: app.id,
      displayName: app.name,
      categoryId: app.categoryId,
      confidence: 'known',
      source: 'local-catalog',
      description: app.description,
    };
  const extension = /\.([a-z0-9]+)$/i.exec(item.name || '')?.[1]?.toLowerCase();
  const type = files.find(([extensions]) => extensions.includes(extension));
  const generic = type?.slice(1) ||
    categoryDescriptions[parentCategory(categoryId)] || [
      'Bu öğenin işlevi yerel katalogda bulunamadı. Hedef klasörü ve dosya konumunu kontrol edin.',
      'The purpose of this item was not found in the local catalog. Check its destination group and file location.',
    ];
  return {
    appId: null,
    categoryId,
    confidence: 'inferred',
    source: type ? 'file-type' : 'category',
    description: { tr: generic[0], en: generic[1] },
  };
}
