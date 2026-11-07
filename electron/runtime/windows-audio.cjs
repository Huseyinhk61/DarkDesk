// Core Audio changes the default multimedia output directly; no simulated keys.
const AUDIO_TYPES = `using System;
using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator {}
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IDeviceEnumerator {
 int EnumAudioEndpoints(int flow, int mask, out IntPtr devices);
 [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IDevice device);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IDevice { [PreserveSig] int Activate(ref Guid iid, int context, IntPtr activation, [MarshalAs(UnmanagedType.IUnknown)] out object result); }
[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IEndpointVolume {
 [PreserveSig] int RegisterControlChangeNotify(IntPtr callback);
 [PreserveSig] int UnregisterControlChangeNotify(IntPtr callback);
 [PreserveSig] int GetChannelCount(out uint count);
 [PreserveSig] int SetMasterVolumeLevel(float value, ref Guid context);
 [PreserveSig] int SetMasterVolumeLevelScalar(float value, ref Guid context);
 [PreserveSig] int GetMasterVolumeLevel(out float value);
 [PreserveSig] int GetMasterVolumeLevelScalar(out float value);
 [PreserveSig] int SetChannelVolumeLevel(uint channel, float value, ref Guid context);
 [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float value, ref Guid context);
 [PreserveSig] int GetChannelVolumeLevel(uint channel, out float value);
 [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float value);
 [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool value, ref Guid context);
 [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool value);
}
public static class DarkDeskAudio {
 public static void Apply(string action) {
  IDeviceEnumerator enumerator = (IDeviceEnumerator)new MMDeviceEnumerator();
  IDevice device = null; object endpoint = null;
  try {
   Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
   Guid iid = typeof(IEndpointVolume).GUID;
   Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23, IntPtr.Zero, out endpoint));
   IEndpointVolume volume = (IEndpointVolume)endpoint; Guid context = Guid.Empty;
   if (action == "mute" || action == "unmute") Marshal.ThrowExceptionForHR(volume.SetMute(action == "mute", ref context));
   else if (action == "volume-up" || action == "volume-down") {
    float current; Marshal.ThrowExceptionForHR(volume.GetMasterVolumeLevelScalar(out current));
    Marshal.ThrowExceptionForHR(volume.SetMasterVolumeLevelScalar(Math.Max(0f, Math.Min(1f, current + (action == "volume-up" ? .05f : -.05f))), ref context));
    if (action == "volume-up") Marshal.ThrowExceptionForHR(volume.SetMute(false, ref context));
   } else throw new ArgumentException("Unsupported audio action");
  } finally {
   if (endpoint != null) Marshal.ReleaseComObject(endpoint);
   if (device != null) Marshal.ReleaseComObject(device);
   Marshal.ReleaseComObject(enumerator);
  }
 }
}`;
const AUDIO_SCRIPT = `[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);$ErrorActionPreference='Stop';try{Add-Type -TypeDefinition @'
${AUDIO_TYPES}
'@;$v=[Console]::In.ReadToEnd()|ConvertFrom-Json;[DarkDeskAudio]::Apply([string]$v.action)}catch{exit 1}`;
// WinRT controls Wi-Fi radios without altering network adapter configuration.
// Access denial or unavailable hardware is an error, never a claimed success.
const WIFI_SCRIPT = `[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);$ErrorActionPreference='Stop';try{
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Devices.Radios.Radio,Windows.System.Devices,ContentType=WindowsRuntime]>$null
$asTask=([System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\u00601'})[0]
function Wait-Radio($operation,$type){$task=$asTask.MakeGenericMethod($type).Invoke($null,@($operation));if(-not $task.Wait(15000)){throw 'Radio operation timed out'};$task.Result}
$access=Wait-Radio ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus]);if([string]$access -ne 'Allowed'){throw 'Radio access denied'}
$radios=Wait-Radio ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
$v=[Console]::In.ReadToEnd()|ConvertFrom-Json;if($v.action -eq 'wifi-on'){$state=[Windows.Devices.Radios.RadioState]::On}elseif($v.action -eq 'wifi-off'){$state=[Windows.Devices.Radios.RadioState]::Off}else{throw 'Invalid radio action'}
$found=$false;foreach($radio in $radios){if([string]$radio.Kind -eq 'WiFi'){$found=$true;$result=Wait-Radio ($radio.SetStateAsync($state)) ([Windows.Devices.Radios.RadioAccessStatus]);if([string]$result -ne 'Allowed'){throw 'Radio change denied'}}};if(-not $found){throw 'No Wi-Fi radio'}
}catch{exit 1}`;
module.exports = { AUDIO_TYPES, AUDIO_SCRIPT, WIFI_SCRIPT };
