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
  let name = String(value)
    .slice(0, 512)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/\.(exe|lnk|url|desktop|appimage|app|webloc|bat|cmd)$/i, '')
    .replace(/\.(exe|lnk)$/i, '');
  // Explorer can append copy, architecture and shortcut labels in either
  // order. Removing them once leaves "Chrome (2) - Shortcut" unidentified.
  // Only recognized decorations are removed; product/version numbers remain.
  for (let pass = 0; pass < 4; pass++) {
    const stripped = name
      .replace(/\s*\(\d+\)\s*$/, '')
      .replace(/(?:\s*[-–—]\s*)?(?:kisayol|shortcut)\s*$/, '')
      .replace(/\s*[([](?:x64|x86|64[ -]?bit|32[ -]?bit)[)\]]\s*$/, '')
      .trim();
    if (stripped === name) break;
    name = stripped;
  }
  return name
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
export function unrelatedLaunchHost(item, target = item.target) {
  return (
    /\.lnk$/i.test(item.name || item.source || '') &&
    launchHosts.has(normalizeAppName(leafName(target))) &&
    normalizeAppName(leafName(item.name || item.source)) !== normalizeAppName(leafName(target))
  );
}
export function gameLaunchCategory(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\x00-\x20\x7f]/.test(value))
    return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.port) return null;
    const protocol = url.protocol.toLowerCase(),
      host = url.hostname.toLowerCase(),
      pathname = url.pathname;
    if (
      (protocol === 'steam:' &&
        ['run', 'rungameid'].includes(host) &&
        /^\/\d+(?:\/|$)/.test(pathname)) ||
      (protocol === 'uplay:' && host === 'launch' && /^\/\d+(?:\/|$)/.test(pathname)) ||
      (protocol === 'com.epicgames.launcher:' &&
        host === 'apps' &&
        /^\/[a-z0-9%:_-]+\/?$/i.test(pathname) &&
        url.searchParams.get('action') === 'launch') ||
      (['origin:', 'link2ea:'].includes(protocol) &&
        host === 'launchgame' &&
        /^\/[a-z0-9%:_-]+\/?$/i.test(pathname))
    )
      return 'games';
  } catch {
    // A malformed InternetShortcut remains an ordinary, manually assignable item.
  }
  return null;
}
export function findKnownApp(item) {
  const name = leafName(item.name || item.source),
    extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  const appLike =
    appExtensions.has(extension) || ['shortcut', 'installed'].includes(item.kind) || !extension;
  if (!appLike) return null;
  // A game shortcut launches through a client but does not identify that client
  // (or another catalog app with the same shortcut label) as the game itself.
  if (gameLaunchCategory(item.launchUrl)) return null;
  const target = leafName(item.target);
  // A product's installation directory does not identify helper executables.
  if ((target && helpers.test(target)) || (!target && helpers.test(name))) return null;
  const productName = typeof item.productName === 'string' ? item.productName : '';
  const candidates = launchHosts.has(normalizeAppName(target))
    ? [name, productName]
    : [target, name, productName];
  for (const candidate of candidates) {
    const normalized = normalizeAppName(candidate);
    const versionless = normalized
      .replace(/\s+v?\d{1,4}(?:\s+\d{1,4}){0,2}$/, '')
      .replace(/\s+v?\d{1,4}(?:\s+\d{1,4}){0,2}(?=\s+(?:pro|studio)$)/, '');
    const app = aliases.get(normalized) || aliases.get(versionless);
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
    'Özel yazılım — uygulama ayrıntılarından manuel açıklama ekleyebilirsin.',
    'Custom software — add your own description in app details.',
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
const nameHints = [
  [
    /ip[ _-]?scan|network.*scan|a[gğ].*tara/i,
    'Adı, yerel ağdaki cihazları veya adresleri taramaya yardımcı olan bir araç olabileceğini düşündürüyor. Bu bir ad tahminidir.',
    'Its name suggests a tool for scanning network devices or addresses. This is a filename-based estimate.',
  ],
  [
    /scanner|scan(?:ning)?|taray[iı]c[iı]/i,
    'Adı, cihazları, dosyaları veya verileri taramaya yardımcı olan bir araç olabileceğini düşündürüyor. Taramanın kapsamı doğrulanmadı.',
    'Its name suggests a tool for scanning devices, files or data. The scope of scanning has not been verified.',
  ],
  [
    /server|sunucu/i,
    'Adı, başka uygulamalara veya cihazlara hizmet sunan bir sunucu bileşeni olabileceğini düşündürüyor. Bu bir ad tahminidir.',
    'Its name suggests a server component that provides services to other apps or devices. This is a filename-based estimate.',
  ],
  [
    /uninstall|unins\d|kald[iı]r/i,
    'Adı, yazılım kaldırma işlemleriyle ilgili bir araç olabileceğini düşündürüyor. Kaldırma kapsamı dosya adından doğrulanamaz.',
    'Its name suggests a software-removal utility. The scope of removal cannot be verified from its filename.',
  ],
  [
    /backup|yedek/i,
    'Adı, dosya veya sistem yedekleme iş akışlarına yardımcı olan bir araç olabileceğini düşündürüyor. Bu bir ad tahminidir.',
    'Its name suggests a utility for file or system backup workflows. This is a filename-based estimate.',
  ],
  [
    /sync|senkron/i,
    'Adı, dosya veya verileri farklı konumlar arasında eşitlemeye yardımcı olan bir araç olabileceğini düşündürüyor.',
    'Its name suggests a utility for synchronizing files or data between locations. This is an estimate.',
  ],
  [
    /terminal|console|command|komut/i,
    'Adı, komutları veya betikleri çalıştırmak için kullanılan bir komut aracı olabileceğini düşündürüyor. Bu bir ad tahminidir.',
    'Its name suggests a command utility for running commands or scripts. This is a filename-based estimate.',
  ],
  [
    /monitor|sensor|izleyici/i,
    'Adı, sistem, donanım veya uygulama durumunu izlemeye yardımcı olan bir araç olabileceğini düşündürüyor.',
    'Its name suggests a tool for monitoring system, hardware or application status. This is an estimate.',
  ],
  [
    /tool|utility|ara[cç]/i,
    'Belirli bir işi kolaylaştıran yardımcı araç olabilir. Kesin işlevi dosya özelliklerinden kontrol edebilir veya kendi açıklamanı ekleyebilirsin.',
    'This may be a utility for a specific task. Check its file properties or add your own description to explain its exact purpose.',
  ],
];
export function appInsight(item, categoryId, manualDescription) {
  if (typeof manualDescription === 'string' && manualDescription.trim())
    return {
      appId: null,
      categoryId,
      confidence: 'manual',
      source: 'manual',
      description: {
        tr: manualDescription.trim().slice(0, 1000),
        en: manualDescription.trim().slice(0, 1000),
      },
    };
  if (gameLaunchCategory(item.launchUrl))
    return {
      appId: null,
      categoryId: 'games',
      confidence: 'inferred',
      source: 'shortcut-protocol',
      description: {
        tr: 'Oyun başlatma bağlantısı içeren bir kısayol. Başlatıcı protokolüne göre oyun grubuna önerilir; oyunun kimliği yerel katalogdan doğrulanmadı.',
        en: 'A shortcut containing a game launch link. Its launcher protocol suggests the games group; the game identity was not verified against the local catalog.',
      },
    };
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
  const nameHint =
    !type &&
    (appExtensions.has(extension) || ['shortcut', 'installed'].includes(item.kind) || !extension)
      ? nameHints.find(([pattern]) =>
          pattern.test(
            leafName(item.name || item.source).slice(0, 512) +
              ' ' +
              leafName(item.target).slice(0, 512),
          ),
        )
      : null;
  const generic = type?.slice(1) ||
    nameHint?.slice(1) ||
    categoryDescriptions[parentCategory(categoryId)] || [
      'Özel öğe — uygulama ayrıntılarından manuel açıklama ekleyebilirsin.',
      'Custom item — add your own description in app details.',
    ];
  return {
    appId: null,
    categoryId,
    confidence: 'inferred',
    source: type ? 'file-type' : nameHint ? 'filename-hint' : 'category',
    description: { tr: generic[0], en: generic[1] },
  };
}

export function resolveAppPurpose(item, manualDescription, metadata) {
  const fallback =
    item.insight?.source === 'manual'
      ? appInsight(item, item.category)
      : item.insight || appInsight(item, item.category);
  if (typeof manualDescription === 'string' && manualDescription.trim())
    return appInsight(item, item.category, manualDescription);
  const raw =
    metadata && Object.hasOwn(metadata, 'purposeDescription')
      ? metadata.purposeDescription
      : metadata?.description;
  const source = metadata?.purposeSource || metadata?.metadataSource;
  const nativeDescription =
    typeof raw === 'string'
      ? raw
          .replace(/[\x00-\x1f\x7f]/g, '')
          .trim()
          .slice(0, 1024)
      : '';
  const titleOnly =
    nativeDescription &&
    [item.name, leafName(item.target), findKnownApp(item)?.name]
      .filter(Boolean)
      .some((name) => normalizeAppName(name) === normalizeAppName(nativeDescription));
  const generic =
    /^(electron|application|app|launcher|bootstrapper|updater|setup|installer|squirrel)( application)?$/i.test(
      nativeDescription,
    );
  if (
    nativeDescription &&
    !titleOnly &&
    !generic &&
    ['windows-version-info', 'windows-shortcut'].includes(source) &&
    (source !== 'windows-version-info' || !unrelatedLaunchHost(item))
  )
    return {
      ...fallback,
      confidence: 'metadata',
      source,
      description: { tr: nativeDescription, en: nativeDescription },
      company: typeof metadata.company === 'string' ? metadata.company.slice(0, 1024) : null,
    };
  return fallback;
}
