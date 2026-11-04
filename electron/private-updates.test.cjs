const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PrivateUpdates } = require('./runtime/private-updates.cjs');
const fixtureToken = 'dummy-access-fixture-never-a-real-key';
const replacementToken = 'dummy-replacement-fixture-not-a-key';
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
class Adapter extends EventEmitter {
  constructor() {
    super();
    this.checks = 0;
    this.downloads = 0;
    this.installs = 0;
    this.feeds = [];
  }
  setFeedURL(value) {
    this.feeds.push(value);
    this.currentFeed = value;
  }
  async checkForUpdates() {
    this.checks++;
    if (this.checkAction) return this.checkAction();
    this.emit('update-available', {
      version: '3.5.0',
      token: fixtureToken,
      files: [{ url: 'https://private.invalid' }],
    });
  }
  async downloadUpdate() {
    this.downloads++;
    if (this.downloadAction) await this.downloadAction();
    this.emit('update-downloaded', { version: '3.5.0' });
  }
  quitAndInstall() {
    this.installs++;
  }
}
async function fixture(options = {}) {
  let token = options.token ?? null;
  const adapter = new Adapter(),
    states = [],
    saved = [];
  const accessStore = {
    supported: () => true,
    status: async () => ({ supported: true, configured: token !== null }),
    read: async () => token,
    save: async (value) => {
      token = value;
      saved.push(value);
    },
    clear: async () => {
      token = null;
    },
  };
  const service = new PrivateUpdates({
    autoUpdater: adapter,
    accessStore,
    enabled: true,
    appVersion: '3.4.1',
    emit: (state) => states.push(state),
    ...options,
  });
  await service.initialize();
  return { service, adapter, accessStore, states, saved };
}
function assertSanitized(value) {
  const text = JSON.stringify(value);
  assert.equal(text.includes(fixtureToken), false);
  assert.equal(text.includes(replacementToken), false);
  assert.equal(text.includes('private.invalid'), false);
  assert.equal(text.includes('"token"'), false);
}
test('missing private access never starts network checks or downloads and exposes only access flags', async () => {
  const { service, adapter, states } = await fixture();
  assert.equal((await service.check()).errorCode, 'UPDATE_AUTH_REQUIRED');
  assert.equal((await service.download()).errorCode, 'UPDATE_AUTH_REQUIRED');
  assert.equal(adapter.checks, 0);
  assert.equal(adapter.downloads, 0);
  assert.deepEqual(
    [
      service.status().authenticationRequired,
      service.status().accessConfigured,
      service.status().accessSupported,
    ],
    [true, false, true],
  );
  assertSanitized(states);
  service.dispose();
});
test('a stored credential configures only the fixed private provider and stays out of every status', async () => {
  const { service, adapter, states } = await fixture({ token: fixtureToken });
  assert.equal(adapter.logger, null);
  assert.equal((await service.check()).state, 'available');
  assert.deepEqual(adapter.currentFeed, {
    provider: 'github',
    owner: 'Huseyinhk61',
    repo: 'DarkDesk',
    private: true,
    token: fixtureToken,
  });
  assert.equal((await service.download()).state, 'downloaded');
  assertSanitized([service.status(), states]);
  service.dispose();
});
test('rotating or clearing credentials invalidates available downloads until a fresh authenticated check', async () => {
  const { service, adapter } = await fixture({ token: fixtureToken });
  await service.check();
  await service.saveAccess(replacementToken);
  assert.equal(service.status().state, 'idle');
  await assert.rejects(service.download(), { message: 'UPDATE_NOT_READY' });
  assert.equal(adapter.currentFeed.provider, 'generic');
  await service.check();
  assert.equal(adapter.currentFeed.token, replacementToken);
  await service.clearAccess();
  assert.equal(service.status().accessConfigured, false);
  assert.equal(adapter.updateInfoAndProvider, null);
  assert.equal((await service.download()).errorCode, 'UPDATE_AUTH_REQUIRED');
  assert.equal(adapter.downloads, 0);
  assertSanitized(service.status());
  service.dispose();
});
test('private checks deduplicate during credential reads and credential mutation is blocked', async () => {
  const { service, adapter, accessStore } = await fixture({ token: fixtureToken });
  const gate = deferred();
  accessStore.read = () => gate.promise;
  const first = service.check(),
    second = service.check();
  assert.equal(first, second);
  await assert.rejects(service.saveAccess(replacementToken), { message: 'UPDATE_BUSY' });
  await assert.rejects(service.clearAccess(), { message: 'UPDATE_BUSY' });
  gate.resolve(fixtureToken);
  await first;
  assert.equal(adapter.checks, 1);
  service.dispose();
});
test('credentials cannot change during a download but removing them preserves an already verified installer', async () => {
  const order = [];
  const { service, adapter } = await fixture({
    token: fixtureToken,
    beforeInstall: async () => order.push('prepared'),
  });
  const gate = deferred();
  adapter.downloadAction = () => gate.promise;
  await service.check();
  const download = service.download();
  await assert.rejects(service.clearAccess(), { message: 'UPDATE_BUSY' });
  gate.resolve();
  await download;
  await service.clearAccess();
  assert.equal(service.status().state, 'downloaded');
  await service.install();
  assert.deepEqual(order, ['prepared']);
  assert.equal(adapter.installs, 1);
  service.dispose();
});
test('unsupported builds cannot persist a credential or contact the provider', async () => {
  const { service, adapter, saved } = await fixture({
    enabled: false,
    unsupportedReason: 'development',
  });
  assert.equal(service.status().state, 'unsupported');
  assert.equal(service.status().accessSupported, false);
  await service.check();
  await service.download();
  await assert.rejects(service.saveAccess(fixtureToken), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  assert.equal(saved.length, 0);
  assert.equal(adapter.checks, 0);
  service.dispose();
});
test('credential errors and HTTP authorization failures expose fixed errors without leaking request details', async () => {
  const { service, adapter, accessStore, states, saved } = await fixture({ token: fixtureToken });
  await assert.rejects(service.saveAccess(fixtureToken + '\n'), { message: 'UPDATE_AUTH_FAILED' });
  assert.equal(saved.length, 0);
  accessStore.read = async () => {
    throw Error('crypto failure ' + fixtureToken);
  };
  assert.equal((await service.check()).errorCode, 'UPDATE_ACCESS_UNAVAILABLE');
  assert.equal(adapter.checks, 0);
  accessStore.read = async () => fixtureToken;
  adapter.checkAction = async () => {
    throw Error('401 denied ' + fixtureToken);
  };
  assert.equal((await service.check()).errorCode, 'UPDATE_AUTH_FAILED');
  assertSanitized([service.status(), states]);
  service.dispose();
});
test('shutdown during a credential read cannot initiate a late network request', async () => {
  const { service, adapter, accessStore } = await fixture({ token: fixtureToken });
  const gate = deferred();
  accessStore.read = () => gate.promise;
  const check = service.check();
  service.dispose();
  gate.resolve(fixtureToken);
  await check;
  assert.equal(adapter.checks, 0);
});
