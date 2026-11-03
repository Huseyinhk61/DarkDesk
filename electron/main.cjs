const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const os = require('node:os');
const fs = require('node:fs/promises');
const { watch } = require('node:fs');
const { DesktopService } = require('./service.cjs');
const { SettingsStore } = require('./settings.cjs');
const { DeepScanner } = require('./scanner.cjs');
const { FolderIcons } = require('./folder-icons.cjs');
const { classify } = require('../shared/domain.js');
let win, watcher, watchTimer;
const production = app.isPackaged || process.argv.includes('--production');
const entryURL = production
  ? pathToFileURL(path.join(__dirname, '../dist/index.html')).href
  : 'http://127.0.0.1:5173/';
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    const settings = new SettingsStore(app.getPath('userData'));
    const emit = (name, value) => {
      if (win && !win.isDestroyed()) win.webContents.send(name, value);
    };
    const desktop = app.getPath('desktop');
    const scanner = new DeepScanner({
      resolveShortcut:
        process.platform === 'win32' ? (file) => shell.readShortcutLink(file) : undefined,
      onProgress: (value) => emit('scanProgress', value),
    });
    app.once('before-quit', () => scanner.cancel());
    const folderIcons = new FolderIcons(app.getPath('userData'));
    const service = new DesktopService(desktop, app.getPath('userData'), {
      resolveShortcut:
        process.platform === 'win32' ? (file) => shell.readShortcutLink(file) : undefined,
      onProgress: (value) => emit('progress', value),
      scanner,
      folderIcons,
    });
    let saving = false;
    const handle = (name, fn) =>
      ipcMain.handle(name, async (event, ...args) => {
        if (
          !win ||
          event.sender !== win.webContents ||
          event.senderFrame !== win.webContents.mainFrame ||
          event.senderFrame.url.split('#')[0] !== entryURL
        )
          throw Error('IPC_DENIED');
        return fn(...args);
      });
    handle('scan', async (scope) => {
      const value = await settings.read();
      service.settings = value;
      if (scope === 'system')
        return [...scanner.catalog.values()].map((item) => ({
          ...item,
          category: classify(item, value),
        }));
      return service.scan(value);
    });
    handle('scanSystem', async () => {
      if (service.busy || saving) throw Error('SCAN_BUSY');
      const value = await settings.read();
      return scanner.scan(value);
    });
    handle('cancelScan', () => scanner.cancel());
    handle('history', () => service.history());
    handle('preview', async (items, mode) => {
      service.settings = await settings.read();
      return service.preview(items, mode);
    });
    handle('organize', (token) => {
      if (scanner.running) throw Error('SCAN_BUSY');
      return service.organize(token);
    });
    handle('undo', () => {
      if (scanner.running) throw Error('SCAN_BUSY');
      return service.undo();
    });
    handle('getSettings', () => settings.read());
    handle('setSettings', async (value) => {
      if (saving || service.busy || scanner.running) throw Error('OPERATION_BUSY');
      saving = true;
      try {
        return await settings.write(value);
      } finally {
        saving = false;
      }
    });
    handle('stats', async () => {
      let storage = null;
      try {
        const stat = await fs.statfs(desktop);
        storage = { total: stat.blocks * stat.bsize, free: stat.bavail * stat.bsize };
      } catch {
        /* Disk statistics may be unavailable on virtual volumes. */
      }
      return {
        total: os.totalmem(),
        free: os.freemem(),
        desktop,
        storage,
        platform: process.platform,
        version: app.getVersion(),
        folderIcons: process.platform === 'win32',
      };
    });
    // Reveal in Explorer/Finder rather than launching an executable or shortcut.
    handle('reveal', async (id) => {
      if (
        typeof id !== 'string' ||
        (!scanner.catalog.has(id) && /[\\/\0:]/.test(id)) ||
        path.basename(id) !== id ||
        !id ||
        id === '.' ||
        id === '..'
      )
        throw Error('SOURCE_MISSING');
      const file = scanner.catalog.get(id)?.source || path.join(desktop, id);
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw Error('SOURCE_MISSING');
      shell.showItemInFolder(file);
    });
    handle('window', (action) => {
      if (action === 'minimize') win.minimize();
      else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
      else if (action === 'close') win.close();
    });
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
      callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    const createWindow = () => {
      win = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 900,
        minHeight: 650,
        frame: false,
        backgroundColor: '#0f1117',
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../build/icon.png'),
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', (event) => event.preventDefault());
      win.webContents.on('will-attach-webview', (event) => event.preventDefault());
      win.on('closed', () => {
        win = null;
      });
      if (production) win.loadFile(path.join(__dirname, '../dist/index.html'));
      else win.loadURL(entryURL);
    };
    createWindow();
    app.on('activate', () => {
      if (!win) createWindow();
    });
    try {
      watcher = watch(desktop, () => {
        clearTimeout(watchTimer);
        watchTimer = setTimeout(() => {
          if (!service.busy) emit('desktopChanged');
        }, 700);
      });
      watcher.on('error', () => emit('watchError', 'WATCH_FAILED'));
    } catch {
      /* A missing desktop is reported by scan with an actionable error. */
    }
  });
}
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  watcher?.close();
  clearTimeout(watchTimer);
});
