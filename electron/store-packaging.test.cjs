const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { readIdentity } = require('../scripts/store-config.cjs');
test('Store build loads the supplied public identity and disables installer publishing', () => {
  const identity = readIdentity(path.resolve(__dirname, '../build/store-identity.json'));
  assert.equal(identity.displayName, 'DarkDesk');
  assert.match(identity.publisher, /^CN=[A-F0-9-]+$/);
  const config = require('../electron-builder.store.cjs');
  assert.equal(config.appx.identityName, identity.identityName);
  assert.equal(config.appx.publisher, identity.publisher);
  assert.equal(config.publish, null);
  assert.equal(config.appx.minVersion, '10.0.19041.0');
  assert.deepEqual(config.win.target, [{ target: 'appx', arch: ['x64'] }]);
});
test('explicit missing or malformed identity files never silently fall back to another publisher', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-store-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'identity.json');
  assert.throws(() => readIdentity(file), /Missing Store identity/);
  await fs.writeFile(file, '{broken');
  assert.throws(() => readIdentity(file), /Missing Store identity/);
});
test('Store tiles are real branded PNGs at their required base dimensions', async () => {
  const shapes = {
    StoreLogo: [50, 50],
    Square44x44Logo: [44, 44],
    Square150x150Logo: [150, 150],
    Wide310x150Logo: [310, 150],
  };
  for (const [name, [width, height]] of Object.entries(shapes)) {
    const bytes = await fs.readFile(path.resolve(__dirname, `../build/appx/${name}.png`));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
    assert.ok(bytes.length > 1000);
  }
});
