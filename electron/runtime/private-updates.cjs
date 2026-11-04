const { UpdateService } = require('./updater.cjs');

const validAccess = (token) =>
  typeof token === 'string' &&
  token.length >= 20 &&
  token.length <= 512 &&
  !/[\s\p{C}]/u.test(token);

// The renderer receives update state and access flags only. The credential is
// decrypted just before a check and passed directly to the private provider.
class PrivateUpdates {
  constructor({ autoUpdater, accessStore, emit = () => {}, ...options }) {
    this.updater = autoUpdater;
    this.access = accessStore;
    this.enabled = options.enabled === true && !!autoUpdater;
    this.accessSupported = this.enabled && accessStore.supported();
    this.accessConfigured = false;
    this.generation = 0;
    this.checkedGeneration = -1;
    this.checkOperation = null;
    this.accessOperation = null;
    this.disposed = false;
    // Provider HTTP errors can contain authenticated request details. Keep the
    // library logger quiet; the service emits fixed, localized error codes.
    if (this.updater) this.updater.logger = null;
    this.service = new UpdateService({
      ...options,
      autoUpdater,
      emit: (state) => emit(this.decorate(state)),
    });
  }
  decorate(state) {
    return {
      ...state,
      authenticationRequired: true,
      accessConfigured: this.accessConfigured,
      accessSupported: this.accessSupported,
    };
  }
  status() {
    return this.decorate(this.service.status());
  }
  get installing() {
    return this.service.installing;
  }
  async initialize() {
    if (!this.accessSupported) return this.status();
    try {
      this.accessConfigured = (await this.access.status()).configured === true;
      if (!this.accessConfigured) this.fail('UPDATE_AUTH_REQUIRED');
    } catch {
      this.fail('UPDATE_ACCESS_UNAVAILABLE');
    }
    return this.status();
  }
  fail(code) {
    this.service.set({
      state: this.service.downloadedVersion ? 'downloaded' : 'error',
      errorCode: code,
      progress: null,
    });
    return this.status();
  }
  busy() {
    return !!(
      this.checkOperation ||
      this.accessOperation ||
      this.service.checkPromise ||
      this.service.downloadPromise ||
      this.installing
    );
  }
  forgetProvider() {
    this.checkedGeneration = -1;
    if (!this.service.downloadedVersion) this.service.availableVersion = null;
    // Replacing the provider drops its in-memory credential. It cannot be used
    // for network requests: every check first supplies a stored private token.
    try {
      this.updater?.setFeedURL({ provider: 'generic', url: 'https://updates.invalid/' });
    } catch {
      // Download gating still requires a fresh authenticated check if replacing
      // an unavailable provider fails during shutdown.
      if (this.updater) this.updater.clientPromise = null;
    }
    // electron-updater caches the provider alongside available download info.
    // Clear that cache on rotation as well as replacing clientPromise above.
    if (this.updater) this.updater.updateInfoAndProvider = null;
  }
  check() {
    if (
      !this.enabled ||
      this.disposed ||
      this.service.downloadPromise ||
      this.installing ||
      this.service.downloadedVersion
    )
      return Promise.resolve(this.status());
    if (this.checkOperation) return this.checkOperation;
    if (this.accessOperation) return Promise.reject(Error('UPDATE_BUSY'));
    this.service.set({ state: 'checking', errorCode: null, progress: null });
    const operation = Promise.resolve()
      .then(async () => {
        if (!this.accessSupported) return this.fail('UPDATE_ACCESS_UNAVAILABLE');
        let token;
        try {
          token = await this.access.read();
        } catch {
          return this.fail('UPDATE_ACCESS_UNAVAILABLE');
        }
        if (this.disposed) return this.status();
        this.accessConfigured = validAccess(token);
        if (!this.accessConfigured) return this.fail('UPDATE_AUTH_REQUIRED');
        const generation = this.generation;
        try {
          this.updater.setFeedURL({
            provider: 'github',
            owner: 'Huseyinhk61',
            repo: 'DarkDesk',
            private: true,
            token,
          });
        } catch {
          return this.fail('UPDATE_METADATA');
        }
        await this.service.check();
        this.checkedGeneration = this.service.status().state === 'available' ? generation : -1;
        return this.status();
      })
      .finally(() => {
        if (this.checkOperation === operation) this.checkOperation = null;
      });
    this.checkOperation = operation;
    return operation;
  }
  download() {
    if (!this.enabled || this.disposed) return Promise.resolve(this.status());
    if (this.checkOperation || this.accessOperation) return Promise.reject(Error('UPDATE_BUSY'));
    if (!this.accessConfigured) return Promise.resolve(this.fail('UPDATE_AUTH_REQUIRED'));
    if (this.checkedGeneration !== this.generation && !this.service.downloadedVersion)
      return Promise.reject(Error('UPDATE_NOT_READY'));
    return this.service.download().then(() => this.status());
  }
  install() {
    if (this.accessOperation || this.checkOperation) return Promise.reject(Error('UPDATE_BUSY'));
    return this.service.install().then(() => this.status());
  }
  changeAccess(action) {
    if (!this.enabled || this.disposed || !this.accessSupported)
      return Promise.reject(Error('UPDATE_ACCESS_UNAVAILABLE'));
    if (this.busy()) return Promise.reject(Error('UPDATE_BUSY'));
    const operation = Promise.resolve()
      .then(action)
      .finally(() => {
        if (this.accessOperation === operation) this.accessOperation = null;
      });
    this.accessOperation = operation;
    return operation;
  }
  saveAccess(token) {
    if (!validAccess(token)) return Promise.reject(Error('UPDATE_AUTH_FAILED'));
    return this.changeAccess(async () => {
      try {
        await this.access.save(token);
      } catch {
        throw Error('UPDATE_ACCESS_UNAVAILABLE');
      }
      this.accessConfigured = true;
      this.generation++;
      this.forgetProvider();
      this.service.set({
        state: this.service.downloadedVersion ? 'downloaded' : 'idle',
        errorCode: null,
        version: this.service.downloadedVersion || null,
      });
      return this.status();
    });
  }
  clearAccess() {
    return this.changeAccess(async () => {
      try {
        await this.access.clear();
      } catch {
        throw Error('UPDATE_ACCESS_UNAVAILABLE');
      }
      this.accessConfigured = false;
      this.generation++;
      this.forgetProvider();
      this.service.set({
        state: this.service.downloadedVersion ? 'downloaded' : 'idle',
        errorCode: null,
        version: this.service.downloadedVersion || null,
      });
      return this.status();
    });
  }
  dispose() {
    this.disposed = true;
    this.service.dispose();
  }
}
module.exports = { PrivateUpdates };
