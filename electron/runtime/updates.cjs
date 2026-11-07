const { UpdateService } = require('./updater.cjs');
const { PrivateUpdates } = require('./private-updates.cjs');
const source = require('../../shared/update-source.json');

// Public releases never read or send a saved credential. In particular, an old
// private-repository key cannot silently change the GitHub provider back to an
// authenticated provider after upgrading from a private build.
class PublicUpdates extends UpdateService {
  constructor({ accessStore: _unusedAccessStore, ...options }) {
    super(options);
    this.feedConfigured = false;
    if (this.updater) this.updater.logger = null;
    if (this.enabled) {
      try {
        this.updater.setFeedURL({
          provider: source.provider,
          owner: source.owner,
          repo: source.repo,
          private: false,
        });
        this.feedConfigured = true;
      } catch {
        this.fail(Error('INVALID_METADATA'), 'UPDATE_METADATA');
      }
    }
  }
  status() {
    return {
      ...super.status(),
      authenticationRequired: false,
      accessConfigured: false,
      accessSupported: false,
    };
  }
  set(patch) {
    // HTTP 401/403 from a public release means the source is unavailable (for
    // example, rate limiting or a repository that is still private). Asking for
    // a personal token would be misleading: this provider never uses one.
    return super.set(
      patch.errorCode === 'UPDATE_AUTH_FAILED'
        ? { ...patch, errorCode: 'UPDATE_SOURCE_UNAVAILABLE' }
        : patch,
    );
  }
  async initialize() {
    return this.status();
  }
  check() {
    if (this.enabled && !this.feedConfigured)
      return Promise.resolve(this.fail(Error('INVALID_METADATA'), 'UPDATE_METADATA'));
    return super.check();
  }
  saveAccess() {
    return Promise.reject(Error('UPDATE_ACCESS_UNAVAILABLE'));
  }
  clearAccess() {
    return Promise.reject(Error('UPDATE_ACCESS_UNAVAILABLE'));
  }
}

class StoreUpdates {
  constructor({ appVersion }) {
    this.appVersion = appVersion;
  }
  status() {
    return {
      state: 'unsupported',
      reason: 'store',
      currentVersion: this.appVersion,
      version: null,
      authenticationRequired: false,
      accessConfigured: false,
      accessSupported: false,
    };
  }
  async initialize() {
    return this.status();
  }
  async check() {
    return this.status();
  }
  async download() {
    throw Error('UPDATE_STORE_MANAGED');
  }
  async install() {
    throw Error('UPDATE_STORE_MANAGED');
  }
  async saveAccess() {
    throw Error('UPDATE_ACCESS_UNAVAILABLE');
  }
  async clearAccess() {
    throw Error('UPDATE_ACCESS_UNAVAILABLE');
  }
  dispose() {}
}
function createUpdates(options, updateSource = source) {
  if (options.windowsStore === true) return new StoreUpdates(options);
  return updateSource.private === true ? new PrivateUpdates(options) : new PublicUpdates(options);
}

module.exports = { PublicUpdates, StoreUpdates, createUpdates };
