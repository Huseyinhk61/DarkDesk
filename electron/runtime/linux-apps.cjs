const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const { spawn } = require('node:child_process');
async function readDesktopEntry(file, language = 'en') {
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 262144) throw Error('DESKTOP_ENTRY_INVALID');
    const buffer = Buffer.alloc(262145);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 262144) throw Error('DESKTOP_ENTRY_INVALID');
    const text = buffer
      .subarray(0, bytesRead)
      .toString('utf8')
      .replace(/^\uFEFF/, '');
    const values = {};
    let section = false;
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*\[/.test(line)) {
        section = line.trim() === '[Desktop Entry]';
        continue;
      }
      if (!section || /^\s*#/.test(line)) continue;
      const match = /^([A-Za-z]+(?:\[[A-Za-z_@.-]+\])?)=(.*)$/.exec(line);
      if (match && /^(Name|Comment|Type|Hidden|NoDisplay)(\[.*\])?$/.test(match[1]))
        values[match[1]] = match[2];
    }
    const clean = (value) =>
      String(value || '')
        .replace(/\\([sntr\\])/g, (_, key) => ({ s: ' ', n: ' ', t: ' ', r: ' ', '\\': '\\' })[key])
        .replace(/[\x00-\x1f\x7f]/g, ' ')
        .trim()
        .slice(0, 1024);
    const translated = (key) => clean(values[key + '[' + language + ']'] || values[key]);
    return {
      productName: translated('Name'),
      desktopDescription: translated('Comment'),
      hidden: values.Hidden === 'true' || values.NoDisplay === 'true',
      application: values.Type === 'Application',
    };
  } finally {
    await handle.close();
  }
}
function launchLinuxItem(item, { openPath, spawnProcess = spawn } = {}) {
  const extension = require('node:path').extname(item.source).toLowerCase();
  if (!['.desktop', '.appimage'].includes(extension))
    return openPath(item.source).then((error) => {
      if (error) throw Error('LAUNCH_FAILED: ' + error);
    });
  return new Promise((resolve, reject) => {
    const desktop = extension === '.desktop';
    const child = spawnProcess(
      desktop ? 'gio' : item.source,
      desktop ? ['launch', item.source] : [],
      { shell: false, detached: !desktop, stdio: 'ignore' },
    );
    let timer;
    const failed = () => {
      clearTimeout(timer);
      reject(Error('LAUNCH_FAILED'));
    };
    child.once('error', failed);
    if (desktop) {
      timer = setTimeout(() => {
        child.kill?.();
        failed();
      }, 5000);
      child.once('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else failed();
      });
    } else
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
  });
}
module.exports = { readDesktopEntry, launchLinuxItem };
