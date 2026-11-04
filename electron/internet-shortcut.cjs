const fs = require('node:fs/promises');
const { constants } = require('node:fs');

const MAX_BYTES = 64 * 1024;

// InternetShortcut metadata is local text. Reading it never resolves a URL or
// launches the referenced protocol. Bound the read even if a file grows.
async function readInternetShortcut(file) {
  const before = await fs.lstat(file);
  if (!before.isFile() || before.isSymbolicLink()) throw Error('SHORTCUT_UNSAFE');
  if (before.size > MAX_BYTES) throw Error('SHORTCUT_TOO_LARGE');
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino)
      throw Error('SHORTCUT_UNSAFE');
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > MAX_BYTES) throw Error('SHORTCUT_TOO_LARGE');
    let bytes = buffer.subarray(0, bytesRead);
    let text;
    if ((bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0 && bytes[1] === 0x5b)) {
      bytes = Buffer.from(bytes.subarray(bytes[0] === 0xfe ? 2 : 0));
      if (bytes.length % 2) bytes = bytes.subarray(0, bytes.length - 1);
      text = bytes.swap16().toString('utf16le');
    } else if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0x5b && bytes[1] === 0)) {
      text = bytes.subarray(bytes[0] === 0xff ? 2 : 0).toString('utf16le');
    } else text = bytes.toString('utf8').replace(/^\uFEFF/, '');
    let inSection = false;
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*\[/.test(line)) {
        inSection = /^\s*\[InternetShortcut\]\s*$/i.test(line);
        continue;
      }
      if (!inSection) continue;
      const match = /^\s*URL\s*=\s*(.*?)\s*$/i.exec(line);
      if (!match) continue;
      const launchUrl = match[1];
      if (
        launchUrl.length <= 8192 &&
        /^[a-z][a-z0-9+.-]*:/i.test(launchUrl) &&
        !/[\x00-\x1f\x7f]/.test(launchUrl)
      )
        return { launchUrl };
      return {};
    }
    return {};
  } finally {
    await handle.close();
  }
}

module.exports = { readInternetShortcut };
