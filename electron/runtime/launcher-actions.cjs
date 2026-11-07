const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { StringDecoder } = require('node:string_decoder');
const { buildWebSearch } = require('../../shared/launcher-tools.js');

const executeFile = promisify(execFile);
const systemActions = Object.freeze([
  'empty-trash',
  'lock',
  'shutdown',
  'mute',
  'unmute',
  'volume-up',
  'volume-down',
  'screenshot',
  'wifi-on',
  'wifi-off',
  'night-light',
  'clean-space',
]);
const confirmationActions = new Set(['empty-trash', 'shutdown']);
const coded = (code) => Object.assign(Error(code), { code });
const plain = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) =>
  typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\0');

function webSearch(provider, query) {
  if (!text(query, 512)) throw coded('LAUNCHER_INPUT_INVALID');
  try {
    return buildWebSearch(provider, query);
  } catch {
    throw coded('LAUNCHER_INPUT_INVALID');
  }
}

// The scripts are fixed. Values arrive as bounded JSON over stdin and are
// passed as data to Start-Process, never interpolated into PowerShell source.
const ADMIN_SCRIPT = `[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);$ErrorActionPreference='Stop';try{$v=[Console]::In.ReadToEnd()|ConvertFrom-Json;$p=@{FilePath=[string]$v.target;Verb='RunAs';ErrorAction='Stop'};if($v.arguments){$p.ArgumentList=[string]$v.arguments};if($v.cwd){$p.WorkingDirectory=[string]$v.cwd};Start-Process @p}catch{exit 1}`;
const TRASH_SCRIPT = `$ErrorActionPreference='Stop';try{$shell=New-Object -ComObject Shell.Application;$bin=$shell.Namespace(10);if($null -eq $bin){throw 'Recycle Bin unavailable'};if($bin.Items().Count -gt 0){Clear-RecycleBin -Force -ErrorAction Stop}}catch{exit 1}`;
const { AUDIO_SCRIPT, WIFI_SCRIPT } = require('./windows-audio.cjs');
const MUTE_SCRIPT = AUDIO_SCRIPT;

function powershell(script, value, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawnProcess(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64'),
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const decoder = new StringDecoder('utf8');
    let bytes = 0;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(coded('LAUNCHER_ACTION_FAILED'));
    }, 60000);
    const read = (chunk) => {
      bytes += chunk.length;
      decoder.write(chunk);
      if (bytes > 64 * 1024) {
        child.kill();
        finish(coded('LAUNCHER_ACTION_FAILED'));
      }
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.on('error', () => finish(coded('LAUNCHER_ACTION_FAILED')));
    child.on('close', (code) => {
      decoder.end();
      finish(code === 0 ? null : coded('LAUNCHER_ACTION_FAILED'));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(value ? JSON.stringify(value) : '');
  });
}

