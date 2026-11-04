const UPDATE_STATES = new Set([
  'idle',
  'checking',
  'available',
  'not-available',
  'downloading',
  'downloaded',
  'error',
  'unsupported',
]);
const REASONS = new Set(['development', 'portable', 'platform', 'unavailable']);
function cleanVersion(value) {
  return typeof value === 'string' &&
    value.length <= 100 &&
    /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/i.test(value)
    ? value
    : null;
}
function cleanProgress(value) {
  const number = (key) =>
    Number.isFinite(value?.[key]) && value[key] >= 0
      ? Math.min(value[key], Number.MAX_SAFE_INTEGER)
      : 0;
  return {
    percent: Math.min(100, number('percent')),
    transferred: number('transferred'),
    total: number('total'),
    bytesPerSecond: number('bytesPerSecond'),
  };
}
function errorCode(error, fallback = 'UPDATE_CHECK_FAILED') {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '')
    .slice(0, 2048)
    .toUpperCase();
  if (code === 'OPERATION_BUSY' || message === 'OPERATION_BUSY') return 'UPDATE_BUSY';
  if (/CANCEL/.test(code)) return 'UPDATE_CANCELLED';
  if (/SHA512|CHECKSUM|SIGNATURE|CRC_MISMATCH/.test(code + ' ' + message))
    return 'UPDATE_INTEGRITY';
  if (/EACCES|EPERM|ACCESS_DENIED/.test(code)) return 'UPDATE_ACCESS';
  if (/(?:^|[^0-9])(401|403)(?:[^0-9]|$)/.test(code + ' ' + message)) return 'UPDATE_AUTH_FAILED';
  if (/ENOTFOUND|ECONN|ETIMEDOUT|ENET|EAI_AGAIN|CERT_|UNABLE_TO_VERIFY|ERR_NETWORK/.test(code))
    return 'UPDATE_NETWORK';
  if (
    /LATEST_VERSION_NOT_FOUND|CHANNEL_FILE_NOT_FOUND|NO_PUBLISHED_VERSIONS|404|403|401/.test(
      code + ' ' + message,
    )
  )
    return 'UPDATE_SOURCE_UNAVAILABLE';
  if (/INVALID_RELEASE|INVALID_VERSION|INVALID_METADATA|YAML|ERR_UPDATER_PARSE/.test(code))
    return 'UPDATE_METADATA';
  return fallback;
}

