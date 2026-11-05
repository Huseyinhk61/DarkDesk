const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { JsonStore } = require('./json-store.cjs');

const coded = (code) => Object.assign(Error(code), { code });
const plain = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const validText = (value, max = 512) =>
  typeof value === 'string' && value.length > 0 && value.length <= max && !/[\0\r\n]/.test(value);
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const identity = (source, name) => digest(source + '\0' + name);
const approvalState = (value, kind = 'Binary') => {
  if (value === null || value === undefined) return true;
  if (kind !== 'Binary' || typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    return null;
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 12 || bytes.toString('base64') !== value) return null;
  const state = bytes.readUInt32LE(0);
  return state === 2 ? true : state === 3 ? false : null;
};
const signature = (entry) =>
  digest(
    JSON.stringify({
      source: entry.source,
      name: entry.name,
      command: entry.command,
      valueKind: entry.valueKind,
      approval: entry.approval ?? null,
      approvalKind: entry.approvalKind || 'Binary',
      fileFingerprint: entry.fileFingerprint || null,
    }),
  );
const sourceIdentity = (entry) =>
  digest(
    JSON.stringify({
      source: entry.source,
      name: entry.name,
      command: entry.command,
      valueKind: entry.valueKind,
      fileFingerprint: entry.fileFingerprint || null,
    }),
  );
function disabledApproval(now) {
  const bytes = Buffer.alloc(12);
  bytes.writeUInt32LE(3, 0);
  // Windows FILETIME timestamp, not a command or user-provided registry path.
  bytes.writeBigUInt64LE(BigInt(Math.trunc(now)) * 10000n + 116444736000000000n, 4);
  return bytes.toString('base64');
}
function enabledApproval() {
  const bytes = Buffer.alloc(12);
  bytes.writeUInt32LE(2, 0);
  return bytes.toString('base64');
}

// Enumeration reads fixed startup locations only. Commands are returned as
// metadata and are never parsed or executed.
const LIST_SCRIPT = String.raw`[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ErrorActionPreference='Stop'
function Read-Approval($root,$keyPath,$name) {
  $key=$root.OpenSubKey($keyPath)
  try {
    if ($null -eq $key -or -not ($key.GetValueNames() -ccontains $name)) { return @{value=$null;kind='Binary'} }
    $kind=$key.GetValueKind($name).ToString()
    $value=$key.GetValue($name,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    if ($kind -eq 'Binary') { return @{value=[Convert]::ToBase64String([byte[]]$value);kind=$kind} }
    return @{value='unsupported';kind=$kind}
  } finally { if ($key) { $key.Dispose() } }
}
function Read-Run($root,$source) {
  $run=$root.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Run')
  try {
    if ($run) {
      foreach ($name in $run.GetValueNames()) {
        if (-not $name) { continue }
        $kind=$run.GetValueKind($name).ToString()
        $command=$run.GetValue($name,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        $a=Read-Approval $root 'Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run' $name
        $records.Add(@{source=$source;name=$name;command=[string]$command;valueKind=$kind;approval=$a.value;approvalKind=$a.kind})
      }
    }
  } finally { if ($run) { $run.Dispose() } }
}
try {
  $records=[System.Collections.Generic.List[object]]::new()
  $warnings=[System.Collections.Generic.List[string]]::new()
  try { Read-Run ([Microsoft.Win32.Registry]::CurrentUser) 'user-run' } catch { $warnings.Add('STARTUP_USER_UNAVAILABLE') }
  try { Read-Run ([Microsoft.Win32.Registry]::LocalMachine) 'machine-run' } catch { $warnings.Add('STARTUP_MACHINE_UNAVAILABLE') }
  $folder=[Environment]::GetFolderPath([Environment+SpecialFolder]::Startup)
  $approved=[System.Collections.Generic.List[object]]::new()
  $folderReadable=$true
  try {
    $key=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder')
    try {
      if ($key) {
        foreach ($name in $key.GetValueNames()) {
          $kind=$key.GetValueKind($name).ToString()
          $value=$key.GetValue($name)
          $encoded='unsupported'
          if ($kind -eq 'Binary') { $encoded=[Convert]::ToBase64String([byte[]]$value) }
          $approved.Add(@{name=$name;approval=$encoded;approvalKind=$kind})
        }
      }
    } finally { if ($key) { $key.Dispose() } }
  } catch { $folderReadable=$false;$warnings.Add('STARTUP_FOLDER_UNAVAILABLE') }
  @{records=@($records.ToArray());startupDirectory=$folder;folderApprovals=@($approved.ToArray());folderReadable=$folderReadable;warnings=@($warnings.ToArray())}|ConvertTo-Json -Depth 5 -Compress
} catch { exit 1 }`;

