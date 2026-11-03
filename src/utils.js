export function formatBytes(
  value = 0,
  locale = document.documentElement.lang === 'en' ? 'en-US' : 'tr-TR',
) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 3);
  return `${(value / 1024 ** index).toLocaleString(locale, { maximumFractionDigits: index ? 1 : 0 })} ${['B', 'KB', 'MB', 'GB'][index]}`;
}
export function isShortcut(item) {
  return (
    item.kind === 'shortcut' ||
    item.kind === 'installed' ||
    /\.(lnk|url|desktop|webloc)$/i.test(item.name)
  );
}
export function canUndo(history) {
  return history.some((batch) => batch.status !== 'undone');
}
