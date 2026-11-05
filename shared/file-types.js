const groups = {
  office: [
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'pdf',
    'txt',
    'csv',
    'md',
    'odt',
    'ods',
    'odp',
    'rtf',
  ],
  design: ['jpg', 'jpeg', 'png', 'svg', 'psd', 'ai', 'webp', 'gif', 'sketch'],
  software: ['js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'go', 'rs', 'sql', 'sh'],
  media: ['mp3', 'mp4', 'wav', 'flac', 'aac', 'ogg', 'mov', 'mkv', 'avi', 'webm'],
  systemcompression: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'],
  learningreading: ['epub', 'mobi', 'azw', 'azw3', 'djvu'],
};
const categories = new Map(
  Object.entries(groups).flatMap(([id, extensions]) =>
    extensions.map((extension) => [extension, id]),
  ),
);

// Filenames are metadata only. A title mentioning an installer, game or product
// does not change a recognized document, source file, image, or media format.
export function fileTypeCategory(name) {
  const extension = /\.([a-z0-9]+)$/i.exec(String(name || ''))?.[1]?.toLowerCase();
  return categories.get(extension) || null;
}
