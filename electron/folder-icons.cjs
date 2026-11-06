const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const crypto = require('node:crypto');
const { icons } = require('../shared/domain.js');
const { iconPacks } = require('../shared/appearance.js');
const {
  folderThemes,
  folderColorIds,
  resolveFolderTheme,
} = require('../shared/folder-appearance.js');
const { renderFolderIco } = require('./folder-raster.cjs');
const folderIni = (category, theme, resource = '.darkdesk.ico') =>
  Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(
      `[.ShellClassInfo]\r\nIconResource="${resource}",0\r\n;DarkDesk=${theme}/${category.color}/${category.icon}${category.customColor ? '/custom-' + category.customColor.from.slice(1) + '-' + category.customColor.to.slice(1) : ''}\r\n`,
      'utf16le',
    ),
  ]);
class FolderIcons {
  constructor(data, platform = process.platform, options = {}) {
    this.data = data;
    this.platform = platform;
    this.shell = options.shell;
    this.run = options.run || exec;
    this.renderFolderIco = options.renderFolderIco || renderFolderIco;
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
  async folderIconFile(icon = 'folder', color = 'purple', theme = 'gradient') {
    if (!icons.includes(icon) || !folderColorIds.includes(color) || !folderThemes.includes(theme))
      throw Error('FOLDER_APPEARANCE_INVALID');
    return path.join(__dirname, '../build/folder-icons/themes', theme, color, icon + '.ico');
  }
  async folderContents(category, settings) {
    const theme = resolveFolderTheme(category, settings.folderTheme);
    const bytes = category.customColor
      ? await this.renderFolderIco(category, theme)
      : await fs.readFile(await this.folderIconFile(category.icon, category.color, theme));
    // Explorer caches icons by resource path. An immutable content address gives
    // each appearance a new identity while the journal still owns the same pair.
    const directory = path.join(this.data, 'folder-artwork');
    await fs.mkdir(directory, { recursive: true });
    if ((await fs.lstat(directory)).isSymbolicLink()) throw Error('FOLDER_APPEARANCE_INVALID');
    const resource = path.join(
      directory,
      crypto.createHash('sha256').update(bytes).digest('hex') + '.ico',
    );
    try {
      await fs.writeFile(resource, bytes, { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const stat = await fs.lstat(resource);
    if (!stat.isFile() || stat.isSymbolicLink() || !(await fs.readFile(resource)).equals(bytes))
      throw Error('FOLDER_APPEARANCE_INVALID');
    return {
      '.darkdesk.ico': bytes,
      'desktop.ini': folderIni(category, theme, resource),
    };
  }

  async applyAttributes(directory) {
    await this.run('attrib.exe', ['+r', directory, '/l'], { windowsHide: true });
    await this.run('attrib.exe', ['+h', '+s', path.join(directory, 'desktop.ini'), '/l'], {
      windowsHide: true,
    });
    await this.run('attrib.exe', ['+h', path.join(directory, '.darkdesk.ico'), '/l'], {
      windowsHide: true,
    });
  }
  async clearFileAttributes(file) {
    await this.run('attrib.exe', ['-h', '-s', '-r', file, '/l'], { windowsHide: true });
  }
  async notifyChanged(directories) {
    if (this.platform !== 'win32' || !directories.length) return;
    await fs.mkdir(this.data, { recursive: true });
    const file = path.join(this.data, 'folder-refresh-' + crypto.randomUUID() + '.json');
    await fs.writeFile(file, JSON.stringify(directories), { flag: 'wx', mode: 0o600 });
    const encodedFile = Buffer.from(file, 'utf8').toString('base64');
    const script = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class DarkDeskFolderRefresh { [DllImport("shell32.dll", CharSet=CharSet.Unicode)] public static extern void SHChangeNotify(uint change, uint flags, string path, IntPtr extra); }'; $file=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedFile}')); $paths=Get-Content -Raw -LiteralPath $file -Encoding UTF8 | ConvertFrom-Json; foreach($p in $paths){ [DarkDeskFolderRefresh]::SHChangeNotify(0x2000,0x1005,[string]$p,[IntPtr]::Zero) }`;
    try {
      await this.run(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-EncodedCommand',
          Buffer.from(script, 'utf16le').toString('base64'),
        ],
        { windowsHide: true, timeout: 10000, maxBuffer: 64 * 1024 },
      );
    } finally {
      await fs.unlink(file).catch(() => {});
    }
  }
  async decorate(directory, category, settings, onCreated = async () => {}) {
    if (this.platform !== 'win32') return [];
    const contentsByName = await this.folderContents(category, settings);
    const records = [];
    for (const [name, contents] of Object.entries(contentsByName)) {
      const file = path.join(directory, name);
      await fs.writeFile(file, contents, { flag: 'wx' });
      const record = {
        path: file,
        checksum: crypto.createHash('sha256').update(contents).digest('hex'),
      };
      records.push(record);
      await onCreated(record);
    }
    await this.applyAttributes(directory);
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
    } else if (this.platform === 'linux' && item.extension === '.desktop') {
      await fs.copyFile(item.source, destination);
      await fs.chmod(destination, 0o755);
    } else if (this.platform === 'linux') {
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
