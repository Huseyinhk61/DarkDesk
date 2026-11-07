const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const options = { timeout: 10000, maxBuffer: 64 * 1024, windowsHide: true };
async function discoverActions({
  platform = process.platform,
  env = process.env,
  exists = async (file) =>
    fs.access(file, 1).then(
      () => true,
      () => false,
    ),
  run = execute,
} = {}) {
  const actions = {};
  async function binary(name) {
    for (const folder of ['/usr/bin', '/bin', '/usr/local/bin']) {
      const file = path.posix.join(folder, name);
      if (await exists(file)) return file;
    }
    return null;
  }
  const checked = async (file, args) => {
    try {
      await run(file, args, options);
      return true;
    } catch {
      return false;
    }
  };
  if (platform === 'linux') {
    const wpctl = await binary('wpctl'),
      pactl = await binary('pactl');
    let audio = null;
    if (wpctl && (await checked(wpctl, ['get-volume', '@DEFAULT_AUDIO_SINK@'])))
      audio = { file: wpctl, kind: 'pipewire' };
    else if (pactl && (await checked(pactl, ['get-sink-volume', '@DEFAULT_SINK@'])))
      audio = { file: pactl, kind: 'pulse' };
    if (audio)
      for (const id of ['mute', 'unmute', 'volume-up', 'volume-down'])
        actions[id] = () =>
          run(
            audio.file,
            audio.kind === 'pipewire'
              ? id === 'mute' || id === 'unmute'
                ? ['set-mute', '@DEFAULT_AUDIO_SINK@', id === 'mute' ? '1' : '0']
                : [
                    'set-volume',
                    '--limit',
                    '1',
                    '@DEFAULT_AUDIO_SINK@',
                    id === 'volume-up' ? '5%+' : '5%-',
                  ]
              : id === 'mute' || id === 'unmute'
                ? ['set-sink-mute', '@DEFAULT_SINK@', id === 'mute' ? '1' : '0']
                : ['set-sink-volume', '@DEFAULT_SINK@', id === 'volume-up' ? '+5%' : '-5%'],
            options,
          );
    const loginctl = await binary('loginctl');
    if (
      loginctl &&
      /^[a-zA-Z0-9_-]{1,80}$/.test(env.XDG_SESSION_ID || '') &&
      (await checked(loginctl, ['show-session', env.XDG_SESSION_ID, '--property=Id', '--value']))
    )
      actions.lock = () => run(loginctl, ['lock-session', env.XDG_SESSION_ID], options);
    const nmcli = await binary('nmcli');
    if (nmcli && (await checked(nmcli, ['radio', 'wifi'])))
      for (const [id, state] of [
        ['wifi-on', 'on'],
        ['wifi-off', 'off'],
      ])
        actions[id] = () => run(nmcli, ['radio', 'wifi', state], options);
    if (env.DBUS_SESSION_BUS_ADDRESS && (env.DISPLAY || env.WAYLAND_DISPLAY)) {
      const gnome = await binary('gnome-screenshot'),
        kde = await binary('spectacle');
      if (gnome)
        actions.screenshot = () => run(gnome, ['--interactive'], { ...options, timeout: 60000 });
      else if (kde)
        actions.screenshot = () => run(kde, ['--region'], { ...options, timeout: 60000 });
    }
  }
  if (platform === 'darwin') {
    const osascript = '/usr/bin/osascript';
    if (await exists(osascript))
      for (const id of ['mute', 'unmute', 'volume-up', 'volume-down']) {
        const script =
          id === 'mute'
            ? 'set volume with output muted'
            : id === 'unmute'
              ? 'set volume without output muted'
              : `set volume output volume (${id === 'volume-up' ? 'min(100,' : 'max(0,'} (output volume of (get volume settings)) ${id === 'volume-up' ? '+' : '-'} 5))`;
        // AppleScript has no min/max built-ins; fixed statements clamp explicitly.
        const fixed = id.startsWith('volume-')
          ? `set level to output volume of (get volume settings)\nset level to level ${id === 'volume-up' ? '+' : '-'} 5\nif level > 100 then set level to 100\nif level < 0 then set level to 0\nset volume output volume level${id === 'volume-up' ? '\nset volume without output muted' : ''}`
          : script;
        actions[id] = () => run(osascript, ['-e', fixed], options);
      }
    const lock = '/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession';
    if (await exists(lock)) actions.lock = () => run(lock, ['-suspend'], options);
    if (await exists('/usr/sbin/screencapture'))
      actions.screenshot = () =>
        run('/usr/sbin/screencapture', ['-i', '-c'], { ...options, timeout: 60000 });
  }
  return actions;
}
module.exports = { discoverActions };
