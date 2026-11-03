const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  session,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  screen,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { watch } = require('node:fs');
const { pathToFileURL } = require('node:url');
const { DesktopRuntime } = require('./runtime/controller.cjs');
const { ShortcutManager } = require('./runtime/shortcuts.cjs');
const { validateSettings } = require('../shared/validate.js');
let win,
  launcher,
  tray,
  runtime,
  shortcutManager,
  savingSettings = false,
  watcher,
  watchTimer,
  quitting = false,
  quitPending = false;
const production = app.isPackaged || process.argv.includes('--production');
const entry = path.join(__dirname, '../dist/index.html'),
  entryURL = production ? pathToFileURL(entry).href : 'http://127.0.0.1:5173/';
function showMain() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
async function openLauncher() {
  if (launcher?.isVisible() && launcher.isFocused()) {
    launcher.hide();
    return;
  }
  if (!launcher) {
    launcher = new BrowserWindow({
      width: 720,
      height: 510,
      frame: false,
      resizable: false,
      transparent: true,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    secureWindow(launcher);
    launcher.on('blur', () => launcher?.hide());
    launcher.on('close', (e) => {
      if (!quitting) {
        e.preventDefault();
        launcher.hide();
      }
    });
    launcher.on('closed', () => (launcher = null));
    if (production) await launcher.loadFile(entry, { hash: 'launcher' });
    else await launcher.loadURL(entryURL + '#launcher');
  }
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const [width, height] = launcher.getSize();
  launcher.setPosition(
    Math.round(workArea.x + (workArea.width - width) / 2),
    Math.round(workArea.y + (workArea.height - height) / 2),
  );
  launcher.show();
  launcher.focus();
  launcher.webContents.send('launcherShown');
}
function secureWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
}
async function command(value) {
  if (value?.type === 'show') {
    showMain();
    return;
  }
  if (value?.type === 'organize') {
    showMain();
    win.webContents.send('command', { type: 'organize' });
    return;
  }
  if (value?.type === 'profile') return runtime.applyProfile(value.id);
  if (value?.type === 'restore') return runtime.restoreProfile();
  throw Error('COMMAND_INVALID');
}
async function updateTray() {
  if (!tray) return;
  const settings = await runtime.settings.read(),
    state = await runtime.profiles.status();
  const dictionary = require('../src/locales/' + settings.language + '.json');
  const t = (key) => dictionary[key] || key;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'DarkDesk', enabled: false },
      { label: t('tray.show'), click: showMain },
      { label: t('tray.organize'), click: () => command({ type: 'organize' }).catch(report) },
      {
        label: t('tray.profiles'),
        submenu: [
          {
            label: t('profiles.restore'),
            type: 'radio',
            checked: !state.activeId,
            click: () => runtime.restoreProfile().catch(report),
          },
          ...settings.profiles.map((p) => ({
            label: p.labelKey ? t(p.labelKey) : p.name,
            type: 'radio',
            checked: state.activeId === p.id,
            click: () => runtime.applyProfile(p.id).catch(report),
          })),
        ],
      },
      { label: t('tray.launcher'), click: () => openLauncher().catch(report) },
      { type: 'separator' },
      { label: t('tray.quit'), click: requestQuit },
    ]),
  );
}
function report(error) {
  if (runtime) {
    runtime.lastError = error.message;
    runtime.broadcast().catch(() => {});
  }
  showMain();
}
async function registerShortcuts(settings) {
  shortcutManager.configure(settings);
  await runtime.broadcast();
}
async function requestQuit() {
  if (quitPending) return;
  quitPending = true;
  try {
    await runtime?.prepareQuit();
    quitting = true;
    shortcutManager?.dispose();
    tray?.destroy();
    app.quit();
  } catch (e) {
    quitPending = false;
    if (runtime) runtime.stopping = false;
    report(e);
  }
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showMain);
  app
    .whenReady()
    .then(async () => {
      const emit = (name, value) => {
        for (const window of [win, launcher])
          if (window && !window.isDestroyed()) window.webContents.send(name, value);
        if (name === 'runtimeChanged') updateTray().catch(() => {});
      };
      runtime = new DesktopRuntime({
        desktop: app.getPath('desktop'),
        downloads: app.getPath('downloads'),
        data: app.getPath('userData'),
        resolveShortcut:
          process.platform === 'win32' ? (file) => shell.readShortcutLink(file) : undefined,
        emit,
        getFileIcon: (file, options) => app.getFileIcon(file, options),
        launch: async (item) => {
          const error = await shell.openPath(item.source);
          if (error) throw Error('LAUNCH_FAILED: ' + error);
        },
      });
      await runtime.initialize();
      shortcutManager = new ShortcutManager(globalShortcut, {
        launcher: () => openLauncher().catch(report),
        profile: (id) => runtime.applyProfile(id).catch(report),
        onStatus: (rows) => {
          runtime.shortcuts = rows;
          runtime.broadcast().catch(() => {});
        },
      });
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
      secureWindow(win);
      win.on('blur', () => shortcutManager.resume());
      win.webContents.on('render-process-gone', () => shortcutManager.resume());
      win.on('close', (event) => {
        if (!quitting) {
          shortcutManager.resume();
          event.preventDefault();
          if (tray) win.hide();
          else requestQuit();
        }
      });
      win.on('closed', () => (win = null));
      const handle = (name, fn) =>
        ipcMain.handle(name, async (event, ...args) => {
          const sender = BrowserWindow.fromWebContents(event.sender);
          if (
            ![win, launcher].includes(sender) ||
            event.senderFrame !== sender.webContents.mainFrame ||
            event.senderFrame.url.split('#')[0] !== entryURL
          )
            throw Error('IPC_DENIED');
          return fn(...args);
        });
      handle('scan', (scope) => runtime.scan(scope));
      handle('scanSystem', () => runtime.scanSystem());
      handle('cancelScan', () => runtime.scanner.cancel());
      handle('history', () => runtime.service.history());
      handle('preview', (items, mode) => runtime.preview(items, mode));
      handle('organize', (token) => runtime.organize(token));
      handle('undo', () => runtime.undo());
      handle('getSettings', () => runtime.settings.read());
      handle('setSettings', async (value) => {
        if (savingSettings || runtime.busy || runtime.stopping) throw Error('OPERATION_BUSY');
        savingSettings = true;
        try {
          const candidate = validateSettings(value);
          shortcutManager.configure(candidate, { strict: true });
          try {
            const settings = await runtime.saveSettings(candidate);
            await updateTray();
            return settings;
          } catch (error) {
            // Settings may already be persisted if reapplying a profile failed.
            // Always restore registrations to the actual stored configuration.
            shortcutManager.configure(await runtime.settings.read());
            throw error;
          }
        } finally {
          savingSettings = false;
        }
      });
      handle('beginShortcutCapture', () => {
        if (!win.isFocused() || !win.isVisible()) throw Error('SHORTCUT_CAPTURE_UNAVAILABLE');
        return shortcutManager.suspend();
      });
      handle('endShortcutCapture', (token) => {
        if (typeof token !== 'string') throw Error('SHORTCUT_CAPTURE_UNAVAILABLE');
        return shortcutManager.resume(token);
      });
      handle('itemIcon', (id) => runtime.itemIcon(id));
      handle('itemDetails', (id) => runtime.itemDetails(id));
      handle('runtimeStatus', () => runtime.status());
      handle('applyProfile', (id) => runtime.applyProfile(id));
      handle('restoreProfile', () => runtime.restoreProfile());
      handle('automationPreview', (value) => runtime.previewAutomation(value));
      handle('runAutomation', () => runtime.runAutomation());
      handle('registerDrop', (paths) => runtime.registerDrop(paths));
      handle('launcherEntries', () => runtime.entries());
      handle('launch', async (id) => {
        const result = await runtime.launch(id);
        launcher?.hide();
        return result;
      });
      handle('runCommand', async (value) => {
        const result = await command(value);
        launcher?.hide();
        return result;
      });
      handle('openLauncher', openLauncher);
      handle('hideLauncher', () => launcher?.hide());
      handle('stats', async () => {
        let storage = null;
        try {
          const stat = await fs.statfs(runtime.desktop);
          storage = { total: stat.blocks * stat.bsize, free: stat.bavail * stat.bsize };
        } catch {}
        return {
          total: os.totalmem(),
          free: os.freemem(),
          desktop: runtime.desktop,
          downloads: runtime.downloads,
          storage,
          platform: process.platform,
          version: app.getVersion(),
          folderIcons: process.platform === 'win32',
        };
      });
      handle('reveal', async (id) => {
        let item =
          runtime.catalog.get(id) ||
          runtime.scanner.catalog.get(id) ||
          runtime.service.externalCatalog.get(id);
        if (!item) item = (await runtime.scan()).find((i) => i.id === id);
        if (!item) throw Error('SOURCE_MISSING');
        const stat = await fs.lstat(item.source);
        if (!stat.isFile() || stat.isSymbolicLink()) throw Error('SOURCE_MISSING');
        shell.showItemInFolder(item.source);
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
      try {
        tray = new Tray(
          nativeImage
            .createFromPath(path.join(__dirname, '../build/icon.png'))
            .resize({ width: 20, height: 20 }),
        );
        tray.setToolTip('DarkDesk');
        tray.on('double-click', showMain);
        runtime.trayAvailable = true;
      } catch {
        runtime.trayAvailable = false;
      }
      await updateTray();
      await registerShortcuts(await runtime.settings.read());
      if (production) await win.loadFile(entry);
      else await win.loadURL(entryURL);
      app.on('activate', showMain);
      try {
        watcher = watch(runtime.desktop, () => {
          runtime.desktopDirty = true;
          clearTimeout(watchTimer);
          watchTimer = setTimeout(() => {
            if (!runtime.busy) emit('desktopChanged');
          }, 700);
        });
        watcher.on('error', () => emit('watchError', 'WATCH_FAILED'));
      } catch {}
    })
    .catch((error) => {
      console.error(error);
      quitting = true;
      app.quit();
    });
}
app.on('before-quit', (event) => {
  if (!quitting) {
    event.preventDefault();
    requestQuit();
  }
});
app.on('will-quit', () => {
  shortcutManager?.dispose();
  watcher?.close();
  clearTimeout(watchTimer);
});
