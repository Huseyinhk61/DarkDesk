const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');

// This script never evaluates renderer input. Only the current process ID and
// the real HWND returned by Electron cross the JSON pipe.
const ATTACH_SCRIPT = `[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ErrorActionPreference='Stop'
try {
  $inputValue=[Console]::In.ReadToEnd()|ConvertFrom-Json
  Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
public sealed class DarkDeskDesktopResult {
  public bool Attached;
  public string Reason;
  public DarkDeskDesktopResult(bool attached,string reason) { Attached=attached; Reason=reason; }
}
public static class DarkDeskWidgetDesktop {
  private const int GWL_STYLE=-16;
  private const long WS_POPUP=0x80000000L;
  private const long WS_CHILD=0x40000000L;
  private const uint POSITION_FLAGS=0x0010|0x0020|0x0040;
  private delegate bool EnumWindowsProc(IntPtr hwnd,IntPtr value);
  [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left,Top,Right,Bottom; }
  [StructLayout(LayoutKind.Sequential)] private struct POINT { public int X,Y; }
  [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll")] private static extern IntPtr GetShellWindow();
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback,IntPtr value);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern IntPtr FindWindow(string name,string title);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern IntPtr FindWindowEx(IntPtr parent,IntPtr after,string name,string title);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd,StringBuilder name,int maximum);
  [DllImport("user32.dll",SetLastError=true)] private static extern IntPtr SendMessageTimeout(IntPtr hwnd,uint message,IntPtr first,IntPtr second,uint flags,uint timeout,out UIntPtr result);
  [DllImport("user32.dll",SetLastError=true)] private static extern IntPtr SetParent(IntPtr child,IntPtr parent);
  [DllImport("user32.dll")] private static extern IntPtr GetParent(IntPtr hwnd);
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hwnd,out RECT rect);
  [DllImport("user32.dll")] private static extern bool ScreenToClient(IntPtr hwnd,ref POINT point);
  [DllImport("user32.dll",SetLastError=true)] private static extern bool SetWindowPos(IntPtr hwnd,IntPtr after,int x,int y,int width,int height,uint flags);
  [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr64(IntPtr hwnd,int index);
  [DllImport("user32.dll",EntryPoint="GetWindowLongW")] private static extern int GetWindowLong32(IntPtr hwnd,int index);
  [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW",SetLastError=true)] private static extern IntPtr SetWindowLongPtr64(IntPtr hwnd,int index,IntPtr value);
  [DllImport("user32.dll",EntryPoint="SetWindowLongW",SetLastError=true)] private static extern int SetWindowLong32(IntPtr hwnd,int index,int value);
  [DllImport("user32.dll")] private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  private static IntPtr Style(IntPtr hwnd) { return IntPtr.Size==8?GetWindowLongPtr64(hwnd,GWL_STYLE):new IntPtr(GetWindowLong32(hwnd,GWL_STYLE)); }
  private static void Style(IntPtr hwnd,IntPtr value) { if(IntPtr.Size==8)SetWindowLongPtr64(hwnd,GWL_STYLE,value);else SetWindowLong32(hwnd,GWL_STYLE,value.ToInt32()); }
  private static IntPtr DesktopHost(uint shellPid) {
    IntPtr found=IntPtr.Zero;
    EnumWindowsProc find=delegate(IntPtr hwnd,IntPtr ignored) {
      var name=new StringBuilder(128);
      GetClassName(hwnd,name,name.Capacity);
      if(name.ToString()!="WorkerW"&&name.ToString()!="Progman")return true;
      uint pid;GetWindowThreadProcessId(hwnd,out pid);
      if(pid==shellPid&&FindWindowEx(hwnd,IntPtr.Zero,"SHELLDLL_DefView",null)!=IntPtr.Zero) { found=hwnd;return false; }
      return true;
    };
    EnumWindows(find,IntPtr.Zero);
    GC.KeepAlive(find);
    return found;
  }
  public static DarkDeskDesktopResult Attach(long handle,uint processId,long deadline) {
    var hwnd=new IntPtr(handle);
    uint actualPid;
    if(!IsWindow(hwnd)||GetWindowThreadProcessId(hwnd,out actualPid)==0||actualPid!=processId)return new DarkDeskDesktopResult(false,"window-unavailable");
    var shell=GetShellWindow();uint shellPid;
    if(shell==IntPtr.Zero||GetWindowThreadProcessId(shell,out shellPid)==0)return new DarkDeskDesktopResult(false,"explorer-unavailable");
    try { if(!String.Equals(Process.GetProcessById((int)shellPid).ProcessName,"explorer",StringComparison.OrdinalIgnoreCase))return new DarkDeskDesktopResult(false,"explorer-unavailable"); }
    catch { return new DarkDeskDesktopResult(false,"explorer-unavailable"); }
    if(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()>deadline-1200)return new DarkDeskDesktopResult(false,"native-failed");
    var host=DesktopHost(shellPid);
    if(host==IntPtr.Zero) {
      var progman=FindWindow("Progman",null);UIntPtr reply;
      if(progman!=IntPtr.Zero)SendMessageTimeout(progman,0x052c,IntPtr.Zero,IntPtr.Zero,0x0002,800,out reply);
      host=DesktopHost(shellPid);
    }
    if(host==IntPtr.Zero)return new DarkDeskDesktopResult(false,"explorer-unavailable");
    if(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()>deadline-400)return new DarkDeskDesktopResult(false,"native-failed");
    IntPtr previousDpi=IntPtr.Zero;
    try { previousDpi=SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch { }
    var parent=GetParent(hwnd);var style=Style(hwnd);RECT bounds;
    if(!GetWindowRect(hwnd,out bounds))return new DarkDeskDesktopResult(false,"native-failed");
    bool succeeded=false;
    try {
      long bits=unchecked((uint)style.ToInt64());
      var childStyle=new IntPtr((bits&~WS_POPUP)|WS_CHILD);
      Style(hwnd,childStyle);
      if((unchecked((uint)Style(hwnd).ToInt64())&WS_CHILD)==0)throw new InvalidOperationException();
      SetParent(hwnd,host);
      if(GetParent(hwnd)!=host)throw new InvalidOperationException();
      var point=new POINT();point.X=bounds.Left;point.Y=bounds.Top;
      if(!ScreenToClient(host,ref point)||!SetWindowPos(hwnd,IntPtr.Zero,point.X,point.Y,bounds.Right-bounds.Left,bounds.Bottom-bounds.Top,POSITION_FLAGS))throw new InvalidOperationException();
      if(!IsWindow(hwnd)||GetParent(hwnd)!=host)throw new InvalidOperationException();
      succeeded=true;
      return new DarkDeskDesktopResult(true,"attached");
    } catch { return new DarkDeskDesktopResult(false,"native-failed"); }
    finally {
      if(!succeeded&&IsWindow(hwnd)) {
        SetParent(hwnd,parent);Style(hwnd,style);
        var point=new POINT();point.X=bounds.Left;point.Y=bounds.Top;
        if(parent!=IntPtr.Zero)ScreenToClient(parent,ref point);
        SetWindowPos(hwnd,IntPtr.Zero,point.X,point.Y,bounds.Right-bounds.Left,bounds.Bottom-bounds.Top,POSITION_FLAGS);
      }
      try { if(previousDpi!=IntPtr.Zero)SetThreadDpiAwarenessContext(previousDpi); } catch { }
    }
  }
}
'@
  $result=[DarkDeskWidgetDesktop]::Attach([long]::Parse([string]$inputValue.handle),[uint32]$inputValue.pid,[long]$inputValue.deadline)
  @{attached=$result.Attached;reason=$result.Reason}|ConvertTo-Json -Compress
} catch { exit 1 }`;

