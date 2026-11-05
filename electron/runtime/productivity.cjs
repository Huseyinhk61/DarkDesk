const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { JsonStore } = require('./json-store.cjs');
const exec = promisify(execFile);
const SAMPLE_SECONDS = 15;
const MAX_GAP_MS = 20000;
const RETENTION_DAYS = 90;
const MAX_APPS = 500;
const FOREGROUND_SCRIPT = `$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class DarkDeskForeground{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);}';function AppValue($p){$file=$null;try{$file=$p.Path}catch{};@{name=[string]$p.ProcessName;path=$file}};$foreground=$null;$h=[DarkDeskForeground]::GetForegroundWindow();$processId=[uint32]0;if($h -ne [IntPtr]::Zero){[void][DarkDeskForeground]::GetWindowThreadProcessId($h,[ref]$processId);if($processId -ne 0){try{$foreground=AppValue(Get-Process -Id $processId -ErrorAction Stop)}catch{}}};$sessionId=[Diagnostics.Process]::GetCurrentProcess().SessionId;$running=@(Get-Process|Where-Object{$_.SessionId -eq $sessionId -and $_.MainWindowHandle -ne [IntPtr]::Zero}|Select-Object -First 500|ForEach-Object{AppValue($_)});@{foreground=$foreground;running=$running}|ConvertTo-Json -Depth 4 -Compress`;
const MAC_FOREGROUND_SCRIPT = `ObjC.import('AppKit');var workspace=$.NSWorkspace.sharedWorkspace;function value(app){return {name:ObjC.unwrap(app.localizedName),path:app.executableURL?ObjC.unwrap(app.executableURL.path):null};}var app=workspace.frontmostApplication;var running=workspace.runningApplications;var values=[];for(var i=0;i<running.count&&values.length<500;i++){var item=running.objectAtIndex(i);if(item.activationPolicy===0&&!item.terminated)values.push(value(item));}JSON.stringify({foreground:app?value(app):null,running:values})`;
const coded = (code) => Object.assign(Error(code), { code });
const plain = (value) => value && typeof value === 'object' && !Array.isArray(value);
const clean = (value, limit = 160) =>
  typeof value === 'string'
    ? value
        .replace(/[\x00-\x1f\x7f]/g, '')
        .trim()
        .slice(0, limit)
    : '';