class LauncherActions {
  constructor({
    platform = process.platform,
    shell,
    clipboard,
    resolveItem,
    resolveShortcut,
    execute = executeFile,
    executePowerShell = powershell,
    beforeShutdown = async () => {},
    clock = () => Date.now(),
    token = () => crypto.randomBytes(24).toString('hex'),
  } = {}) {
    Object.assign(this, {
      platform,
      shell,
      clipboard,
      resolveItem,
      resolveShortcut,
      execute,
      executePowerShell,
      beforeShutdown,
      clock,
      token,
    });
    this.pending = new Map();
  }
  capabilities() {
    return {
      system: this.platform === 'win32' ? [...systemActions] : [],
      admin: this.platform === 'win32',
      reveal: typeof this.shell?.showItemInFolder === 'function',
      web: typeof this.shell?.openExternal === 'function',
      copy: typeof this.clipboard?.writeText === 'function',
    };
  }
  async trusted(id) {
    if (!text(id, 512)) throw coded('SOURCE_MISSING');
    const item = await this.resolveItem(id);
    if (!item || !text(item.source, 32768) || !path.isAbsolute(item.source))
      throw coded('SOURCE_MISSING');
    const stat = await fs.lstat(item.source).catch((error) => {
      throw coded(error.code === 'ENOENT' ? 'SOURCE_MISSING' : 'LAUNCHER_ACTION_FAILED');
    });
    if (!stat.isFile() || stat.isSymbolicLink()) throw coded('SOURCE_MISSING');
    if (
      (Number.isFinite(item.size) && stat.size !== item.size) ||
      (Number.isFinite(item.modified) && stat.mtimeMs !== item.modified)
    )
      throw coded('LAUNCHER_SOURCE_CHANGED');
    return item;
  }
  prepare(id) {
    if (this.platform !== 'win32') throw coded('LAUNCHER_UNSUPPORTED');
    if (!confirmationActions.has(id)) throw coded('LAUNCHER_INPUT_INVALID');
    const now = this.clock();
    for (const [key, value] of this.pending) if (value.expiresAt <= now) this.pending.delete(key);
    if (this.pending.size >= 32) this.pending.delete(this.pending.keys().next().value);
    const token = this.token(),
      expiresAt = now + 30000;
    this.pending.set(token, { id, expiresAt });
    return { token, id, expiresAt };
  }
  async system(id, confirmed = false) {
    if (this.platform !== 'win32') throw coded('LAUNCHER_UNSUPPORTED');
    if (!systemActions.includes(id)) throw coded('LAUNCHER_INPUT_INVALID');
    if (confirmationActions.has(id) && !confirmed) throw coded('LAUNCHER_CONFIRM_REQUIRED');
    if (id === 'empty-trash') await this.executePowerShell(TRASH_SCRIPT);
    if (['mute', 'unmute', 'volume-up', 'volume-down'].includes(id))
      await this.executePowerShell(AUDIO_SCRIPT, { action: id });
    if (['wifi-on', 'wifi-off'].includes(id))
      await this.executePowerShell(WIFI_SCRIPT, { action: id });
    const uri = {
      screenshot: 'ms-screenclip:',
      'night-light': 'ms-settings:nightlight',
      'clean-space': 'ms-settings:storagesense',
    }[id];
    if (uri) await this.shell.openExternal(uri);
    if (id === 'lock')
      await this.execute('rundll32.exe', ['user32.dll,LockWorkStation'], {
        windowsHide: true,
        timeout: 15000,
      });
    if (id === 'shutdown') {
      await this.beforeShutdown();
      await this.execute('shutdown.exe', ['/s', '/t', '0'], { windowsHide: true, timeout: 15000 });
    }
    return { type: 'system', id, requested: true };
  }
  async admin(id) {
    if (this.platform !== 'win32') throw coded('LAUNCHER_UNSUPPORTED');
    const item = await this.trusted(id);
    const extension = path.extname(item.source).toLowerCase();
    if (!['.exe', '.lnk'].includes(extension)) throw coded('LAUNCHER_ADMIN_UNSUPPORTED');
    const shortcut = extension === '.lnk' ? await this.resolveShortcut?.(item.source) : null;
    const target = extension === '.exe' ? item.source : shortcut?.target;
    if (
      !text(target, 32768) ||
      !path.isAbsolute(target) ||
      path.extname(target).toLowerCase() !== '.exe'
    )
      throw coded('LAUNCHER_ADMIN_UNSUPPORTED');
    const targetStat = await fs.lstat(target);
    if (!targetStat.isFile() || targetStat.isSymbolicLink())
      throw coded('LAUNCHER_ADMIN_UNSUPPORTED');
    const args = shortcut?.args ?? item.arguments ?? '';
    if (typeof args !== 'string' || args.length > 16384 || /[\0\r\n]/.test(args))
      throw coded('LAUNCHER_INPUT_INVALID');
    const cwd = shortcut?.cwd || item.workingDirectory || path.dirname(target);
    if (!text(cwd, 32768) || !path.isAbsolute(cwd)) throw coded('LAUNCHER_INPUT_INVALID');
    const directory = await fs.lstat(cwd);
    if (!directory.isDirectory() || directory.isSymbolicLink())
      throw coded('LAUNCHER_ADMIN_UNSUPPORTED');
    await this.executePowerShell(ADMIN_SCRIPT, { target, arguments: args, cwd });
    return { type: 'admin', id, requested: true };
  }
  async action(input) {
    if (!plain(input)) throw coded('LAUNCHER_INPUT_INVALID');
    if (input.type === 'copy') {
      if (!this.capabilities().copy) throw coded('LAUNCHER_UNSUPPORTED');
      if (!text(input.text, 16384)) throw coded('LAUNCHER_INPUT_INVALID');
      this.clipboard.writeText(input.text);
      return { type: 'copy', copied: true };
    }
    if (input.type === 'web') {
      if (!this.capabilities().web) throw coded('LAUNCHER_UNSUPPORTED');
      const url = webSearch(input.provider, input.query);
      await this.shell.openExternal(url);
      return { type: 'web', opened: true };
    }
    if (input.type === 'reveal') {
      if (!this.capabilities().reveal) throw coded('LAUNCHER_UNSUPPORTED');
      const item = await this.trusted(input.id);
      this.shell.showItemInFolder(item.source);
      return { type: 'reveal', id: input.id, requested: true };
    }
    if (input.type === 'admin') return this.admin(input.id);
    if (input.type === 'prepare-system') return this.prepare(input.id);
    if (input.type === 'confirm-system') {
      if (!text(input.token, 128)) throw coded('LAUNCHER_CONFIRM_EXPIRED');
      const pending = this.pending.get(input.token);
      this.pending.delete(input.token);
      if (!pending || pending.expiresAt <= this.clock()) throw coded('LAUNCHER_CONFIRM_EXPIRED');
      return this.system(pending.id, true);
    }
    if (input.type === 'system') return this.system(input.id);
    throw coded('LAUNCHER_INPUT_INVALID');
  }
}

module.exports = {
  LauncherActions,
  webSearch,
  powershell,
  ADMIN_SCRIPT,
  TRASH_SCRIPT,
  MUTE_SCRIPT,
};
