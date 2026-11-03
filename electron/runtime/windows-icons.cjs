const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');

// Only data crosses stdin. Neither file names nor resource indices become code.
// SHDefExtractIcon reads the original resource (including negative resource IDs),
// whereas GetFileIcon may return the shell's cached generic shortcut icon.
const ICON_SCRIPT = `[Console]::InputEncoding=[System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference='Stop'
try {
  Add-Type -AssemblyName System.Drawing
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
public static class DarkDeskIcons {
  [DllImport("shell32.dll", CharSet=CharSet.Unicode, EntryPoint="SHDefExtractIconW")]
  static extern int Extract(string file, int index, uint flags, out IntPtr large, out IntPtr small, uint size);
  [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr icon);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  struct Info { public IntPtr icon; public int index; public uint attributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string name;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=80)] public string type; }
  [DllImport("shell32.dll", CharSet=CharSet.Unicode, EntryPoint="SHGetFileInfoW")]
  static extern IntPtr ShellIcon(string file, uint attributes, ref Info info, uint size, uint flags);
  public static string Read(string file, int index, bool shell) {
    IntPtr large=IntPtr.Zero, small=IntPtr.Zero;
    try {
      if(shell) {
        Info info=new Info();
        ShellIcon(file, 0, ref info, (uint)Marshal.SizeOf(typeof(Info)), 0x100);
        large=info.icon;
      } else {
        Extract(file, index, 0, out large, out small, 48);
      }
      if(large==IntPtr.Zero) return null;
      using(Icon icon=(Icon)Icon.FromHandle(large).Clone())
      using(Bitmap image=icon.ToBitmap())
      using(MemoryStream output=new MemoryStream()) {
        image.Save(output, ImageFormat.Png);
        return Convert.ToBase64String(output.ToArray());
      }
    } finally {
      if(large!=IntPtr.Zero) DestroyIcon(large);
      if(small!=IntPtr.Zero && small!=large) DestroyIcon(small);
    }
  }
}
'@
  $value=[Console]::In.ReadToEnd()|ConvertFrom-Json
  $png=$null
  foreach($candidate in $value.candidates) {
    try {
      $png=[DarkDeskIcons]::Read([string]$candidate.path,[int]$candidate.index,[bool]$candidate.shell)
      if($png) { break }
    } catch {}
  }
  @{png=$png}|ConvertTo-Json -Compress
} catch { exit 1 }`;

function validPngDataUrl(value) {
  if (
    typeof value !== 'string' ||
    value.length > 1024 * 1024 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)
  )
    return false;
  const bytes = Buffer.from(value.slice('data:image/png;base64,'.length), 'base64');
  return (
    bytes.length >= 33 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString('ascii', 12, 16) === 'IHDR' &&
    bytes.readUInt32BE(16) > 0 &&
    bytes.readUInt32BE(20) > 0 &&
    bytes.readUInt32BE(16) <= 1024 &&
    bytes.readUInt32BE(20) <= 1024
  );
}

function extractWindowsIcon(candidates, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ICON_SCRIPT],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const decoder = new StringDecoder('utf8');
    let output = '',
      settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(Error('ICON_UNAVAILABLE'));
    }, 6000);
    child.stdout.on('data', (chunk) => {
      output += decoder.write(chunk);
      if (Buffer.byteLength(output) > 1024 * 1024) {
        child.kill();
        finish(Error('ICON_UNAVAILABLE'));
      }
    });
    child.stderr.resume();
    child.on('error', () => finish(Error('ICON_UNAVAILABLE')));
    child.on('close', (code) => {
      output += decoder.end();
      if (settled) return;
      if (code !== 0) return finish(Error('ICON_UNAVAILABLE'));
      try {
        const value = JSON.parse(output.replace(/^\uFEFF/, ''));
        const url = value.png ? 'data:image/png;base64,' + value.png : null;
        finish(null, validPngDataUrl(url) ? url : null);
      } catch {
        finish(Error('ICON_UNAVAILABLE'));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ candidates }));
  });
}
module.exports = { extractWindowsIcon, validPngDataUrl, ICON_SCRIPT };