function runAttachment(value, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(ATTACH_SCRIPT, 'utf16le').toString('base64'),
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let settled = false,
      output = '',
      bytes = 0;
    const decoder = new StringDecoder('utf8');
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(Error('WIDGET_DESKTOP_UNAVAILABLE'));
    }, 5000);
    const read = (chunk, stdout) => {
      bytes += chunk.length;
      if (bytes > 8192) {
        child.kill();
        finish(Error('WIDGET_DESKTOP_UNAVAILABLE'));
        return;
      }
      if (stdout) output += decoder.write(chunk);
    };
    child.stdout.on('data', (chunk) => read(chunk, true));
    child.stderr.on('data', (chunk) => read(chunk, false));
    child.stdin.on('error', () => {});
    child.on('error', () => finish(Error('WIDGET_DESKTOP_UNAVAILABLE')));
    child.on('close', (code) => {
      output += decoder.end();
      if (code !== 0) return finish(Error('WIDGET_DESKTOP_UNAVAILABLE'));
      try {
        finish(null, JSON.parse(output.replace(/^\uFEFF/, '')));
      } catch {
        finish(Error('WIDGET_DESKTOP_UNAVAILABLE'));
      }
    });
    child.stdin.end(JSON.stringify(value));
  });
}

async function attachDesktop(
  window,
  { platform = process.platform, execute = runAttachment, processId = process.pid } = {},
) {
  const floating = (reason) => ({ mode: 'floating', supported: false, reason });
  if (platform !== 'win32') return floating('platform');
  if (
    !window ||
    window.isDestroyed?.() ||
    !Number.isSafeInteger(processId) ||
    processId <= 0 ||
    processId > 0xffffffff
  )
    return floating('window-unavailable');
  let handle;
  try {
    const bytes = window.getNativeWindowHandle();
    if (!Buffer.isBuffer(bytes) || ![4, 8].includes(bytes.length))
      return floating('window-unavailable');
    const value = bytes.length === 8 ? bytes.readBigUInt64LE() : BigInt(bytes.readUInt32LE());
    if (value === 0n || value > 0x7fffffffffffffffn) return floating('window-unavailable');
    handle = value.toString();
  } catch {
    return floating('window-unavailable');
  }
  try {
    const result = await execute({ handle, pid: processId, deadline: Date.now() + 4500 });
    if (result?.attached === true && !window.isDestroyed?.())
      return { mode: 'desktop', supported: true };
    return floating(
      ['window-unavailable', 'explorer-unavailable'].includes(result?.reason)
        ? result.reason
        : 'native-failed',
    );
  } catch {
    return floating('native-failed');
  }
}

module.exports = { attachDesktop, runAttachment, ATTACH_SCRIPT };
