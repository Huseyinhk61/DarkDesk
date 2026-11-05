const { contextBridge, ipcRenderer, webUtils } = require('electron');
const methods = [
  'scan',
  'scanSystem',
  'cancelScan',
  'history',
  'preview',
  'organize',
  'undo',
  'stats',
  'reveal',
  'revealOutput',
  'window',
  'windowState',
  'updateStatus',
  'saveUpdateAccess',
  'clearUpdateAccess',
  'checkUpdates',
  'downloadUpdate',
  'installUpdate',
  'openDownloads',
  'getSettings',
  'setSettings',
  'runtimeStatus',
  'applyFolderAppearance',
  'applyProfile',
  'restoreProfile',
  'automationPreview',
  'runAutomation',
  'launcherEntries',
  'launcherAction',
  'setLauncherFavorite',
  'launch',
  'itemIcon',
  'itemDetails',
  'runCommand',
  'openLauncher',
  'hideLauncher',
  'beginShortcutCapture',
  'endShortcutCapture',
];
const api = Object.fromEntries(
  methods.map((name) => [name, (...args) => ipcRenderer.invoke(name, ...args)]),
);
api.registerDroppedFiles = (files) =>
  ipcRenderer.invoke(
    'registerDrop',
    files.map((file) => webUtils.getPathForFile(file)),
  );
for (const [method, channel] of [
  ['onProgress', 'progress'],
  ['onScanProgress', 'scanProgress'],
  ['onDesktopChanged', 'desktopChanged'],
  ['onWatchError', 'watchError'],
  ['onRuntimeChanged', 'runtimeChanged'],
  ['onCommand', 'command'],
  ['onLauncherShown', 'launcherShown'],
  ['onWindowStateChanged', 'windowStateChanged'],
  ['onUpdateChanged', 'updateChanged'],
]) {
  api[method] = (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}
contextBridge.exposeInMainWorld('darkdesk', api);
