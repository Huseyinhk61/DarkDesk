const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const os = require('node:os');
const fs = require('node:fs/promises');
const { watch } = require('node:fs');
const { DesktopService } = require('./service.cjs');
const { SettingsStore } = require('./settings.cjs');
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
    const service = new DesktopService(desktop, app.getPath('userData'), {
      resolveShortcut:
        process.platform === 'win32' ? (file) => shell.readShortcutLink(file) : undefined,
      onProgress: (value) => emit('progress', value),
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
          throw Error('Yetkisiz pencere.');
        return fn(...args);
      });
    handle('scan', async () => service.scan(await settings.read()));
    handle('history', () => service.history());
    handle('preview', (items, mode) => service.preview(items, mode));
    handle('organize', (token) => service.organize(token));
    handle('undo', () => service.undo());
    handle('getSettings', () => settings.read());
    handle('setSettings', async (value) => {
      if (saving || service.busy)
        throw Error('Bir işlem sürüyor. Ayarları birazdan yeniden kaydedin.');
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
      };
    });
    // Reveal in Explorer/Finder rather than launching an executable or shortcut.
    handle('reveal', async (id) => {
      if (
        typeof id !== 'string' ||
        /[\\/\0:]/.test(id) ||
        path.basename(id) !== id ||
        !id ||
        id === '.' ||
        id === '..'
      )
        throw Error('Geçersiz dosya.');
      const file = path.join(desktop, id);
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw Error('Dosya artık mevcut değil. Yeniden tarayın.');
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
      watcher.on('error', () =>
        emit('watchError', 'Masaüstü izleme durdu. Manuel tarama kullanabilirsiniz.'),
      );
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
