const { contextBridge, ipcRenderer } = require('electron');
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
  'window',
  'getSettings',
  'setSettings',
];
const api = Object.fromEntries(
  methods.map((name) => [name, (...args) => ipcRenderer.invoke(name, ...args)]),
);
for (const [method, channel] of [
  ['onProgress', 'progress'],
  ['onScanProgress', 'scanProgress'],
  ['onDesktopChanged', 'desktopChanged'],
  ['onWatchError', 'watchError'],
]) {
  api[method] = (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}
contextBridge.exposeInMainWorld('darkdesk', api);