const finite = (value) => Number.isFinite(value) && value >= 0 && value <= 172800;
const dateKey = (time) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dateValid = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return dateKey(new Date(year, month - 1, day).getTime()) === value;
};
const initial = () => ({ version: 1, enabled: false, days: {} });
function sanitizeState(input) {
  if (
    !plain(input) ||
    input.version !== 1 ||
    typeof input.enabled !== 'boolean' ||
    !plain(input.days)
  )
    throw coded('ANALYTICS_STATE_READ');
  const result = initial();
  result.enabled = input.enabled;
  for (const [date, day] of Object.entries(input.days)
    .filter(([date]) => dateValid(date))
    .sort()
    .slice(-RETENTION_DAYS)) {
    if (!plain(day) || !finite(day.activeSeconds)) continue;
    const apps = {},
      profiles = {};
    if (plain(day.apps))
      for (const [id, item] of Object.entries(day.apps).slice(0, MAX_APPS + 1)) {
        if (!/^(?:app:[a-f0-9]{24}|other)$/.test(id) || !plain(item) || !finite(item.seconds))
          continue;
        apps[id] = {
          name: clean(item.name),
          seconds: item.seconds,
          runningSeconds: finite(item.runningSeconds) ? item.runningSeconds : 0,
        };
      }
    if (plain(day.profiles))
      for (const [id, seconds] of Object.entries(day.profiles).slice(0, 64)) {
        if (/^[a-zA-Z0-9_-]{1,80}$/.test(id) && finite(seconds))
          Object.defineProperty(profiles, id, {
            value: seconds,
            enumerable: true,
            configurable: true,
            writable: true,
          });
      }
    result.days[date] = { activeSeconds: day.activeSeconds, apps, profiles };
  }
  return result;
}
function idleNow(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return !Number.isFinite(value) || value >= 60;
  return !!value?.locked || Number(value?.idleSeconds || 0) >= 60;
}
function appIdentity(input, platform) {
  if (!plain(input)) return null;
  const name = clean(input.name);
  if (!name) return null;
  const file = clean(input.path, 8192);
  const identity = file
    ? 'path:' + (platform === 'win32' ? file.toLowerCase() : file)
    : 'name:' + name.toLowerCase();
  return {
    id: 'app:' + crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24),
    name,
  };
}
function profileIdentity(value) {
  const id = typeof value === 'string' ? value : value?.activeId;
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id) ? id : 'normal';
}
async function sampleForeground(platform = process.platform, execute = exec) {
  if (!['win32', 'darwin'].includes(platform)) throw coded('ANALYTICS_UNSUPPORTED');
  let output;
  try {
    const options = { windowsHide: true, timeout: 5000, maxBuffer: 512 * 1024, encoding: 'utf8' };
    const result =
      platform === 'win32'
        ? await execute(
            'powershell.exe',
            [
              '-NoProfile',
              '-NonInteractive',
              '-EncodedCommand',
              Buffer.from(FOREGROUND_SCRIPT, 'utf16le').toString('base64'),
            ],
            options,
          )
        : await execute(
            '/usr/bin/osascript',
            ['-l', 'JavaScript', '-e', MAC_FOREGROUND_SCRIPT],
            options,
          );
    output = JSON.parse(
      String(result.stdout)
        .replace(/^\uFEFF/, '')
        .trim(),
    );
  } catch (error) {
    throw coded(
      /not authorized|not permitted|1743|accessibility/i.test(String(error.stderr || ''))
        ? 'ANALYTICS_PERMISSION'
        : 'ANALYTICS_SAMPLE_FAILED',
    );
  }
  if (output === null) return null;
  if (!plain(output) || !Object.hasOwn(output, 'foreground') || !Array.isArray(output.running))
    throw coded('ANALYTICS_SAMPLE_FAILED');
  const item = (value) =>
    plain(value) && clean(value.name)
      ? { name: clean(value.name), path: clean(value.path, 8192) || null }
      : null;
  return {
    foreground: item(output.foreground),
    running: output.running.slice(0, 500).map(item).filter(Boolean),
  };
}
class ProductivityTracker {
  constructor({
    data,
    platform = process.platform,
    sampleForeground: sample,
    getProfile = async () => null,
    clock = () => Date.now(),
    idle = () => false,
    emit = () => {},
  }) {
    this.platform = platform;
    this.supported = !!sample || ['win32', 'darwin'].includes(platform);
    this.sample = sample || (() => sampleForeground(platform));
    this.getProfile = getProfile;
    this.clock = clock;
    this.idle = idle;
    this.emit = emit;
    this.store = new JsonStore(path.join(data, 'productivity.json'), initial());
    this.state = null;
    this.loading = null;
    this.tail = Promise.resolve();
    this.inflight = null;
    this.last = null;
    this.epoch = 0;
    this.reasons = new Set();
    this.idleDetected = false;
    this.lastError = null;
    this.failures = 0;
    this.unavailable = false;
    this.dirty = false;
    this.lastFlush = 0;
    this.latestTime = 0;
    this.runningAvailable = !sample && this.supported;
  }
  async ready() {
    if (!this.loading)
      this.loading = (async () => {
        try {
          this.state = sanitizeState(await this.store.read());
          this.prune(this.clock());
        } catch {
          throw coded('ANALYTICS_STATE_READ');
        }
        this.lastFlush = this.clock();
      })();
    return this.loading;
  }
  locked(action) {
    const next = this.tail.then(async () => {
      await this.ready();
      return action();
    });
    this.tail = next.catch(() => {});
    return next;
  }
  snapshot() {
    return {
      enabled: this.state.enabled,
      supported: this.supported,
      capability: 'foreground',
      paused: this.reasons.size > 0 || this.idleDetected,
      samplingAvailable: !this.unavailable,
      lastError: this.lastError,
      sampleIntervalSeconds: SAMPLE_SECONDS,
      retentionDays: RETENTION_DAYS,
      runningAvailable: this.runningAvailable,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      days: Object.entries(this.state.days)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, day]) => ({
          date,
          activeSeconds: day.activeSeconds,
          apps: Object.entries(day.apps).map(([id, item]) => ({ id, ...item })),
          profiles: Object.entries(day.profiles).map(([id, seconds]) => ({ id, seconds })),
        })),
    };
  }
  async status() {
    await this.ready();
    await this.tail;
    return this.snapshot();
  }
  async persist() {
    try {
      await this.store.write(this.state);
    } catch {
      throw coded('ANALYTICS_WRITE_FAILED');
    }
    this.dirty = false;
    this.lastFlush = this.clock();
  }
  setEnabled(enabled) {
    if (typeof enabled !== 'boolean') return Promise.reject(coded('ANALYTICS_INPUT_INVALID'));
    if (enabled && !this.supported) return Promise.reject(coded('ANALYTICS_UNSUPPORTED'));
    ++this.epoch;
    this.last = null;
    return this.locked(async () => {
      const previous = this.state.enabled;
      this.state.enabled = enabled;
      this.lastError = null;
      this.failures = 0;
      this.unavailable = false;
      this.idleDetected = false;
      try {
        await this.persist();
      } catch (error) {
        this.state.enabled = previous;
        throw error;
      }
      const result = this.snapshot();
      this.emit(result);
      return result;
    });
  }
  pause(reason = 'system') {
    this.reasons.add(String(reason));
    ++this.epoch;
    this.last = null;
  }
  resume(reason = 'system') {
    this.reasons.delete(String(reason));
    ++this.epoch;
    this.last = null;
  }
  prune(now) {
    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (RETENTION_DAYS - 1));
    const lower = dateKey(cutoff.getTime());
    const upper = dateKey(now);
    for (const date of Object.keys(this.state.days))
      if (date < lower || date > upper) {
        delete this.state.days[date];
        this.dirty = true;
      }
    const dates = Object.keys(this.state.days).sort();
    for (const date of dates.slice(0, Math.max(0, dates.length - RETENTION_DAYS))) {
      delete this.state.days[date];
      this.dirty = true;
    }
  }
  attribute(previous, current) {
    const start = previous.time,
      end = current.time;
    if (end <= start || end - start > MAX_GAP_MS) return false;
    const known = new Set(Object.values(this.state.days).flatMap((day) => Object.keys(day.apps)));
    const sameApp = previous.app && current.app && previous.app.id === current.app.id;
    const running =
      previous.running && current.running
        ? [...previous.running.values()].filter((app) => current.running.has(app.id))
        : [];
    const identity = (app) => {
      if (known.has(app.id)) return app.id;
      if (known.size < MAX_APPS) {
        known.add(app.id);
        return app.id;
      }
      return 'other';
    };
    let cursor = start;
    while (cursor < end) {
      const date = new Date(cursor),
        nextMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
      const until = Math.min(end, nextMidnight),
        seconds = (until - cursor) / 1000,
        key = dateKey(cursor);
      const day = (this.state.days[key] ||= { activeSeconds: 0, apps: {}, profiles: {} });
      if (previous.app && current.app) day.activeSeconds += seconds;
      if (sameApp) {
        const id = identity(previous.app);
        const app = (day.apps[id] ||= {
          name: id === 'other' ? '' : previous.app.name,
          seconds: 0,
          runningSeconds: 0,
        });
        app.seconds += seconds;
      }
      for (const item of running) {
        const id = identity(item);
        const app = (day.apps[id] ||= {
          name: id === 'other' ? '' : item.name,
          seconds: 0,
          runningSeconds: 0,
        });
        app.runningSeconds += seconds;
      }
      if (previous.app && current.app && previous.profile === current.profile)
        Object.defineProperty(day.profiles, previous.profile, {
          value:
            (Object.hasOwn(day.profiles, previous.profile) ? day.profiles[previous.profile] : 0) +
            seconds,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      cursor = until;
    }
    this.prune(end);
    this.dirty = true;
    return true;
  }
  tick() {
    if (this.inflight) return this.inflight;
    const promise = this.collect();
    this.inflight = promise;
    promise
      .finally(() => {
        if (this.inflight === promise) this.inflight = null;
      })
      .catch(() => {});
    return promise;
  }
  async collect() {
    await this.ready();
    if (!this.state.enabled || !this.supported || this.reasons.size || this.unavailable) {
      this.last = null;
      return this.status();
    }
    const epoch = this.epoch;
    let app, profile, idle, running;
    try {
      idle = idleNow(await this.idle());
      if (!idle) {
        const result = await this.sample();
        const structured = plain(result) && Object.hasOwn(result, 'foreground');
        app = appIdentity(structured ? result.foreground : result, this.platform);
        if (structured && Array.isArray(result.running)) {
          running = new Map(
            result.running
              .slice(0, 500)
              .map((item) => appIdentity(item, this.platform))
              .filter(Boolean)
              .map((item) => [item.id, item]),
          );
        }
        profile = profileIdentity(await this.getProfile());
      }
    } catch (error) {
      return this.locked(() => {
        if (epoch !== this.epoch || !this.state.enabled) return this.snapshot();
        this.last = null;
        this.lastError = ['ANALYTICS_PERMISSION', 'ANALYTICS_UNSUPPORTED'].includes(error.code)
          ? error.code
          : 'ANALYTICS_SAMPLE_FAILED';
        this.failures++;
        this.unavailable = this.failures >= 3;
        const result = this.snapshot();
        this.emit(result);
        return result;
      });
    }
    return this.locked(async () => {
      if (epoch !== this.epoch || !this.state.enabled || this.reasons.size) return this.snapshot();
      this.idleDetected = idle;
      this.lastError = null;
      this.failures = 0;
      const time = this.clock();
      if (running) this.runningAvailable = true;
      if (idle || (!app && !running?.size) || !Number.isFinite(time) || time <= 0) this.last = null;
      else if (time < this.latestTime) {
        this.last = null;
        this.lastError = 'ANALYTICS_CLOCK_CHANGED';
      } else {
        this.latestTime = Math.max(this.latestTime, time);
        const current = { app, profile, time, running };
        if (this.last) this.attribute(this.last, current);
        this.last = current;
      }
      if (this.dirty && time - this.lastFlush >= 60000) {
        try {
          await this.persist();
        } catch {
          this.lastError = 'ANALYTICS_WRITE_FAILED';
        }
      }
      const result = this.snapshot();
      this.emit(result);
      return result;
    });
  }
  flush() {
    return this.locked(async () => {
      if (this.dirty) await this.persist();
      return this.snapshot();
    });
  }
  async flushIfLoaded() {
    try {
      await this.ready();
    } catch (error) {
      // An unreadable history has no unsaved measurements. Allow OS actions
      // without replacing that file; loaded dirty measurements must still save.
      if (!this.state) return;
      throw error;
    }
    return this.flush();
  }
  clear() {
    ++this.epoch;
    this.last = null;
    const next = this.tail.then(async () => {
      // Explicit deletion also recovers an unreadable history file. A failed read
      // never silently starts tracking or overwrites data during normal startup.
      let unreadable = false;
      try {
        await this.ready();
      } catch {
        unreadable = true;
      }
      const previous = this.state;
      this.state = unreadable ? initial() : { ...this.state, days: {} };
      try {
        await this.persist();
      } catch (error) {
        this.state = previous;
        throw error;
      }
      this.loading = Promise.resolve();
      this.lastError = null;
      this.latestTime = 0;
      this.failures = 0;
      this.unavailable = false;
      this.idleDetected = false;
      const result = this.snapshot();
      this.emit(result);
      return result;
    });
    this.tail = next.catch(() => {});
    return next;
  }
  async stop() {
    this.pause('stopped');
    if (this.inflight) await this.inflight.catch(() => {});
    // A corrupt file has no loaded, unsaved measurements to flush. It must not
    // prevent the user from quitting the application.
    try {
      await this.ready();
    } catch {
      if (!this.state) return;
      throw coded('ANALYTICS_STATE_READ');
    }
    await this.flush();
  }
}
module.exports = {
  ProductivityTracker,
  sampleForeground,
  FOREGROUND_SCRIPT,
  MAC_FOREGROUND_SCRIPT,
  dateKey,
  sanitizeState,
  appIdentity,
};
