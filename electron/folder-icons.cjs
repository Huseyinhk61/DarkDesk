const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const crypto = require('node:crypto');
const { icons } = require('../shared/domain.js');
const { iconPacks } = require('../shared/appearance.js');
class FolderIcons {
  constructor(data, platform = process.platform, options = {}) {
    this.data = data;
    this.platform = platform;
    this.shell = options.shell;
    this.run = options.run || exec;
  }
  async iconFile(icon, pack) {
    if (!icons.includes(icon) || !iconPacks.includes(pack)) throw Error('ICON_INVALID');
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
    await this.run('attrib.exe', ['+r', directory], { windowsHide: true });
    await this.run('attrib.exe', ['+h', '+s', path.join(directory, 'desktop.ini')], {
      windowsHide: true,
    });
    await this.run('attrib.exe', ['+h', path.join(directory, '.darkdesk.ico')], {
      windowsHide: true,
    });
    return records;
  }
  async removeAttributes(directory) {
    if (this.platform === 'win32')
      await this.run('attrib.exe', ['-r', directory], { windowsHide: true });
  }
  async shortcut(destination, item, icon) {
    if (this.platform === 'win32') {
      const extension = path.extname(item.source).toLowerCase();
      // Cloning an existing shortcut keeps custom icon resources, launch arguments,
      // app identity and URL protocol details that cannot be reconstructed from its name.
      if (extension === '.lnk' && !icon) {
        await fs.copyFile(item.source, destination);
        return;
      }
      if (extension === '.url') {
        if (!icon) await fs.copyFile(item.source, destination);
        else {
          const contents = await fs.readFile(item.source);
          const unicode = contents[0] === 0xff && contents[1] === 0xfe;
          const text = (
            unicode ? contents.subarray(2).toString('utf16le') : contents.toString('utf8')
          ).replace(/^Icon(?:File|Index)=.*(?:\r?\n|$)/gim, '');
          const output = text.trimEnd() + `\r\nIconFile=${icon}\r\nIconIndex=0\r\n`;
          await fs.writeFile(
            destination,
            unicode
              ? Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(output, 'utf16le')])
              : output,
          );
        }
        return;
      }
      const shell = this.shell || require('electron').shell;
      let original = {};
      if (extension === '.lnk') {
        try {
          original = shell.readShortcutLink(item.source);
        } catch {}
      }
      const target = original.target || item.target || item.source;
      if (
        !shell.writeShortcutLink(destination, 'create', {
          ...original,
          target,
          args: original.args ?? item.arguments ?? '',
          cwd: original.cwd || item.workingDirectory || path.dirname(target),
          icon: icon || original.icon || item.icon || target,
          iconIndex: icon ? 0 : (original.iconIndex ?? item.iconIndex ?? 0),
          description: original.description || item.name,
        })
      )
        throw Error('SHORTCUT_FAILED');
    } else if (this.platform === 'linux' && item.extension === '.desktop')
      await fs.copyFile(item.source, destination);
    else if (this.platform === 'linux') {
      const quote = (value) => '"' + value.replace(/%/g, '%%').replace(/([\\"`$])/g, '\\$1') + '"';
      await fs.writeFile(
        destination,
        `[Desktop Entry]\nType=Application\nName=${item.name.replace(/[\r\n]/g, ' ')}\nExec=${quote(item.target || item.source)}\nIcon=${icon || item.target || item.source}\nTerminal=false\n`,
        { flag: 'w', mode: 0o755 },
      );
    } else throw Error('SHORTCUT_UNSUPPORTED');
  }
}
module.exports = { FolderIcons };
