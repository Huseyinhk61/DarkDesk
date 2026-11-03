const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const { classify } = require('../shared/domain.js');
const REGISTRY_SCRIPT = `$ErrorActionPreference='SilentlyContinue'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $OutputEncoding=[Console]::OutputEncoding; $result=@(); foreach($root in @('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths')) { Get-ChildItem -LiteralPath $root | ForEach-Object { $v=$_.GetValue(''); if($v){ $result+=@{executable=[string]$v} } } }; foreach($root in @('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall')) { Get-ItemProperty -Path ($root+'\\*') | ForEach-Object { if($_.InstallLocation){$result+=@{directory=[string]$_.InstallLocation}}; if($_.DisplayIcon){$result+=@{executable=[string]$_.DisplayIcon}} } }; ConvertTo-Json -InputObject @($result) -Compress`;
async function registryApps(signal) {
  const { stdout } = await exec(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', REGISTRY_SCRIPT],
    { windowsHide: true, timeout: 15000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8', signal },
  );
  const parsed = JSON.parse(stdout.replace(/^\uFEFF/, ''));
  return Array.isArray(parsed) ? parsed : [];
}
function windowsRoots(env = process.env) {
  const roots = [];
  const add = (value, label) => {
    if (value) roots.push({ path: value, label });
  };
  if (env.APPDATA)
    add(path.join(env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'), 'startUser');
  if (env.ProgramData)
    add(
      path.join(env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      'startCommon',
    );
  add(env.ProgramFiles, 'programFiles');
  add(env['ProgramFiles(x86)'], 'programFilesX86');
  return roots;
}
class DeepScanner {
  constructor(options = {}) {
    this.platform = options.platform || process.platform;
    this.limits = {
      directories: options.maxDirectories || 100000,
      results: options.maxResults || 10000,
      depth: options.maxDepth ?? 12,
    };
    this.registryEnabled = options.registryEnabled ?? !options.roots;
    this.roots = options.roots;
    this.registry = options.registry || registryApps;
    this.resolveShortcut = options.resolveShortcut;
    this.onProgress = options.onProgress || (() => {});
    this.catalog = new Map();
    this.running = false;
    this.cancelled = false;
  }
  cancel() {
    this.cancelled = true;
    this.abort?.abort();
  }
  async scan(settings) {
    if (this.running) throw Error('SCAN_BUSY');
    this.running = true;
    this.cancelled = false;
    this.abort = new AbortController();
    const found = new Map(),
      warnings = [],
      seenDirectories = new Set();
    let visited = 0,
      files = 0,
      limited = false;
    const report = () => this.onProgress({ visited, files, found: found.size });
    const keyOf = (file) =>
      this.platform === 'win32' ? path.resolve(file).toLowerCase() : path.resolve(file);
    const add = async (file, origin) => {
      if (this.cancelled || found.size >= this.limits.results) {
        limited = found.size >= this.limits.results;
        return;
      }
      try {
        if (/[\x00-\x1f]/.test(file)) {
          warnings.push({ origin, code: 'UNSAFE_NAME' });
          return;
        }
        const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink()) return;
        const extension = path.extname(file).toLowerCase();
        if (!['.exe', '.lnk', '.url', '.desktop', '.appimage'].includes(extension)) return;
        if (
          /^(unins\d*|uninstall|setup|install|crashpad_handler|crashreporter|update|updater|maintenance|notification_helper)\.(exe|lnk)$/i.test(
            path.basename(file),
          )
        )
          return;
        let detail = {};
        if (extension === '.lnk' && this.resolveShortcut) {
          try {
            detail = await this.resolveShortcut(file);
          } catch {}
        }
        const target = detail.target || file;
        const key = keyOf(target) + '\0' + (detail.args || '').trim();
        if (found.has(key)) return;
        const id = 'app:' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
        const item = {
          id,
          name: path.basename(file),
          source: file,
          target,
          arguments: detail.args || '',
          workingDirectory: detail.cwd || '',
          kind: 'installed',
          origin,
          extension,
          size: stat.size,
          modified: stat.mtimeMs,
        };
        item.category = classify(item, settings);
        found.set(key, item);
      } catch (e) {
        if (e.code !== 'ENOENT') warnings.push({ origin, code: e.code || 'READ_FAILED' });
      }
    };
    try {
      let roots = this.roots
        ? [...this.roots]
        : this.platform === 'win32'
          ? windowsRoots()
          : this.platform === 'linux'
            ? [
                { path: '/usr/share/applications', label: 'linuxSystem' },
                { path: path.join(os.homedir(), '.local/share/applications'), label: 'linuxUser' },
                { path: '/opt', label: 'linuxOpt' },
              ]
            : [];
      if (this.platform === 'win32' && this.registryEnabled) {
        try {
          for (const entry of await this.registry(this.abort.signal)) {
            if (typeof entry.executable === 'string') {
              const value = entry.executable
                .replace(/,\s*-?\d+\s*$/, '')
                .replace(/^"|"$/g, '')
                .trim();
              if (/\.exe$/i.test(value) && path.isAbsolute(value)) await add(value, 'registry');
            }
            if (typeof entry.directory === 'string' && path.isAbsolute(entry.directory.trim()))
              roots.push({ path: entry.directory.trim(), label: 'registry' });
          }
        } catch (e) {
          warnings.push({ origin: 'registry', code: e.code || 'REGISTRY_UNAVAILABLE' });
        }
      }
      const queue = roots.map((r) => ({ ...r, depth: 0 }));
      let cursor = 0;
      while (cursor < queue.length && !this.cancelled) {
        if (visited >= this.limits.directories || found.size >= this.limits.results) {
          limited = true;
          break;
        }
        const root = queue[cursor++];
        const canonical = keyOf(root.path);
        if (seenDirectories.has(canonical)) continue;
        seenDirectories.add(canonical);
        try {
          const stat = await fs.lstat(root.path);
          if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
          const entries = await fs.readdir(root.path, { withFileTypes: true });
          visited++;
          for (const entry of entries) {
            if (this.cancelled) break;
            const full = path.join(root.path, entry.name);
            if (entry.isDirectory() && root.depth >= this.limits.depth) {
              limited = true;
              continue;
            }
            if (
              entry.isDirectory() &&
              root.depth < this.limits.depth &&
              !entry.name.startsWith('.') &&
              !/^(node_modules|\.git|cache|caches|temp|locales|resources|winsxs)$/i.test(entry.name)
            )
              queue.push({ path: full, label: root.label, depth: root.depth + 1 });
            else if (entry.isFile()) {
              files++;
              await add(full, root.label);
            }
          }
        } catch (e) {
          warnings.push({ origin: root.label, code: e.code || 'READ_FAILED' });
        }
        if (visited % 20 === 0) {
          report();
          await new Promise((resolve) => setImmediate(resolve));
        }
      }
      this.catalog = new Map([...found.values()].map((item) => [item.id, item]));
      report();
      return {
        items: [...this.catalog.values()].sort((a, b) => a.name.localeCompare(b.name)),
        warnings: [...new Map(warnings.map((w) => [w.origin + ':' + w.code, w])).values()],
        cancelled: this.cancelled,
        limited,
        visited,
        files,
        sources: [...new Set(roots.map((r) => r.label))],
        supported: this.platform !== 'darwin',
      };
    } finally {
      this.running = false;
    }
  }
}
module.exports = { DeepScanner, windowsRoots, REGISTRY_SCRIPT };
