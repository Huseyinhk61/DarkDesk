const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { powershell, SCRIPT } = require('./runtime/visibility.cjs');
test('Windows visibility waits for pipe closure and decodes split UTF-8 names after process exit', async () => {
  const file = 'C:\\Masaüstü\\Çalışma.exe';
  const results = [{ path: file, hidden: true }];
  const spawnProcess = (command, args) => {
    assert.equal(command, 'powershell.exe');
    assert.equal(args.at(-1), SCRIPT);
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    child.stdin.on('finish', () => {
      child.emit('exit', 0);
      setImmediate(() => {
        const bytes = Buffer.from(JSON.stringify(results));
        // Deliberately split inside the first multi-byte UTF-8 letter.
        const split = bytes.indexOf(Buffer.from('ü')) + 1;
        child.stdout.write(bytes.subarray(0, split));
        child.stdout.end(bytes.subarray(split));
        child.emit('close', 0);
      });
    });
    return child;
  };
  assert.deepEqual(
    await powershell({ action: 'get', items: [{ path: file }] }, spawnProcess),
    results,
  );
});