// Both command/type and StartupApproved bytes are checked before a write.
const SET_SCRIPT = String.raw`[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ErrorActionPreference='Stop'
try {
  $v=[Console]::In.ReadToEnd()|ConvertFrom-Json
  $root=[Microsoft.Win32.Registry]::CurrentUser
  $name=[string]$v.name
  if ($v.source -eq 'user-run') {
    $approvedPath='Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
    $run=$root.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Run')
    try {
      if ($null -eq $run -or -not ($run.GetValueNames() -ccontains $name)) { exit 3 }
      $kind=$run.GetValueKind($name).ToString()
      $command=[string]$run.GetValue($name,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
      if ($kind -cne [string]$v.valueKind -or $command -cne [string]$v.command) { exit 3 }
    } finally { if ($run) { $run.Dispose() } }
  } elseif ($v.source -eq 'user-startup') {
    $approvedPath='Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder'
  } else { exit 2 }
  $key=$root.OpenSubKey($approvedPath)
  $current=$null
  $currentKind='Binary'
  try {
    if ($key -and ($key.GetValueNames() -ccontains $name)) {
      $currentKind=$key.GetValueKind($name).ToString()
      if ($currentKind -eq 'Binary') { $current=[Convert]::ToBase64String([byte[]]$key.GetValue($name)) } else { $current='unsupported' }
    }
  } finally { if ($key) { $key.Dispose() } }
  if ($currentKind -cne [string]$v.approvalKind -or $current -cne $v.approval) { exit 3 }
  $write=$root.CreateSubKey($approvedPath)
  try {
    if ($null -eq $v.desired) { $write.DeleteValue($name,$false) }
    else {
      $bytes=[Convert]::FromBase64String([string]$v.desired)
      if ($bytes.Length -ne 12) { exit 2 }
      $write.SetValue($name,$bytes,[Microsoft.Win32.RegistryValueKind]::Binary)
    }
  } finally { $write.Dispose() }
  @{changed=$true}|ConvertTo-Json -Compress
} catch { exit 1 }`;

function runPowerShell(script, input = {}, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    let child,
      timer,
      settled = false,
      output = '',
      bytes = 0;
    const decoder = new StringDecoder('utf8');
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    try {
      child = spawnProcess(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-EncodedCommand',
          Buffer.from(script, 'utf16le').toString('base64'),
        ],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      timer = setTimeout(() => {
        child.kill();
        finish(coded('STARTUP_UNAVAILABLE'));
      }, 12000);
      const read = (chunk) => {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) {
          child.kill();
          finish(coded('STARTUP_UNAVAILABLE'));
          return;
        }
        output += decoder.write(chunk);
      };
      child.stdout.on('data', read);
      child.stderr.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) {
          child.kill();
          finish(coded('STARTUP_UNAVAILABLE'));
        }
      });
      child.on('error', () => finish(coded('STARTUP_UNAVAILABLE')));
      child.on('close', (code) => {
        output += decoder.end();
        if (code !== 0)
          return finish(
            coded(
              code === 3
                ? 'STARTUP_CHANGED'
                : code === 2
                  ? 'STARTUP_INVALID'
                  : 'STARTUP_UNAVAILABLE',
            ),
          );
        try {
          finish(null, JSON.parse(output.replace(/^\uFEFF/, '')));
        } catch {
          finish(coded('STARTUP_UNAVAILABLE'));
        }
      });
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(input));
    } catch {
      finish(coded('STARTUP_UNAVAILABLE'));
    }
  });
}
class WindowsStartupRegistry {
  constructor(run = runPowerShell) {
    this.run = run;
  }
  snapshot() {
    return this.run(LIST_SCRIPT);
  }
  setApproved(entry, desired) {
    return this.run(SET_SCRIPT, {
      source: entry.source,
      name: entry.name,
      command: entry.command,
      valueKind: entry.valueKind,
      approval: entry.approval ?? null,
      approvalKind: entry.approvalKind || 'Binary',
      desired,
    });
  }
}

