const fs = require('node:fs/promises');
const path = require('node:path');

const defaults = {
  mode: 'move',
  autoScan: true,
  excludedExtensions: ['.ini', '.tmp'],
  overrides: {},
};
function validateSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Geçersiz ayar biçimi.');
  const { mode, autoScan, excludedExtensions, overrides = {} } = value;
  if (!['move', 'copy'].includes(mode) || typeof autoScan !== 'boolean')
    throw Error('Geçersiz düzenleme ayarı.');
  if (
    !Array.isArray(excludedExtensions) ||
    excludedExtensions.length > 50 ||
    excludedExtensions.some((x) => typeof x !== 'string' || !/^\.[a-z0-9]{1,12}$/i.test(x))
  )
    throw Error('Uzantıları .tmp, .ini biçiminde girin.');
  if (
    !overrides ||
    typeof overrides !== 'object' ||
    Array.isArray(overrides) ||
    Object.keys(overrides).length > 5000
  )
    throw Error('Geçersiz kategori tercihleri.');
  for (const [name, category] of Object.entries(overrides)) {
    if (
      !name ||
      /[\\/\0]/.test(name) ||
      !Number.isInteger(category) ||
      category < 0 ||
      category > 4
    )
      throw Error('Geçersiz kategori tercihi.');
  }
  return {
    mode,
    autoScan,
    excludedExtensions: [...new Set(excludedExtensions.map((x) => x.toLowerCase()))],
    overrides,
  };
}
class SettingsStore {
  constructor(directory) {
    this.file = path.join(directory, 'settings.json');
  }
  async read() {
    try {
      return validateSettings(JSON.parse(await fs.readFile(this.file, 'utf8')));
    } catch (error) {
      if (error.code === 'ENOENT') return structuredClone(defaults);
      throw Error('Ayarlar okunamadı. settings.json dosyasını kontrol edin: ' + error.message);
    }
  }
  async write(settings) {
    const value = validateSettings(settings);
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file + '.tmp', JSON.stringify(value, null, 2), { mode: 0o600 });
    await fs.rename(this.file + '.tmp', this.file);
    return value;
  }
}
module.exports = { SettingsStore, defaults, validateSettings };
