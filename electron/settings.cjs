const fs = require('node:fs/promises');
const path = require('node:path');
const {
  defaultSettings,
  defaultCategories,
  icons,
  colors,
  safeSegment,
  categorySegments,
  categoryId,
} = require('../shared/domain.js');
const { validateSettings } = require('../shared/validate.js');
const defaults = validateSettings(defaultSettings);

class SettingsStore {
  constructor(directory) {
    this.file = path.join(directory, 'settings.json');
  }
  async read() {
    try {
      return validateSettings(JSON.parse(await fs.readFile(this.file, 'utf8')));
    } catch (e) {
      if (e.code === 'ENOENT') return structuredClone(defaults);
      throw Error('SETTINGS_READ: ' + e.message);
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
