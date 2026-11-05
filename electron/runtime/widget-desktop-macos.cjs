// Runs synchronously on Electron's main thread. Only a live BrowserWindow's
// own NSView pointer reaches Objective-C; no pointer or selector is accepted
// from a renderer. Keeping a normal NSWindow makes notes and todos interactive.
let native;
function bindings() {
  if (native) return native;
  const koffi = require('koffi');
  const objc = koffi.load('/usr/lib/libobjc.A.dylib');
  const graphics = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
  native = {
    selector: objc.func('sel_registerName', 'void *', ['str']),
    object: objc.func('objc_msgSend', 'void *', ['void *', 'void *']),
    integer: objc.func('objc_msgSend', 'long', ['void *', 'void *']),
    setInteger: objc.func('objc_msgSend', 'void', ['void *', 'void *', 'long']),
    boolean: objc.func('objc_msgSend', 'bool', ['void *', 'void *', 'void *']),
    level: graphics.func('CGWindowLevelForKey', 'int32', ['int32']),
  };
  return native;
}
function attachMacDesktop(window, { platform = process.platform, getBindings = bindings } = {}) {
  const fallback = (reason) => ({ mode: 'floating', supported: false, reason });
  if (platform !== 'darwin') return fallback('platform');
  if (!window || window.isDestroyed?.()) return fallback('window-unavailable');
  let api, object, previous, previousBehavior;
  try {
    const handle = window.getNativeWindowHandle();
    if (!Buffer.isBuffer(handle) || handle.length !== 8) return fallback('window-unavailable');
    const view = handle.readBigUInt64LE();
    if (view === 0n) return fallback('window-unavailable');
    api = getBindings();
    object = api.object(view, api.selector('window'));
    if (!object) return fallback('window-unavailable');
    if (!api.boolean(object, api.selector('respondsToSelector:'), api.selector('setLevel:')))
      return fallback('native-failed');
    previous = api.integer(object, api.selector('level'));
    previousBehavior = api.integer(object, api.selector('collectionBehavior'));
    // CGWindowLevelKey18 is kCGDesktopIconWindowLevelKey. Above Finder icons,
    // below ordinary application windows, with ordinary mouse/keyboard input.
    const level = api.level(18) + 1;
    if (!Number.isSafeInteger(level) || level >= 0) return fallback('native-failed');
    api.setInteger(object, api.selector('setLevel:'), level);
    api.setInteger(object, api.selector('setCollectionBehavior:'), 1 | 16 | 64);
    if (api.integer(object, api.selector('level')) !== level) throw Error('level');
    return { mode: 'desktop', supported: true };
  } catch {
    try {
      if (api && object && Number.isSafeInteger(previous))
        api.setInteger(object, api.selector('setLevel:'), previous);
    } catch {}
    try {
      if (api && object && Number.isSafeInteger(previousBehavior))
        api.setInteger(object, api.selector('setCollectionBehavior:'), previousBehavior);
    } catch {}
    return fallback('native-failed');
  }
}
module.exports = { attachMacDesktop };
