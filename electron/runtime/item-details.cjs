const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { extractWindowsIcon, validPngDataUrl } = require('./windows-icons.cjs');
const { unrelatedLaunchHost } = require('../../shared/app-insights.js');

// Paths are passed as JSON over stdin, never interpolated into executable code.
const VERSION_SCRIPT = `[Console]::InputEncoding=[System.Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false);$ErrorActionPreference='Stop';try{$inputValue=[Console]::In.ReadToEnd()|ConvertFrom-Json;$v=[System.Diagnostics.FileVersionInfo]::GetVersionInfo([string]$inputValue.path);@{description=[string]$v.FileDescription;company=[string]$v.CompanyName}|ConvertTo-Json -Compress}catch{exit 1}`;
function windowsVersionInfo(file, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', VERSION_SCRIPT],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let output = '',
      settled = false;
    const decoder = new StringDecoder('utf8');
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(Error('METADATA_UNAVAILABLE'));
    }, 5000);
    child.stdout.on('data', (chunk) => {
      output += decoder.write(chunk);
      if (Buffer.byteLength(output) > 64 * 1024) {
        child.kill();
        finish(Error('METADATA_UNAVAILABLE'));
      }
    });
    child.stderr.resume();
    child.on('error', () => finish(Error('METADATA_UNAVAILABLE')));
    child.on('close', (code) => {
      output += decoder.end();
      if (code !== 0) return finish(Error('METADATA_UNAVAILABLE'));
      try {
        const value = JSON.parse(output.replace(/^\uFEFF/, ''));
        finish(null, {
          description: cleanText(value.description),
          company: cleanText(value.company),
        });
      } catch {
        finish(Error('METADATA_UNAVAILABLE'));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ path: file }));
  });
}
function cleanText(value) {
  return typeof value === 'string'
    ? value
        .replace(/[\x00-\x1f\x7f]/g, '')
        .trim()
        .slice(0, 1024) || null
    : null;
}
function fingerprint(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
}
function localPath(file) {
  return (
    typeof file === 'string' &&
    path.isAbsolute(file) &&
    !/^(?:\\\\|\/\/)/.test(file) &&
    !/[\x00-\x1f]/.test(file)
  );
}
async function regular(file) {
  if (!localPath(file)) return null;
  try {
    const stat = await fs.lstat(file);
    return stat.isFile() && !stat.isSymbolicLink() ? stat : null;
  } catch {
    return null;
  }
}
function resourcePath(value) {
  if (typeof value !== 'string') return null;
  const expanded = value
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/%([^%]+)%/g, (raw, key) => {
      const actual = Object.keys(process.env).find(
        (name) => name.toLowerCase() === key.toLowerCase(),
      );
      return actual ? process.env[actual] : raw;
    });
  return localPath(expanded) ? expanded : null;
}
async function internetShortcut(file, size) {
  if (size > 64 * 1024) return null;
  try {
    const bytes = await fs.readFile(file);
    const text =
      bytes[0] === 255 && bytes[1] === 254
        ? bytes.subarray(2).toString('utf16le')
        : bytes.toString('utf8');
    let section = false;
    const result = {};
    for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      if (/^\s*\[/.test(line)) section = /^\s*\[InternetShortcut\]\s*$/i.test(line);
      else if (section) {
        const match = line.match(/^\s*(IconFile|IconIndex)\s*=(.*)$/i);
        if (match) result[match[1].toLowerCase()] = match[2].trim();
      }
    }
    return { icon: result.iconfile, iconIndex: Number(result.iconindex || 0) };
  } catch {
    return null;
  }
}
class ItemDetailsService {
  constructor({
    getFileIcon,
    resolveShortcut,
    platform = process.platform,
    readVersionInfo = windowsVersionInfo,
    readWindowsIcon = extractWindowsIcon,
    limit = 256,
  }) {
    this.getFileIcon = getFileIcon;
    this.resolveShortcut = resolveShortcut;
    this.platform = platform;
    this.readVersionInfo = readVersionInfo;
    this.readWindowsIcon = readWindowsIcon;
    this.limit = limit;
    this.cache = new Map();
    this.inflight = new Map();
    this.iconTail = Promise.resolve();
    this.metadataTail = Promise.resolve();
  }
  async context(item) {
    const sourceStat = await regular(item.source);
    if (!sourceStat) throw Error('SOURCE_MISSING');
    let target = item.target;
    let shortcut;
    if (path.extname(item.source).toLowerCase() === '.lnk' && this.resolveShortcut) {
      try {
        shortcut = await this.resolveShortcut(item.source);
        target = shortcut?.target || target;
      } catch {}
    }
    if (this.platform === 'win32' && path.extname(item.source).toLowerCase() === '.url')
      shortcut = await internetShortcut(item.source, sourceStat.size);
    const targetStat = target && target !== item.source ? await regular(target) : null;
    const resource = resourcePath(shortcut?.icon),
      resourceStat = resource ? await regular(resource) : null;
    const iconIndex =
      Number.isInteger(shortcut?.iconIndex) && Math.abs(shortcut.iconIndex) <= 65535
        ? shortcut.iconIndex
        : 0;
    const candidates = [];
    if (resourceStat && /\.(ico|exe|dll|icl)$/i.test(resource))
      candidates.push({ path: resource, index: iconIndex, shell: false });
    if (targetStat && /\.(exe|dll|ico)$/i.test(target))
      candidates.push({ path: target, index: 0, shell: false });
    if (/\.(exe|dll|ico)$/i.test(item.source))
      candidates.push({ path: item.source, index: 0, shell: false });
    // The shell handles advertised/UWP links that do not resolve to a local EXE.
    // Never request a shell icon for a link whose known target is a remote path.
    if (!target || !/^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(target))
      candidates.push({ path: item.source, index: 0, shell: true });
    return {
      sourceStat,
      target: targetStat ? target : null,
      shortcutDescription: cleanText(shortcut?.description),
      iconResource: resourceStat ? resource : null,
      iconCandidates: candidates,
      key:
        item.source +
        '\0' +
        fingerprint(sourceStat) +
        '\0' +
        (targetStat ? target + '\0' + fingerprint(targetStat) : '') +
        '\0' +
        (resourceStat ? resource + '\0' + iconIndex + '\0' + fingerprint(resourceStat) : ''),
    };
  }
  cached(key) {
    const value = this.cache.get(key);
    if (value) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  remember(key, value) {
    this.cache.delete(key);
    this.cache.set(key, value);
    while (this.cache.size > this.limit) this.cache.delete(this.cache.keys().next().value);
    return value;
  }
  async once(key, action) {
    if (!this.inflight.has(key)) {
      const operation = action().finally(() => this.inflight.delete(key));
      this.inflight.set(key, operation);
    }
    return this.inflight.get(key);
  }
  async readIcon(item, ctx) {
    const cached = this.cached(ctx.key);
    if (cached && 'icon' in cached && (cached.icon || Date.now() - cached.iconReadAt < 15000))
      return cached.icon;
    return this.once('icon:' + ctx.key, async () => {
      // Serial extraction avoids flooding the shell icon service on large scans.
      const operation = this.iconTail.then(async () => {
        let icon = null,
          iconSource = 'unavailable';
        if (this.platform === 'win32' && ctx.iconCandidates.length) {
          try {
            const value = await this.readWindowsIcon(ctx.iconCandidates);
            if (validPngDataUrl(value)) {
              icon = value;
              iconSource = 'windows-native';
            }
          } catch {}
        }
        if (!icon && this.getFileIcon) {
          for (const file of [
            ...new Set([ctx.iconResource, ctx.target, item.source].filter(Boolean)),
          ]) {
            try {
              const native = await this.getFileIcon(file, { size: 'large' });
              if (!native || native.isEmpty?.()) continue;
              const value = native.toDataURL();
              if (validPngDataUrl(value)) {
                icon = value;
                iconSource = 'electron-shell';
                break;
              }
            } catch {}
          }
        }
        this.remember(ctx.key, {
          ...this.cached(ctx.key),
          icon,
          iconSource,
          iconReadAt: Date.now(),
        });
        return icon;
      });
      this.iconTail = operation.catch(() => {});
      return operation;
    });
  }
  async icon(item, { refresh = false } = {}) {
    const ctx = await this.context(item);
    if (refresh) {
      await this.inflight.get('icon:' + ctx.key)?.catch(() => {});
      this.cache.delete(ctx.key);
    }
    const icon = await this.readIcon(item, ctx);
    return { id: item.id, icon, iconSource: this.cached(ctx.key)?.iconSource || 'unavailable' };
  }
  async readMetadata(item, ctx) {
    const cached = this.cached(ctx.key);
    const metadata =
      (cached?.metadata &&
      ((cached.metadata.metadataSource === 'windows-version-info' &&
        (cached.metadata.description || cached.metadata.company)) ||
        Date.now() - cached.metadataReadAt < 30000)
        ? cached.metadata
        : null) ||
      (await this.once('metadata:' + ctx.key, async () => {
        const operation = this.metadataTail.then(async () => {
          let metadata = {
            description: ctx.shortcutDescription || null,
            company: null,
            metadataSource: ctx.shortcutDescription ? 'windows-shortcut' : 'file-system',
          };
          const executable = ctx.target || item.source;
          if (this.platform === 'win32' && path.extname(executable).toLowerCase() === '.exe') {
            try {
              const value = await this.readVersionInfo(executable);
              const description = cleanText(value.description);
              metadata = {
                description: description || ctx.shortcutDescription || null,
                company: cleanText(value.company),
                metadataSource:
                  description || !ctx.shortcutDescription
                    ? 'windows-version-info'
                    : 'windows-shortcut',
              };
            } catch {}
          }
          this.remember(ctx.key, { ...this.cached(ctx.key), metadata, metadataReadAt: Date.now() });
          return metadata;
        });
        this.metadataTail = operation.catch(() => {});
        return operation;
      }));
    return metadata;
  }
  async purpose(item) {
    const ctx = await this.context(item);
    // A script/game shortcut may target a general launch host. Its version
    // resources describe that host, not the shortcut, so do not read or expose
    // those resources when filling purpose cards.
    if (unrelatedLaunchHost(item, ctx.target))
      return {
        id: item.id,
        description: ctx.shortcutDescription || null,
        company: null,
        metadataSource: ctx.shortcutDescription ? 'windows-shortcut' : 'file-system',
      };
    return { id: item.id, ...(await this.readMetadata(item, ctx)) };
  }
  async details(item) {
    const ctx = await this.context(item);
    const metadata = await this.readMetadata(item, ctx);
    const icon = await this.readIcon(item, ctx);
    return {
      id: item.id,
      icon,
      size: ctx.sourceStat.size,
      created: ctx.sourceStat.birthtimeMs > 0 ? ctx.sourceStat.birthtimeMs : null,
      modified: ctx.sourceStat.mtimeMs,
      ...metadata,
      purposeDescription: unrelatedLaunchHost(item, ctx.target)
        ? ctx.shortcutDescription || null
        : metadata.description,
      purposeSource: unrelatedLaunchHost(item, ctx.target)
        ? ctx.shortcutDescription
          ? 'windows-shortcut'
          : 'file-system'
        : metadata.metadataSource,
    };
  }
}
module.exports = { ItemDetailsService, windowsVersionInfo, VERSION_SCRIPT };
