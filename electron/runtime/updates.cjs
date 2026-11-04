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

function createUpdates(options, updateSource = source) {
  return updateSource.private === true ? new PrivateUpdates(options) : new PublicUpdates(options);
}

module.exports = { PublicUpdates, createUpdates };
