const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { UpdateService } = require('./runtime/updater.cjs');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
class Updater extends EventEmitter {
  constructor() {
    super();
    this.checks = 0;
    this.downloads = 0;
    this.installs = [];
  }
  async checkForUpdates() {
    this.checks++;
    if (this.checkBehavior) return this.checkBehavior();
    this.emit('update-available', {
      version: '3.5.0',
      releaseNotes: '<script>remote</script>',
      files: [{ url: 'https://example.invalid/private.exe?token=secret' }],
    });
    return { updateInfo: { version: '3.5.0' } };
  }
  async downloadUpdate() {
    this.downloads++;
    if (this.downloadBehavior) return this.downloadBehavior();
    this.emit('update-downloaded', { version: '3.5.0' });
    return ['C:\\private\\download.exe'];
  }
  quitAndInstall(...args) {
    this.installs.push(args);
  }
}
const fixture = (options = {}) => {
  const adapter = new Updater(),
    states = [],
    notifications = [];
  const service = new UpdateService({
    autoUpdater: adapter,
    appVersion: '3.4.0',
    emit: (state) => states.push(state),
    notify: (version) => notifications.push(version),
    ...options,
  });
  return { adapter, service, states, notifications };
};
test('updater disables automatic downloads and installation, exposes only sanitized release state', async () => {
  const { adapter, service, notifications } = fixture();
  assert.equal(adapter.autoDownload, false);
  assert.equal(adapter.autoInstallOnAppQuit, false);
  assert.equal(adapter.allowPrerelease, false);
  assert.equal(adapter.allowDowngrade, false);
  assert.equal(adapter.checks, 0);
  assert.equal((await service.check()).state, 'available');
  assert.deepEqual(notifications, ['3.5.0']);
  assert.equal(service.status().version, '3.5.0');
  assert.ok(!/remote|script|url|token|private/.test(JSON.stringify(service.status())));
  assert.equal(adapter.downloads, 0);
  assert.equal(adapter.installs.length, 0);
  service.dispose();
});
test('unsupported development, portable and platform states never request or install updates', async () => {
  for (const reason of ['development', 'portable', 'platform', 'unavailable']) {
    const { adapter, service } = fixture({ enabled: false, unsupportedReason: reason });
    assert.equal(service.status().reason, reason);
    assert.equal((await service.check()).state, 'unsupported');
    assert.equal((await service.download()).state, 'unsupported');
    assert.equal((await service.install()).state, 'unsupported');
    assert.equal(adapter.checks + adapter.downloads + adapter.installs.length, 0);
    service.dispose();
  }
});
test('simultaneous checks share one native operation and notify once per version', async () => {
  const { adapter, service, notifications } = fixture();
  const wait = deferred();
  adapter.checkBehavior = () => wait.promise;
  const first = service.check(),
    second = service.check();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(adapter.checks, 1);
  adapter.emit('update-available', { version: '3.5.0' });
  wait.resolve({ updateInfo: { version: '3.5.0' } });
  await first;
  adapter.checkBehavior = async () => adapter.emit('update-available', { version: '3.5.0' });
  await service.check();
  assert.deepEqual(notifications, ['3.5.0']);
  adapter.emit('update-available', { version: '3.6.0' });
  assert.deepEqual(notifications, ['3.5.0', '3.6.0']);
  service.dispose();
});
test('no-update result clears previous availability and malformed or missing metadata is not advertised', async () => {
  const { adapter, service } = fixture();
  await service.check();
  adapter.checkBehavior = async () => adapter.emit('update-not-available');
  assert.equal((await service.check()).state, 'not-available');
  assert.equal(service.status().version, null);
  await assert.rejects(service.download(), /UPDATE_NOT_READY/);
  adapter.checkBehavior = async () =>
    adapter.emit('update-available', { version: '<img src=remote>' });
  assert.equal((await service.check()).errorCode, 'UPDATE_METADATA');
  adapter.checkBehavior = async () => undefined;
  assert.equal((await service.check()).errorCode, 'UPDATE_METADATA');
  service.dispose();
});
test('network and private-source errors are sanitized and a later check can recover', async () => {
  const { adapter, service } = fixture();
  adapter.checkBehavior = async () => {
    throw Object.assign(Error('https://host/?token=secret'), { code: 'ENOTFOUND' });
  };
  assert.equal((await service.check()).errorCode, 'UPDATE_NETWORK');
  assert.ok(!JSON.stringify(service.status()).includes('secret'));
  adapter.checkBehavior = async () => {
    throw Error('HTTP 404: private https://host/?token=secret');
  };
  assert.equal((await service.check()).errorCode, 'UPDATE_SOURCE_UNAVAILABLE');
  adapter.checkBehavior = async () => adapter.emit('update-not-available');
  assert.equal((await service.check()).state, 'not-available');
  service.dispose();
});
test('downloads require an advertised update and duplicate calls share progress and completion', async () => {
  const { adapter, service } = fixture();
  await assert.rejects(service.download(), /UPDATE_NOT_READY/);
  await assert.rejects(service.install(), /UPDATE_NOT_READY/);
  await service.check();
  const wait = deferred();
  adapter.downloadBehavior = () => wait.promise;
  const first = service.download(),
    second = service.download();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(adapter.downloads, 1);
  adapter.emit('download-progress', {
    percent: 25,
    transferred: 50,
    total: 200,
    bytesPerSecond: 100,
  });
  assert.deepEqual(service.status().progress, {
    percent: 25,
    transferred: 50,
    total: 200,
    bytesPerSecond: 100,
  });
  assert.equal((await service.check()).state, 'downloading');
  adapter.emit('download-progress', { percent: 1000, transferred: -2, total: Infinity });
  assert.deepEqual(service.status().progress, {
    percent: 100,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0,
  });
  adapter.emit('update-downloaded', { version: '3.5.0', downloadedFile: 'private/path' });
  wait.resolve(['private/path']);
  assert.equal((await first).state, 'downloaded');
  assert.equal(adapter.installs.length, 0);
  assert.equal((await service.download()).state, 'downloaded');
  assert.equal(adapter.downloads, 1);
  service.dispose();
});
test('failed checksum and cancelled downloads do not become installable and can retry', async () => {
  const { adapter, service } = fixture();
  await service.check();
  adapter.downloadBehavior = async () => {
    throw Object.assign(Error('sha512 mismatch secret-path'), {
      code: 'ERR_UPDATER_CHECKSUM_MISMATCH',
    });
  };
  assert.equal((await service.download()).errorCode, 'UPDATE_INTEGRITY');
  await assert.rejects(service.install(), /UPDATE_NOT_READY/);
  adapter.downloadBehavior = async () => {
    throw Object.assign(Error('cancelled'), { code: 'ERR_CANCELLED' });
  };
  assert.equal((await service.download()).errorCode, 'UPDATE_CANCELLED');
  adapter.downloadBehavior = async () => {
    adapter.emit('update-downloaded', { version: '3.5.0' });
    return ['verified'];
  };
  assert.equal((await service.download()).state, 'downloaded');
  service.dispose();
});
test('a downloaded event for a different version is rejected', async () => {
  const { adapter, service } = fixture();
  await service.check();
  adapter.downloadBehavior = async () => adapter.emit('update-downloaded', { version: '4.0.0' });
  assert.equal((await service.download()).errorCode, 'UPDATE_METADATA');
  await assert.rejects(service.install(), /UPDATE_NOT_READY/);
  service.dispose();
});
test('restart waits for file-operation/profile preparation and installs only once', async () => {
  const wait = deferred(),
    order = [];
  const { adapter, service } = fixture({
    beforeInstall: async () => {
      order.push('prepare');
      await wait.promise;
      order.push('restored');
    },
  });
  adapter.quitAndInstall = (...args) => {
    order.push('install');
    adapter.installs.push(args);
  };
  await service.check();
  await service.download();
  const first = service.install(),
    second = service.install();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(service.installing, true);
  assert.deepEqual(order, ['prepare']);
  assert.equal(adapter.installs.length, 0);
  wait.resolve();
  await first;
  assert.deepEqual(order, ['prepare', 'restored', 'install']);
  assert.deepEqual(adapter.installs, [[false, true]]);
  await service.install();
  assert.equal(adapter.installs.length, 1);
  service.dispose();
});
test('busy preparation keeps a downloaded update retryable and does not quit', async () => {
  let busy = true;
  const { adapter, service } = fixture({
    beforeInstall: async () => {
      if (busy) throw Error('OPERATION_BUSY');
    },
  });
  await service.check();
  await service.download();
  const failed = await service.install();
  assert.equal(failed.state, 'downloaded');
  assert.equal(failed.errorCode, 'UPDATE_BUSY');
  assert.equal(service.installing, false);
  assert.equal(adapter.installs.length, 0);
  busy = false;
  await service.install();
  assert.equal(adapter.installs.length, 1);
  service.dispose();
});
test('notification, renderer and late native errors cannot throw through event handlers', async () => {
  const { adapter, service } = fixture({
    emit: () => {
      throw Error('renderer gone');
    },
    notify: async () => {
      throw Error('notification permission');
    },
  });
  await service.check();
  await service.download();
  adapter.emit('error', Object.assign(Error('late network'), { code: 'ENOTFOUND' }));
  assert.equal(service.status().state, 'downloaded');
  service.dispose();
  assert.doesNotThrow(() => adapter.emit('error', Error('late after shutdown')));
  assert.equal((await service.check()).state, 'downloaded');
});
test('installer launch errors emitted by electron-updater recover lifecycle and allow retry', async () => {
  const recovery = [];
  const { adapter, service } = fixture({ onInstallFailure: (code) => recovery.push(code) });
  await service.check();
  await service.download();
  adapter.quitAndInstall = () => adapter.emit('error', Error('installer launch secret-path'));
  const failed = await service.install();
  assert.equal(failed.state, 'downloaded');
  assert.equal(failed.errorCode, 'UPDATE_INSTALL_FAILED');
  assert.equal(service.installing, false);
  assert.deepEqual(recovery, ['UPDATE_INSTALL_FAILED']);
  adapter.quitAndInstall = (...args) => adapter.installs.push(args);
  await service.install();
  assert.deepEqual(adapter.installs, [[false, true]]);
  service.dispose();
});
test('asynchronous installer failure is recovered once after the restart call resolves', async () => {
  const recovery = [];
  const { adapter, service } = fixture({ onInstallFailure: (code) => recovery.push(code) });
  await service.check();
  await service.download();
  await service.install();
  adapter.emit('error', Error('could not start installer'));
  assert.equal(service.status().errorCode, 'UPDATE_INSTALL_FAILED');
  assert.equal(service.installing, false);
  assert.deepEqual(recovery, ['UPDATE_INSTALL_FAILED']);
  service.dispose();
});
