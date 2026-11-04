const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PublicUpdates, createUpdates } = require('./runtime/updates.cjs');
const { PrivateUpdates } = require('./runtime/private-updates.cjs');
const source = require('../shared/update-source.json');

class Adapter extends EventEmitter {
  constructor() {
    super();
    this.checks = 0;
    this.downloads = 0;
    this.installs = 0;
  }
  setFeedURL(value) {
    this.feed = value;
  }
  async checkForUpdates() {
    this.checks++;
    if (this.failure) throw this.failure;
    this.emit('update-available', {
      version: '3.5.0',
      files: [{ url: 'https://untrusted.invalid/remote-details' }],
      releaseNotes: 'Remote release content must stay out of the renderer state',
    });
  }
  async downloadUpdate() {
    this.downloads++;
    this.emit('update-downloaded', { version: '3.5.0' });
  }
  quitAndInstall() {
    this.installs++;
  }
}
function fixture(overrides = {}) {
  const adapter = new Adapter();
  const states = [];
  const accessStore = new Proxy(
    {},
    {
      get() {
        assert.fail('Public updates must never access a stored private-repository key');
      },
    },
  );
  const service = createUpdates({
    autoUpdater: adapter,
    accessStore,
    appVersion: '3.4.2',
    enabled: true,
    emit: (value) => states.push(value),
    ...overrides,
  });
  return { adapter, service, states };
}

test('public updates check and download from the fixed unauthenticated GitHub provider', async () => {
  assert.equal(source.private, false);
  const { service, adapter, states } = fixture();
  assert.ok(service instanceof PublicUpdates);
  await service.initialize();
  assert.equal(adapter.logger, null);
  assert.deepEqual(adapter.feed, {
    provider: 'github',
    owner: 'Huseyinhk61',
    repo: 'DarkDesk',
    private: false,
  });
  assert.equal((await service.check()).state, 'available');
  assert.equal((await service.download()).state, 'downloaded');
  assert.equal(adapter.checks, 1);
  assert.equal(adapter.downloads, 1);
  for (const state of [service.status(), ...states]) {
    assert.equal(state.authenticationRequired, false);
    assert.equal(state.accessConfigured, false);
    assert.equal(state.accessSupported, false);
    assert.equal('token' in state, false);
    assert.equal(JSON.stringify(state).includes('untrusted.invalid'), false);
    assert.equal(JSON.stringify(state).includes('releaseNotes'), false);
  }
  service.dispose();
});

test('public builds reject credential mutation and preserve explicit install preparation', async () => {
  const order = [];
  const { service, adapter } = fixture({ beforeInstall: async () => order.push('prepared') });
  await assert.rejects(service.saveAccess('DUMMY_NOT_A_REAL_KEY_1234567890'), {
    message: 'UPDATE_ACCESS_UNAVAILABLE',
  });
  await assert.rejects(service.clearAccess(), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  await assert.rejects(service.install(), { message: 'UPDATE_NOT_READY' });
  await service.check();
  assert.equal(adapter.downloads, 0);
  assert.equal(adapter.installs, 0);
  await service.download();
  await service.install();
  assert.deepEqual(order, ['prepared']);
  assert.equal(adapter.installs, 1);
  assert.equal(adapter.autoDownload, false);
  assert.equal(adapter.autoInstallOnAppQuit, false);
  service.dispose();
});

test('unsupported public builds keep manual updates and never configure or contact a provider', async () => {
  for (const reason of ['development', 'portable', 'platform']) {
    const { service, adapter } = fixture({ enabled: false, unsupportedReason: reason });
    assert.equal((await service.initialize()).state, 'unsupported');
    assert.equal(service.status().reason, reason);
    assert.equal(service.status().authenticationRequired, false);
    await service.check();
    await service.download();
    assert.equal(adapter.feed, undefined);
    assert.equal(adapter.checks, 0);
    assert.equal(adapter.downloads, 0);
    service.dispose();
  }
});

test('failed public feed configuration cannot fall back to a stale private provider', async () => {
  const adapter = new Adapter();
  adapter.setFeedURL = () => {
    throw Error('remote configuration failure');
  };
  const { service } = fixture({ autoUpdater: adapter });
  assert.equal((await service.initialize()).errorCode, 'UPDATE_METADATA');
  assert.equal((await service.check()).errorCode, 'UPDATE_METADATA');
  assert.equal(adapter.checks, 0);
  service.dispose();
});

test('unpublished or inaccessible public releases report a fixed error and allow retry', async () => {
  const { service, adapter } = fixture();
  adapter.failure = Error('404 https://untrusted.invalid/private-path');
  const failure = await service.check();
  assert.equal(failure.state, 'error');
  assert.equal(failure.errorCode, 'UPDATE_SOURCE_UNAVAILABLE');
  assert.equal(JSON.stringify(failure).includes('untrusted.invalid'), false);
  adapter.failure = null;
  assert.equal((await service.check()).state, 'available');
  service.dispose();
});

test('public HTTP authorization errors never ask users to configure a private access key', async () => {
  for (const httpStatus of [401, 403]) {
    const { service, adapter, states } = fixture();
    adapter.failure = Error(`${httpStatus} https://untrusted.invalid/private-path`);
    const failure = await service.check();
    assert.equal(failure.state, 'error');
    assert.equal(failure.errorCode, 'UPDATE_SOURCE_UNAVAILABLE');
    assert.equal(failure.authenticationRequired, false);
    assert.equal(
      states.some((state) => state.errorCode === 'UPDATE_AUTH_FAILED'),
      false,
    );
    assert.equal(JSON.stringify(states).includes('untrusted.invalid'), false);
    adapter.failure = null;
    assert.equal((await service.check()).state, 'available');
    adapter.downloadUpdate = async () => {
      throw Error(`${httpStatus} download denied`);
    };
    assert.equal((await service.download()).errorCode, 'UPDATE_SOURCE_UNAVAILABLE');
    service.dispose();
  }
});

test('explicit private source selection retains the existing encrypted-access flow', () => {
  const service = createUpdates(
    {
      autoUpdater: new Adapter(),
      accessStore: { supported: () => true },
      enabled: true,
      appVersion: '3.4.2',
    },
    { ...source, private: true },
  );
  assert.ok(service instanceof PrivateUpdates);
  assert.equal(service.status().authenticationRequired, true);
  service.dispose();
});