// electron-updater owns feed parsing, HTTPS transport, checksums and installation.
// This service exposes only a small state model; URLs, paths, notes and raw errors
// from a remote release never cross the renderer bridge.
class UpdateService {
  constructor({
    autoUpdater,
    appVersion,
    enabled = true,
    unsupportedReason = 'platform',
    emit = () => {},
    notify = () => {},
    beforeInstall = async () => {},
    onInstallFailure = () => {},
  }) {
    this.updater = autoUpdater;
    this.enabled = enabled === true && !!autoUpdater;
    this.emit = emit;
    this.notify = notify;
    this.beforeInstall = beforeInstall;
    this.onInstallFailure = onInstallFailure;
    this.installAttempt = null;
    this.availableVersion = null;
    this.downloadedVersion = null;
    this.notified = new Set();
    this.checkPromise = null;
    this.downloadPromise = null;
    this.installPromise = null;
    this.installing = false;
    this.disposed = false;
    this.value = {
      state: this.enabled ? 'idle' : 'unsupported',
      currentVersion: cleanVersion(appVersion),
      version: null,
      progress: null,
      errorCode: null,
      reason: this.enabled
        ? null
        : REASONS.has(unsupportedReason)
          ? unsupportedReason
          : 'unavailable',
      lastChecked: null,
      installing: false,
    };
    this.handlers = {
      'checking-for-update': () => {
        if (!this.downloadPromise && !this.downloadedVersion && !this.installing)
          this.set({ state: 'checking', errorCode: null });
      },
      'update-available': (info) => this.available(info),
      'update-not-available': () => {
        if (this.downloadPromise || this.downloadedVersion || this.installing) return;
        this.availableVersion = null;
        this.set({
          state: 'not-available',
          version: null,
          progress: null,
          errorCode: null,
          lastChecked: new Date().toISOString(),
        });
      },
      'download-progress': (progress) => {
        if (this.value.state === 'downloading') this.set({ progress: cleanProgress(progress) });
      },
      'update-downloaded': (info) => {
        if (this.value.state !== 'downloading') return;
        const version = cleanVersion(info?.version) || this.availableVersion;
        if (
          version &&
          version === this.availableVersion &&
          (info?.version === undefined || cleanVersion(info.version))
        )
          this.downloaded(version);
        else this.fail(Error('INVALID_VERSION'), 'UPDATE_METADATA');
      },
      error: (error) =>
        this.installing
          ? this.installFailure(error)
          : this.fail(
              error,
              this.downloadPromise ? 'UPDATE_DOWNLOAD_FAILED' : 'UPDATE_CHECK_FAILED',
            ),
    };
    if (this.updater) {
      this.updater.autoDownload = false;
      this.updater.autoInstallOnAppQuit = false;
      this.updater.allowPrerelease = false;
      this.updater.allowDowngrade = false;
      for (const [name, handler] of Object.entries(this.handlers)) this.updater.on(name, handler);
    }
  }
  status() {
    return structuredClone(this.value);
  }
  set(patch) {
    if (this.disposed || !this.enabled) return this.status();
    if (patch.state && !UPDATE_STATES.has(patch.state)) return this.status();
    this.value = { ...this.value, ...patch, installing: this.installing };
    try {
      this.emit(this.status());
    } catch {}
    return this.status();
  }
  fail(error, fallback) {
    return this.set({
      state: this.downloadedVersion ? 'downloaded' : 'error',
      errorCode: errorCode(error, fallback),
      progress: null,
    });
  }
  available(info) {
    if (
      !this.enabled ||
      this.disposed ||
      this.downloadPromise ||
      this.downloadedVersion ||
      this.installing
    )
      return;
    const version = cleanVersion(info?.version);
    if (!version) {
      this.availableVersion = null;
      this.fail(Error('INVALID_VERSION'), 'UPDATE_METADATA');
      return;
    }
    this.availableVersion = version;
    this.set({
      state: 'available',
      version,
      progress: null,
      errorCode: null,
      lastChecked: new Date().toISOString(),
    });
    if (!this.notified.has(version)) {
      this.notified.add(version);
      while (this.notified.size > 32) this.notified.delete(this.notified.values().next().value);
      try {
        Promise.resolve(this.notify(version)).catch(() => {});
      } catch {}
    }
  }
  downloaded(version) {
    this.downloadedVersion = version;
    return this.set({
      state: 'downloaded',
      version,
      progress: { percent: 100, transferred: 0, total: 0, bytesPerSecond: 0 },
      errorCode: null,
    });
  }
  installFailure(error) {
    if (this.installAttempt?.failed) return this.status();
    if (this.installAttempt) this.installAttempt.failed = true;
    this.installing = false;
    this.installPromise = null;
    const code = errorCode(error, 'UPDATE_INSTALL_FAILED');
    this.set({ state: 'downloaded', errorCode: code });
    try {
      Promise.resolve(this.onInstallFailure(code)).catch(() => {});
    } catch {}
    return this.status();
  }
  check() {
    if (
      !this.enabled ||
      this.disposed ||
      this.downloadPromise ||
      this.downloadedVersion ||
      this.installing
    )
      return Promise.resolve(this.status());
    if (this.checkPromise) return this.checkPromise;
    this.set({
      state: 'checking',
      errorCode: null,
      progress: null,
      lastChecked: new Date().toISOString(),
    });
    const operation = Promise.resolve()
      .then(() => this.updater.checkForUpdates())
      .then(() => {
        // The native updater normally emits its result before resolving. A missing
        // result is treated as unavailable metadata, not as a fabricated update.
        if (this.value.state === 'checking')
          this.fail(Error('INVALID_METADATA'), 'UPDATE_METADATA');
        return this.status();
      })
      .catch((error) => this.fail(error, 'UPDATE_CHECK_FAILED'))
      .finally(() => {
        if (this.checkPromise === operation) this.checkPromise = null;
      });
    this.checkPromise = operation;
    return operation;
  }
  download() {
    if (!this.enabled || this.disposed) return Promise.resolve(this.status());
    if (this.downloadPromise) return this.downloadPromise;
    if (this.downloadedVersion || this.installing) return Promise.resolve(this.status());
    if (this.checkPromise) return Promise.reject(Error('UPDATE_BUSY'));
    if (!this.availableVersion) return Promise.reject(Error('UPDATE_NOT_READY'));
    this.set({
      state: 'downloading',
      version: this.availableVersion,
      progress: cleanProgress({}),
      errorCode: null,
    });
    const operation = Promise.resolve()
      .then(() => this.updater.downloadUpdate())
      .then(() => {
        if (this.value.state === 'downloading') this.downloaded(this.availableVersion);
        return this.status();
      })
      .catch((error) => this.fail(error, 'UPDATE_DOWNLOAD_FAILED'))
      .finally(() => {
        if (this.downloadPromise === operation) this.downloadPromise = null;
      });
    this.downloadPromise = operation;
    return operation;
  }
  install() {
    if (!this.enabled || this.disposed) return Promise.resolve(this.status());
    if (this.installPromise) return this.installPromise;
    if (!this.downloadedVersion) return Promise.reject(Error('UPDATE_NOT_READY'));
    this.installAttempt = { failed: false };
    this.installing = true;
    this.set({ errorCode: null });
    const operation = Promise.resolve()
      .then(() => this.beforeInstall())
      .then(() => {
        this.updater.quitAndInstall(false, true);
        return this.status();
      })
      .catch((error) => this.installFailure(error));
    this.installPromise = operation;
    return operation;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [name, handler] of Object.entries(this.handlers))
      this.updater?.removeListener(name, handler);
    // A native network request may still finish during application shutdown.
    // Absorb its late EventEmitter error after our state subscriptions are gone.
    this.updater?.on('error', () => {});
  }
}
module.exports = { UpdateService, errorCode };
