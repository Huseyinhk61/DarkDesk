const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const SCRIPT =
  "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); [Console]::Write([Environment]::GetFolderPath([Environment+SpecialFolder]::CommonDesktopDirectory))";

async function resolveSharedDesktop({
  platform = process.platform,
  env = process.env,
  run = exec,
} = {}) {
  if (platform !== 'win32') return null;
  const valid = (value) =>
    typeof value === 'string' &&
    value.length < 32768 &&
    !/[\x00-\x1f]/.test(value) &&
    path.win32.isAbsolute(value);
  try {
    const { stdout } = await run(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', SCRIPT],
      { windowsHide: true, timeout: 8000, maxBuffer: 64 * 1024, encoding: 'utf8' },
    );
    const directory = stdout.replace(/^\uFEFF/, '').trim();
    if (valid(directory)) return path.win32.normalize(directory);
  } catch {}
  return valid(env.PUBLIC) ? path.win32.join(env.PUBLIC, 'Desktop') : null;
}
module.exports = { resolveSharedDesktop, SCRIPT };
