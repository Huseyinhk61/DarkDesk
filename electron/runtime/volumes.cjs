const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
function linuxMounts(text) {
  const result = [],
    seen = new Set();
  for (const line of text.slice(0, 1024 * 1024).split('\n')) {
    const halves = line.split(' - '),
      fields = halves[0]?.split(' '),
      fs = halves[1]?.split(' ');
    if (!fields || !fs || !fs[1]?.startsWith('/dev/') || seen.has(fields[2])) continue;
    const mount = fields[4]?.replace(/\\(040|011|012|134)/g, (_, octal) =>
      String.fromCharCode(parseInt(octal, 8)),
    );
    if (!mount?.startsWith('/')) continue;
    seen.add(fields[2]);
    result.push({ path: mount, label: path.basename(fs[1]), filesystem: fs[0] });
  }
  return result;
}
async function listVolumes({
  platform = process.platform,
  fallback = '/',
  executeFile = execute,
  readFile = fs.readFile,
} = {}) {
  if (platform === 'win32') {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const { stdout } = await executeFile(
      path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);@(Get-CimInstance Win32_LogicalDisk | Where-Object {$_.DriveType -in 2,3,4} | Select-Object DeviceID,VolumeName,FileSystem,Size,FreeSpace)|ConvertTo-Json -Compress',
      ],
      { windowsHide: true, timeout: 10000, maxBuffer: 128 * 1024 },
    );
    const data = JSON.parse(stdout.replace(/^\uFEFF/, ''));
    return (Array.isArray(data) ? data : [data])
      .filter((d) => /^[A-Z]:$/i.test(d?.DeviceID))
      .slice(0, 64)
      .map((d) => ({
        path: d.DeviceID + '\\',
        label: d.VolumeName || d.DeviceID,
        filesystem: d.FileSystem || '',
        total: Number(d.Size),
        free: Number(d.FreeSpace),
      }));
  }
  if (platform === 'linux') {
    const mounts = linuxMounts(await readFile('/proc/self/mountinfo', 'utf8'));
    return mounts.length ? mounts : [{ path: fallback, label: fallback }];
  }
  if (platform === 'darwin') {
    const entries = await fs.readdir('/Volumes', { withFileTypes: true }).catch(() => []);
    return [
      { path: '/', label: 'Macintosh HD' },
      ...entries
        .filter((e) => e.isDirectory())
        .map((e) => ({ path: '/Volumes/' + e.name, label: e.name })),
    ];
  }
  return [{ path: fallback, label: fallback }];
}
module.exports = { linuxMounts, listVolumes };
