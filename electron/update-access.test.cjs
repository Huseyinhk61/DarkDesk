const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { UpdateAccessStore } = require('./runtime/update-access.cjs');

const token = 'dummy-github-credential-for-fixture-only';
function encryption() {
  const key = crypto.randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
    },
    decryptString(value) {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString(
        'utf8',
      );
    },
  };
}
async function fixture(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-update-access-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const safeStorage = encryption();
  const store = new UpdateAccessStore({ directory, platform: 'win32', safeStorage, ...overrides });
  return { directory, store, safeStorage, file: path.join(directory, 'update-access.bin') };
}

test('private update access is encrypted at rest and status exposes no credential', async (t) => {
  const { directory, store, file } = await fixture(t);
  assert.equal(store.supported(), true);
  assert.equal(await store.read(), null);
  assert.deepEqual(await store.status(), { supported: true, configured: false });
  assert.equal(await store.save(token), undefined);
  assert.equal(await store.read(), token);
  const ciphertext = await fs.readFile(file);
  assert.equal(ciphertext.includes(Buffer.from(token)), false);
  assert.deepEqual(await store.status(), { supported: true, configured: true });
  if (process.platform !== 'win32') assert.equal((await fs.stat(file)).mode & 0o077, 0);
  assert.deepEqual(await fs.readdir(directory), ['update-access.bin']);
  await store.clear();
  assert.equal(await store.read(), null);
  assert.deepEqual(await store.status(), { supported: true, configured: false });
});

test('unsupported platforms or unavailable safeStorage never save a plaintext fallback', async (t) => {
  for (const overrides of [
    { platform: 'linux' },
    { platform: 'darwin' },
    { safeStorage: { isEncryptionAvailable: () => false } },
    {
      safeStorage: {
        isEncryptionAvailable: () => {
          throw Error('fixture unavailable');
        },
      },
    },
  ]) {
    const { directory, store } = await fixture(t, overrides);
    assert.equal(store.supported(), false);
    assert.deepEqual(await store.status(), { supported: false, configured: false });
    await assert.rejects(store.save(token), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
    await assert.rejects(store.read(), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
    assert.deepEqual(await fs.readdir(directory), []);
  }
});

test('token validation rejects invalid data without replacing an existing credential', async (t) => {
  const { store } = await fixture(t);
  await store.save(token);
  for (const invalid of [
    null,
    {},
    '',
    'x'.repeat(19),
    'x'.repeat(513),
    token + '\n',
    token + '\0',
    ' ' + token,
    token + '\u200b',
  ]) {
    await assert.rejects(store.save(invalid), { message: 'UPDATE_AUTH_FAILED' });
    assert.equal(await store.read(), token);
  }
  const futureFormat = 'future-format:credential_1234567890';
  await store.save(futureFormat);
  assert.equal(await store.read(), futureFormat);
});

test('corrupt ciphertext and another user encryption key fail closed without deletion', async (t) => {
  const { directory, store, file } = await fixture(t);
  await store.save(token);
  const before = await fs.readFile(file);
  const otherUser = new UpdateAccessStore({
    directory,
    safeStorage: encryption(),
    platform: 'win32',
  });
  await assert.rejects(otherUser.read(), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  assert.deepEqual(await fs.readFile(file), before);
  await fs.writeFile(file, Buffer.from('corrupt fixture'));
  await assert.rejects(store.read(), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  await assert.rejects(store.status(), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  assert.equal(await fs.readFile(file, 'utf8'), 'corrupt fixture');
});

test('symlink credential paths are refused for read, save and clear', async (t) => {
  const { directory, store, file, safeStorage } = await fixture(t);
  const outside = path.join(directory, 'unrelated.bin');
  const ciphertext = safeStorage.encryptString(token);
  await fs.writeFile(outside, ciphertext);
  try {
    await fs.symlink(outside, file, 'file');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('File symlink privilege is unavailable');
    throw error;
  }
  await assert.rejects(store.read(), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  await assert.rejects(store.save(token), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  await assert.rejects(store.clear(), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  assert.deepEqual(await fs.readFile(outside), ciphertext);
  assert.equal((await fs.lstat(file)).isSymbolicLink(), true);
});

test('serialized writes and clearing cannot revive an old credential', async (t) => {
  const { store, directory } = await fixture(t);
  const newest = token + '-new';
  await Promise.all([store.save(token), store.clear(), store.save(newest)]);
  assert.equal(await store.read(), newest);
  await Promise.all([store.save(token), store.save(newest), store.clear()]);
  assert.equal(await store.read(), null);
  assert.deepEqual(await fs.readdir(directory), []);
});

test('storage failures return only a fixed error and do not leave temporary credentials', async (t) => {
  const { directory, safeStorage, file } = await fixture(t);
  const store = new UpdateAccessStore({
    directory,
    platform: 'win32',
    safeStorage: {
      ...safeStorage,
      encryptString: () => {
        throw Error(token);
      },
    },
  });
  await assert.rejects(store.save(token), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  assert.deepEqual(await fs.readdir(directory), []);
  await fs.mkdir(file);
  await assert.rejects(store.read(), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  await assert.rejects(store.save(token), { message: 'UPDATE_ACCESS_UNAVAILABLE' });
  assert.equal((await fs.stat(file)).isDirectory(), true);
});
