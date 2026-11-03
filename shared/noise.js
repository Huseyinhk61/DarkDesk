import { normalize } from './domain.js';
export function skipDirectory(name, filters) {
  return (
    filters?.excludedDirectories || [
      'System32',
      'AppData',
      'Temp',
      'node_modules',
      '.git',
      'cache',
      'caches',
      'locales',
      'WinSxS',
    ]
  ).some((value) => normalize(value) === normalize(name));
}
export function skipIndexedFile(name, filters) {
  const text = normalize(name);
  if (
    (filters?.allowedNames || []).some((v) =>
      text.replace(/[^a-z0-9]/g, '').includes(normalize(v).replace(/[^a-z0-9]/g, '')),
    )
  )
    return false;
  return (
    /^(unins\d*|uninstall|setup|install|crashpad_handler|crashreporter|update|updater|maintenance|notification_helper)\.(exe|lnk)$/i.test(
      name,
    ) ||
    (filters?.excludedNames || []).some((v) =>
      text.replace(/[^a-z0-9]/g, '').includes(normalize(v).replace(/[^a-z0-9]/g, '')),
    )
  );
}