class StartupManager {
  constructor({
    data,
    platform = process.platform,
    startupDirectory,
    registry = new WindowsStartupRegistry(),
    clock = () => Date.now(),
  } = {}) {
    if (!data || !path.isAbsolute(data)) throw coded('STARTUP_INVALID');
    this.platform = platform;
    this.startupDirectory = startupDirectory;
    this.registry = registry;
    this.clock = clock;
    this.store = new JsonStore(path.join(data, 'startup-state.json'), { version: 1, records: {} });
    this.tail = Promise.resolve();
    this.index = new Map();
  }
  locked(action) {
    const next = this.tail.then(action, action);
    this.tail = next.catch(() => {});
    return next;
  }
  async readState() {
    try {
      const stat = await fs.lstat(this.store.file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024)
        throw coded('STARTUP_STATE_UNSAFE');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const value = await this.store.read();
    if (value.version !== 1 || !plain(value.records)) throw coded('STARTUP_STATE_UNSAFE');
    return value;
  }
  async writeState(value) {
    await this.readState();
    await this.store.write(value);
  }
  async safeDirectory(directory) {
    if (
      !validText(directory, 32768) ||
      !path.isAbsolute(directory) ||
      /^(?:\\\\|\/\/)/.test(directory)
    )
      throw coded('STARTUP_PATH_UNSAFE');
    const parsed = path.parse(path.resolve(directory));
    let current = parsed.root;
    for (const part of path
      .resolve(directory)
      .slice(parsed.root.length)
      .split(path.sep)
      .filter(Boolean)) {
      current = path.join(current, part);
      const stat = await fs.lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded('STARTUP_PATH_UNSAFE');
    }
  }
  async scan() {
    if (this.platform !== 'win32')
      return { supported: false, platform: this.platform, items: [], warnings: [] };
    const snapshot = await this.registry.snapshot();
    if (!plain(snapshot) || !Array.isArray(snapshot.records) || snapshot.records.length > 5000)
      throw coded('STARTUP_UNAVAILABLE');
    const entries = [],
      warnings = (Array.isArray(snapshot.warnings) ? snapshot.warnings : []).filter((code) =>
        [
          'STARTUP_USER_UNAVAILABLE',
          'STARTUP_MACHINE_UNAVAILABLE',
          'STARTUP_FOLDER_UNAVAILABLE',
        ].includes(code),
      );
    for (const value of snapshot.records) {
      if (
        !plain(value) ||
        !['user-run', 'machine-run'].includes(value.source) ||
        !validText(value.name) ||
        typeof value.command !== 'string' ||
        value.command.length > 32768
      )
        continue;
      const enabled = approvalState(value.approval, value.approvalKind);
      const user = value.source === 'user-run';
      entries.push({
        ...value,
        id: identity(value.source, value.name),
        enabled,
        canEdit: user && enabled !== null && ['String', 'ExpandString'].includes(value.valueKind),
        reason: !user
          ? 'machine-managed'
          : enabled === null
            ? 'unknown-state'
            : !['String', 'ExpandString'].includes(value.valueKind)
              ? 'unsupported-type'
              : null,
      });
    }
    const directory = this.startupDirectory || snapshot.startupDirectory;
    if (directory) {
      try {
        await this.safeDirectory(directory);
        const approvals = new Map(
          (Array.isArray(snapshot.folderApprovals) ? snapshot.folderApprovals : [])
            .filter(plain)
            .map((item) => [item.name, item]),
        );
        for (const entry of (await fs.readdir(directory, { withFileTypes: true })).slice(0, 2000)) {
          if (
            !entry.isFile() ||
            entry.isSymbolicLink() ||
            !validText(entry.name) ||
            /^desktop\.ini$/i.test(entry.name) ||
            entry.name.startsWith('.')
          )
            continue;
          const file = path.join(directory, entry.name),
            stat = await fs.lstat(file);
          if (!stat.isFile() || stat.isSymbolicLink()) continue;
          const approval = approvals.get(entry.name) || {},
            enabled =
              snapshot.folderReadable === false
                ? null
                : approvalState(approval.approval, approval.approvalKind);
          const supported = /\.(lnk|url|exe|bat|cmd)$/i.test(entry.name);
          entries.push({
            id: identity('user-startup', entry.name),
            source: 'user-startup',
            name: entry.name,
            command: file,
            valueKind: 'File',
            approval: approval.approval ?? null,
            approvalKind: approval.approvalKind || 'Binary',
            enabled,
            canEdit: supported && enabled !== null,
            reason: enabled === null ? 'unknown-state' : !supported ? 'unsupported-type' : null,
            fileFingerprint: [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':'),
          });
        }
      } catch (error) {
        if (error.code !== 'ENOENT') warnings.push('STARTUP_PATH_UNSAFE');
      }
    }
    const unique = new Map(entries.map((entry) => [entry.id, entry]));
    this.index = unique;
    return {
      supported: true,
      platform: this.platform,
      items: [...unique.values()].map(
        ({ approval, approvalKind, valueKind, fileFingerprint, ...entry }) => entry,
      ),
      warnings,
    };
  }
  list() {
    return this.locked(() => this.scan());
  }
  setEnabled(id, enabled) {
    return this.locked(async () => {
      if (this.platform !== 'win32') throw coded('STARTUP_UNSUPPORTED');
      if (!validText(id, 128) || typeof enabled !== 'boolean') throw coded('STARTUP_INVALID');
      const expected = this.index.get(id);
      if (!expected) throw coded('STARTUP_CHANGED');
      const mark = signature(expected);
      await this.scan();
      const entry = this.index.get(id);
      if (!entry || signature(entry) !== mark) throw coded('STARTUP_CHANGED');
      if (!entry.canEdit) throw coded('STARTUP_READ_ONLY');
      if (entry.enabled === enabled) return this.scan();
      const state = await this.readState();
      const backup = Object.hasOwn(state.records, id) ? state.records[id] : null;
      let desired;
      if (!enabled) {
        desired = disabledApproval(this.clock());
        state.records[id] = {
          source: entry.source,
          name: entry.name,
          identity: sourceIdentity(entry),
          originalApproval: entry.approval ?? null,
          disabledApproval: desired,
          stage: 'prepared',
        };
        await this.writeState(state);
      } else {
        const owned =
          plain(backup) &&
          backup.source === entry.source &&
          backup.name === entry.name &&
          backup.identity === sourceIdentity(entry) &&
          backup.disabledApproval === entry.approval &&
          (backup.originalApproval === null || approvalState(backup.originalApproval) === true);
        desired = owned ? backup.originalApproval : enabledApproval();
      }
      // Startup-folder files are never moved or rewritten. Check their identity
      // once more before touching the approval flag associated with their name.
      if (entry.source === 'user-startup') {
        await this.safeDirectory(path.dirname(entry.command));
        const stat = await fs.lstat(entry.command);
        if (
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':') !==
            entry.fileFingerprint
        )
          throw coded('STARTUP_CHANGED');
      }
      await this.registry.setApproved(entry, desired);
      if (enabled) delete state.records[id];
      else state.records[id].stage = 'disabled';
      const warnings = [];
      try {
        await this.writeState(state);
      } catch {
        warnings.push('STARTUP_STATE_WRITE');
      }
      const result = await this.scan();
      return { ...result, warnings: [...result.warnings, ...warnings] };
    });
  }
}
module.exports = {
  StartupManager,
  WindowsStartupRegistry,
  runPowerShell,
  LIST_SCRIPT,
  SET_SCRIPT,
  approvalState,
  disabledApproval,
  enabledApproval,
};
