const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveSharedDesktop, SCRIPT } = require('./runtime/desktop-paths.cjs');
test('common desktop uses the Windows known folder and an OS environment fallback', async () => {
  let calls = 0;
  const run = async (file, args, options) => {
    calls++;
    assert.equal(file, 'powershell.exe');
    assert.equal(args.at(-1), SCRIPT);
    assert.equal(options.windowsHide, true);
    assert.ok(options.timeout <= 8000);
    return { stdout: '\uFEFFD:\\Shared Desktop\\\r\n' };
  };
  assert.equal(
    await resolveSharedDesktop({ platform: 'win32', env: {}, run }),
    'D:\\Shared Desktop\\',
  );
  assert.equal(calls, 1);
  assert.equal(
    await resolveSharedDesktop({
      platform: 'win32',
      env: { PUBLIC: 'C:\\Users\\Public' },
      run: async () => {
        throw Error('unavailable');
      },
    }),
    'C:\\Users\\Public\\Desktop',
  );
  assert.equal(
    await resolveSharedDesktop({
      platform: 'win32',
      env: { PUBLIC: 'relative' },
      run: async () => ({ stdout: 'relative' }),
    }),
    null,
  );
  assert.equal(
    await resolveSharedDesktop({
      platform: 'linux',
      run: async () => assert.fail('No Windows process on Linux'),
    }),
    null,
  );
});
