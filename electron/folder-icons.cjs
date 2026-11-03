const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const crypto = require('node:crypto');
const { icons } = require('../shared/domain.js');
class FolderIcons {
  constructor(data, platform = process.platform) {
    this.data = data;
    this.platform = platform;
  }
  async iconFile(icon, pack) {
    if (!icons.includes(icon) || !['lucide', 'tabler', 'minimal'].includes(pack))
      throw Error('ICON_INVALID');
    const directory = path.join(this.data, 'icons', pack);
    await fs.mkdir(directory, { recursive: true });
    const output = path.join(directory, icon + '.ico');
    try {
      await fs.copyFile(
        path.join(__dirname, '../build/folder-icons', pack, icon + '.ico'),
        output,
        require('node:fs').constants.COPYFILE_EXCL,
      );
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    return output;
  }
  async decorate(directory, category, settings, onCreated = async () => {}) {
    if (this.platform !== 'win32') return [];
    const source = await this.iconFile(category.icon, settings.iconPack);
    const records = [];
    for (const [name, contents] of [
      ['.darkdesk.ico', await fs.readFile(source)],
      [
        'desktop.ini',
        Buffer.concat([
          Buffer.from([0xff, 0xfe]),
          Buffer.from('[.ShellClassInfo]\r\nIconResource=.darkdesk.ico,0\r\n', 'utf16le'),
        ]),
      ],
    ]) {
      const file = path.join(directory, name);
      await fs.writeFile(file, contents, { flag: 'wx' });
      const record = {
        path: file,
        checksum: crypto.createHash('sha256').update(contents).digest('hex'),
      };
      records.push(record);
      await onCreated(record);
    }
    await exec('attrib.exe', ['+r', directory], { windowsHide: true });
    await exec('attrib.exe', ['+h', '+s', path.join(directory, 'desktop.ini')], {
      windowsHide: true,
    });
    await exec('attrib.exe', ['+h', path.join(directory, '.darkdesk.ico')], { windowsHide: true });
    return records;
  }
  async removeAttributes(directory) {
    if (this.platform === 'win32')
      await exec('attrib.exe', ['-r', directory], { windowsHide: true });
  }
  async shortcut(destination, item, icon) {
    if (this.platform === 'win32') {
      const { shell } = require('electron');
      if (
        !shell.writeShortcutLink(destination, 'create', {
          target: item.target || item.source,
          args: item.arguments || '',
          cwd: item.workingDirectory || path.dirname(item.target || item.source),
          icon,
          iconIndex: 0,
          description: item.name,
        })
      )
        throw Error('SHORTCUT_FAILED');
    } else if (this.platform === 'linux' && item.extension === '.desktop')
      await fs.copyFile(item.source, destination);
    else if (this.platform === 'linux') {
      const quote = (value) => '"' + value.replace(/%/g, '%%').replace(/([\\"`$])/g, '\\$1') + '"';
      await fs.writeFile(
        destination,
        `[Desktop Entry]\nType=Application\nName=${item.name.replace(/[\r\n]/g, ' ')}\nExec=${quote(item.target || item.source)}\nIcon=${icon}\nTerminal=false\n`,
        { flag: 'w', mode: 0o755 },
      );
    } else throw Error('SHORTCUT_UNSUPPORTED');
  }
}
module.exports = { FolderIcons };
