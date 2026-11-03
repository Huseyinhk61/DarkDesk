const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const SCRIPT = `[Console]::InputEncoding=[System.Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false);$ErrorActionPreference='Stop';try{$v=[Console]::In.ReadToEnd()|ConvertFrom-Json;$notify=$false;if($v.action -eq 'set'){try{Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class DarkDeskShell{[DllImport("shell32.dll",CharSet=CharSet.Unicode)]public static extern void SHChangeNotify(uint e,uint f,string p,IntPtr p2);}';$notify=$true}catch{}};$results=@();foreach($item in $v.items){$a=[int][System.IO.File]::GetAttributes($item.path);$h=(($a -band 2) -ne 0);if($v.action -eq 'set' -and $h -ne $item.hidden){if($item.hidden){$a=$a -bor 2}else{$a=$a -band (-bnot 2)};[System.IO.File]::SetAttributes($item.path,[System.IO.FileAttributes]$a);if($notify){[DarkDeskShell]::SHChangeNotify(0x800,0x5,$item.path,[IntPtr]::Zero)};$h=$item.hidden};$results+=@{path=$item.path;hidden=$h}};ConvertTo-Json -InputObject @($results) -Compress}catch{[Console]::Error.WriteLine($_.Exception.Message);exit 1}`;
function powershell(value) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SCRIPT], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(Error('VISIBILITY_FAILED'));
    }, 30000);
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.resume();
    child.on('error', () => {
      clearTimeout(timer);
      reject(Error('VISIBILITY_FAILED'));
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(Error('VISIBILITY_FAILED'));
      try {
        resolve(JSON.parse(output.replace(/^\uFEFF/, '')));
      } catch {
        reject(Error('VISIBILITY_FAILED'));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(value));
  });
}
class VisibilityAdapter {
  constructor(desktop, platform = process.platform) {
    this.desktop = desktop;
    this.platform = platform;
    this.file = path.join(desktop, '.hidden');
  }
  async lines() {
    try {
      const stat = await fs.lstat(this.file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw Error('VISIBILITY_FAILED');
      return (await fs.readFile(this.file, 'utf8')).split(/\r?\n/).filter(Boolean);
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }
  async readMany(files) {
    if (!files.length) return [];
    if (this.platform === 'win32')
      return powershell({ action: 'get', items: files.map((path) => ({ path })) });
    if (this.platform !== 'linux') throw Error('VISIBILITY_UNSUPPORTED');
    const lines = new Set(await this.lines());
    return files.map((file) => ({ path: file, hidden: lines.has(path.basename(file)) }));
  }
  async setMany(items) {
    if (!items.length) return;
    if (this.platform === 'win32') {
      await powershell({ action: 'set', items });
      return;
    }
    if (this.platform !== 'linux') throw Error('VISIBILITY_UNSUPPORTED');
    const original = await this.lines(),
      set = new Set(original);
    for (const item of items) {
      const name = path.basename(item.path);
      if (/[\r\n]/.test(name) || path.dirname(item.path) !== this.desktop)
        throw Error('VISIBILITY_UNSUPPORTED');
      item.hidden ? set.add(name) : set.delete(name);
    }
    const lines = [...set];
    if (lines.join('\n') === original.join('\n')) return;
    if (!set.size) {
      await fs.unlink(this.file).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
      });
      return;
    }
    const temporary = this.file + '.' + crypto.randomUUID() + '.tmp';
    await fs.writeFile(temporary, lines.join('\n') + '\n', { flag: 'wx' });
    await fs.rename(temporary, this.file);
  }
  async get(file) {
    return (await this.readMany([file]))[0].hidden;
  }
  async set(file, hidden) {
    return this.setMany([{ path: file, hidden }]);
  }
}
module.exports = { VisibilityAdapter, SCRIPT };
