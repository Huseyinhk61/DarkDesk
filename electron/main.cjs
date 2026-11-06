const { CurrencyService } = require('./runtime/currency.cjs');
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
  nativeTheme,
  Notification,
  safeStorage,
  clipboard,
  powerMonitor,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { watch } = require('node:fs');
const { pathToFileURL } = require('node:url');
const { DesktopRuntime } = require('./runtime/controller.cjs');
const { ShortcutManager } = require('./runtime/shortcuts.cjs');
const { validateSettings } = require('../shared/validate.js');
const { resolveTheme } = require('../shared/appearance.js');
const { createUpdates } = require('./runtime/updates.cjs');
const { resolveSharedDesktop } = require('./runtime/desktop-paths.cjs');
const { UpdateAccessStore } = require('./runtime/update-access.cjs');
const { restoreWindowState, WindowStateStore } = require('./runtime/window-state.cjs');
const { LauncherActions } = require('./runtime/launcher-actions.cjs');
const { WidgetManager } = require('./runtime/widgets.cjs');
const { attachDesktop } = require('./runtime/widget-desktop.cjs');
const { attachMacDesktop } = require('./runtime/widget-desktop-macos.cjs');
const { StartupManager } = require('./runtime/startup.cjs');
const { ProductivityTracker } = require('./runtime/productivity.cjs');
const { SystemMetrics } = require('./runtime/system-metrics.cjs');
let currencyService;
let widgetManager, startupManager, productivity, systemMetrics, productivityTimer;
let systemLocked = false;
const widgetMethods = new Set([
  'getSettings',
  'widgetState',
  'saveWidgets',
  'showWidget',
  'hideWidget',
  'systemToolsSnapshot',
]);
function startProductivityTimer() {
  clearInterval(productivityTimer);
  productivityTimer = setInterval(() => productivity?.tick().catch(() => {}), 15000);
  productivityTimer.unref?.();
}
async function stopExtraServices() {
  clearInterval(productivityTimer);
  await productivity?.stop();
  await widgetManager?.stop();
}
async function restartExtraServices() {
  productivity?.resume('stopped');
  if (widgetManager) {
    widgetManager.stopping = false;
    await widgetManager.initialize();
  }
  startProductivityTimer();
}
let win,
  launcher,
  tray,
  runtime,
  shortcutManager,
  updates,
  updateTimer,
  updateStartupTimer,
  windowStore,
  windowSaveTimer,
  preferredTheme = 'midnight',
  lastMaximized = false,
  savingSettings = false,
  watchers = [],
  watchTimer,
  quitting = false,
  quitPending = false;
let launcherEpoch = 0;
function hideLauncher(epoch = launcherEpoch) {
  if (epoch !== launcherEpoch) return;
  ++launcherEpoch;
  if (launcher && !launcher.isDestroyed()) launcher.hide();
}
const production = app.isPackaged || process.argv.includes('--production');
const entry = path.join(__dirname, '../dist/index.html'),
  entryURL = production ? pathToFileURL(entry).href : 'http://127.0.0.1:5173/';
function windowState() {
  return { maximized: !!win && !win.isDestroyed() && win.isMaximized() };
}
function sendWindowState() {
  if (win && !win.isDestroyed()) win.webContents.send('windowStateChanged', windowState());
}
function currentGeometry(saved) {
  return restoreWindowState(saved, screen.getAllDisplays(), screen.getPrimaryDisplay().id);
}
function saveWindowState() {
  clearTimeout(windowSaveTimer);
  if (!win || win.isDestroyed()) return Promise.resolve();
  return windowStore
    .save(win.getNormalBounds(), win.isMinimized() ? lastMaximized : win.isMaximized())
    .catch(() => {});
}
function scheduleWindowState() {
  clearTimeout(windowSaveTimer);
  windowSaveTimer = setTimeout(saveWindowState, 250);
}
function fitMainWindow() {
  if (!win || win.isDestroyed()) return;
  const before = win.getNormalBounds(),
    maximized = win.isMaximized();
  const adjusted = currentGeometry({ bounds: before, maximized });
  win.setMinimumSize(adjusted.minWidth, adjusted.minHeight);
  if (Object.keys(adjusted.bounds).some((key) => adjusted.bounds[key] !== before[key])) {
    if (maximized) win.unmaximize();
    win.setBounds(adjusted.bounds);
    if (maximized) win.maximize();
  }
  scheduleWindowState();
}
function updateNativeAppearance(settings) {
  preferredTheme = settings?.theme || preferredTheme;
  const background = resolveTheme(preferredTheme, nativeTheme.shouldUseDarkColors).tokens.bg;
  if (win && !win.isDestroyed()) win.setBackgroundColor(background);
  return background;
}
function showMain() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  fitMainWindow();
  win.show();
  win.focus();
}
async function openLauncher() {
  const epoch = ++launcherEpoch;
  if (launcher?.isVisible() && launcher.isFocused()) {
    hideLauncher(epoch);
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
    launcher.on('blur', () => {
      if (launcher && !launcher.isDestroyed() && !launcher.isFocused()) hideLauncher();
    });
    launcher.on('close', (e) => {
      if (!quitting) {
        e.preventDefault();
        hideLauncher();
      }
    });
    launcher.on('closed', () => {
      launcher = null;
      ++launcherEpoch;
    });
    if (production) await launcher.loadFile(entry, { hash: 'launcher' });
    else await launcher.loadURL(entryURL + '#launcher');
  }
  if (epoch !== launcherEpoch || !launcher || launcher.isDestroyed()) return;
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  launcher.setSize(
    Math.min(720, Math.max(320, workArea.width - 24)),
    Math.min(510, Math.max(240, workArea.height - 24)),
  );
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
  if (quitPending || updates?.installing) return;
  quitPending = true;
  try {
    await runtime?.prepareQuit();
    await stopExtraServices();
    await saveWindowState();
    await windowStore?.flush().catch(() => {});
    quitting = true;
    shortcutManager?.dispose();
    tray?.destroy();
    app.quit();
  } catch (e) {
    quitPending = false;
    if (runtime) {
      runtime.stopping = false;
      clearInterval(runtime.timer);
      runtime.timer = setInterval(() => runtime.tick(), 5000);
      runtime.timer.unref?.();
    }
    restartExtraServices().catch(() => {});
    report(e);
  }
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showMain);
  app
    .whenReady()
    .then(async () => {
      if (process.platform === 'win32') app.setAppUserModelId('io.darkdesk.app');
      const emit = (name, value) => {
        for (const window of [win, launcher, ...(widgetManager?.windows() || [])])
          if (window && !window.isDestroyed()) window.webContents.send(name, value);
        if (name === 'runtimeChanged') updateTray().catch(() => {});
      };
      runtime = new DesktopRuntime({
        desktop: app.getPath('desktop'),
        sharedDesktop: await resolveSharedDesktop(),
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
      systemMetrics = new SystemMetrics();
      currencyService = new CurrencyService({ data: app.getPath('userData') });
      startupManager = new StartupManager({ data: app.getPath('userData') });
      productivity = new ProductivityTracker({
        data: app.getPath('userData'),
        getProfile: () => runtime.profiles.status(),
        idle: () => ({ idleSeconds: powerMonitor.getSystemIdleTime(), locked: systemLocked }),
        emit: (value) => emit('analyticsChanged', value),
      });
      widgetManager = new WidgetManager({
        data: app.getPath('userData'),
        getDisplays: () => screen.getAllDisplays(),
        getSettings: () => runtime.settings.read(),
        emit,
        loadWindow: async (window, id) => {
          secureWindow(window);
          if (production) await window.loadFile(entry, { hash: 'widget=' + id });
          else await window.loadURL(entryURL + '#widget=' + id);
        },
        attachDesktop: (window) =>
          process.platform === 'darwin' ? attachMacDesktop(window) : attachDesktop(window),
      });
      powerMonitor.on('suspend', () => {
        productivity.pause('suspend');
        productivity.flush().catch(() => {});
      });
      powerMonitor.on('resume', () => productivity.resume('suspend'));
      powerMonitor.on('lock-screen', () => {
        systemLocked = true;
        productivity.pause('lock');
        productivity.flush().catch(() => {});
      });
      powerMonitor.on('unlock-screen', () => {
        systemLocked = false;
        productivity.resume('lock');
      });
      const launcherActions = new LauncherActions({
        shell,
        clipboard,
        resolveItem: (id) => runtime.resolveTrustedItem(id),
        resolveShortcut: (file) => shell.readShortcutLink(file),
        beforeShutdown: async () => {
          await Promise.all(
            (widgetManager?.windows() || []).map((window) => widgetManager.flushWindow(window)),
          );
          await productivity?.flushIfLoaded();
          await runtime.profiles.restore();
          await saveWindowState();
          await windowStore?.flush();
        },
      });
      const updateEnabled =
        app.isPackaged && process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE;
      updates = createUpdates({
        accessStore: new UpdateAccessStore({ directory: app.getPath('userData'), safeStorage }),
        autoUpdater: updateEnabled ? require('electron-updater').autoUpdater : undefined,
        appVersion: app.getVersion(),
        enabled: updateEnabled,
        unsupportedReason: !app.isPackaged
          ? 'development'
          : process.env.PORTABLE_EXECUTABLE_FILE
            ? 'portable'
            : 'platform',
        emit: (value) => emit('updateChanged', value),
        notify: async (version) => {
          if (!Notification.isSupported()) return;
          const settings = await runtime.settings.read();
          const dictionary = require('../src/locales/' + settings.language + '.json');
          const notification = new Notification({
            title: dictionary['update.noticeAvailable'].replace('{version}', version),
            body: dictionary['update.noticeBody'],
            icon: path.join(__dirname, '../build/icon.png'),
          });
          notification.on('click', () => {
            showMain();
            win?.webContents.send('command', { type: 'updates' });
          });
          notification.show();
        },
        beforeInstall: async () => {
          if (runtime.busy || savingSettings || quitPending) throw Error('OPERATION_BUSY');
          await runtime.prepareQuit();
          await stopExtraServices();
          await saveWindowState();
          await windowStore?.flush();
          quitting = true;
        },
        onInstallFailure: () => {
          quitting = false;
          quitPending = false;
          runtime.stopping = false;
          restartExtraServices().catch(() => {});
          clearInterval(runtime.timer);
          runtime.timer = setInterval(() => runtime.tick(), 5000);
          runtime.timer.unref?.();
        },
      });
      await updates.initialize();
      shortcutManager = new ShortcutManager(globalShortcut, {
        launcher: () => openLauncher().catch(report),
        profile: (id) => runtime.applyProfile(id).catch(report),
        onStatus: (rows) => {
          runtime.shortcuts = rows;
          runtime.broadcast().catch(() => {});
        },
      });
      windowStore = new WindowStateStore(app.getPath('userData'));
      const geometry = currentGeometry(await windowStore.read());
      const initialSettings = await runtime.settings.read();
      win = new BrowserWindow({
        ...geometry.bounds,
        minWidth: geometry.minWidth,
        minHeight: geometry.minHeight,
        frame: false,
        backgroundColor: updateNativeAppearance(initialSettings),
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
      lastMaximized = geometry.maximized;
      if (geometry.maximized) win.maximize();
      win.on('move', scheduleWindowState);
      win.on('resize', scheduleWindowState);
      for (const event of ['maximize', 'unmaximize'])
        win.on(event, () => {
          lastMaximized = event === 'maximize';
          sendWindowState();
          scheduleWindowState();
        });
      win.webContents.on('did-finish-load', sendWindowState);
      screen.on('display-removed', fitMainWindow);
      screen.on('display-metrics-changed', fitMainWindow);
      nativeTheme.on('updated', () => updateNativeAppearance());
      win.on('blur', () => shortcutManager.resume());
      win.webContents.on('render-process-gone', () => shortcutManager.resume());
      win.on('close', (event) => {
        if (!quitting) {
          shortcutManager.resume();
          event.preventDefault();
          saveWindowState();
          if (tray) win.hide();
          else requestQuit();
        }
      });
      win.on('closed', () => (win = null));
      const handle = (name, fn) =>
        ipcMain.handle(name, async (event, ...args) => {
          const sender = BrowserWindow.fromWebContents(event.sender);
          const widgetSender = widgetManager?.windows().includes(sender);
          if (
            !sender ||
            (![win, launcher].includes(sender) && !widgetSender) ||
            (widgetSender && !widgetMethods.has(name)) ||
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
            updateNativeAppearance(settings);
            await updateTray();
            emit('settingsChanged', settings);
            return settings;
          } catch (error) {
            // Settings may already be persisted if reapplying a profile failed.
            // Always restore registrations to the actual stored configuration.
            const actual = await runtime.settings.read();
            shortcutManager.configure(actual);
            updateNativeAppearance(actual);
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
      handle('itemIcon', (id, refresh) => runtime.itemIcon(id, refresh));
      handle('itemDetails', (id) => runtime.itemDetails(id));
      handle('itemPurpose', (id) => runtime.itemPurpose(id));
      handle('recordLauncherCommand', (id) => runtime.recordLauncherCommand(id));
      handle('systemToolsSnapshot', () => systemMetrics.snapshot());
      handle('currencyQuote', (query) => currencyService.quote(query));
      handle('setCommandFavorite', (id, favorite) =>
        runtime.run('command-favorite', async () => {
          const settings = await runtime.settings.read();
          if (typeof favorite !== 'boolean' || !runtime.commandUsage.allowed(id, settings))
            throw Error('LAUNCHER_INPUT_INVALID');
          const ids = new Set(settings.launcherCommandFavorites);
          if (favorite) ids.add(id);
          else ids.delete(id);
          const saved = await runtime.settings.write({
            ...settings,
            launcherCommandFavorites: [...ids],
          });
          emit('settingsChanged', saved);
          return saved;
        }),
      );
      handle('getStartupApps', () => startupManager.list());
      handle('setStartupAppEnabled', (id, enabled) =>
        runtime.run('startup', () => startupManager.setEnabled(id, enabled)),
      );
      handle('widgetState', () => widgetManager.state());
      handle('saveWidgets', (patch) => widgetManager.save(patch));
      handle('showWidget', (id) => widgetManager.show(id));
      handle('hideWidget', (id) => widgetManager.hide(id));
      handle('analyticsStatus', () => productivity.status());
      handle('setAnalyticsEnabled', (enabled) =>
        runtime.run('analytics', () => productivity.setEnabled(enabled)),
      );
      handle('clearAnalytics', () => runtime.run('analytics', () => productivity.clear()));
      handle('runtimeStatus', () => runtime.status());
      handle('applyFolderAppearance', () => runtime.applyFolderAppearance());
      handle('applyProfile', (id) => runtime.applyProfile(id));
      handle('restoreProfile', () => runtime.restoreProfile());
      handle('automationPreview', (value) => runtime.previewAutomation(value));
      handle('runAutomation', () => runtime.runAutomation());
      handle('registerDrop', (paths) => runtime.registerDrop(paths));
      handle('launcherEntries', async () => ({
        ...(await runtime.entries()),
        capabilities: launcherActions.capabilities(),
      }));
      handle('setLauncherFavorite', (id, value) => runtime.setFavorite(id, value));
      handle('launcherAction', async (value) => {
        const epoch = launcherEpoch;
        const result = await runtime.run('launcher-action', () => launcherActions.action(value));
        if (result.type === 'admin') await runtime.activity.record(result.id);
        if (['web', 'system', 'admin', 'reveal'].includes(result.type)) hideLauncher(epoch);
        return { ...result, launcherEpoch: epoch };
      });
      handle('launch', async (id) => {
        const epoch = launcherEpoch;
        const result = await runtime.launch(id);
        hideLauncher(epoch);
        return { ...result, launcherEpoch: epoch };
      });
      handle('runCommand', async (value) => {
        const epoch = launcherEpoch;
        const result = await command(value);
        hideLauncher(epoch);
        return { ...result, launcherEpoch: epoch };
      });
      handle('openLauncher', openLauncher);
      handle('hideLauncher', (epoch) => {
        if (epoch !== undefined && !Number.isSafeInteger(epoch))
          throw Error('LAUNCHER_INPUT_INVALID');
        hideLauncher(epoch);
      });
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
          sharedDesktop: runtime.sharedDesktop,
          downloads: runtime.downloads,
          storage,
          platform: process.platform,
          version: app.getVersion(),
          folderIcons: process.platform === 'win32',
        };
      });
      handle('reveal', async (id) => {
        const item = await runtime.resolveTrustedItem(id);
        shell.showItemInFolder(item.source);
      });
      handle('revealOutput', async (batchId, index = 0) => {
        if (
          typeof batchId !== 'string' ||
          batchId.length > 128 ||
          !Number.isInteger(index) ||
          index < 0
        )
          throw Error('TARGET_INVALID');
        const batch = (await runtime.service.history()).find((entry) => entry.id === batchId);
        if (!batch || batch.status === 'undone') throw Error('TARGET_MISSING');
        const directories = [
          ...new Set(
            batch.entries
              .filter(
                (entry) =>
                  entry.stage !== 'planned' && entry.stage !== 'undone' && entry.verified !== false,
              )
              .map((entry) => {
                runtime.service.validateJournal(entry, batch);
                return path.dirname(entry.target);
              }),
          ),
        ];
        const directory = directories[index];
        if (!directory) throw Error('TARGET_MISSING');
        await runtime.service.safeDirectory(directory, false, batch.categoryPaths);
        const stat = await fs.lstat(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('TARGET_UNSAFE');
        const error = await shell.openPath(directory);
        if (error) throw Error('OPEN_FOLDER_FAILED');
      });
      handle('updateStatus', () => updates.status());
      handle('saveUpdateAccess', (token) => updates.saveAccess(token));
      handle('clearUpdateAccess', () => updates.clearAccess());
      handle('checkUpdates', () => updates.check());
      handle('downloadUpdate', () => updates.download());
      handle('installUpdate', () => updates.install());
      handle('openDownloads', () =>
        shell.openExternal('https://github.com/Huseyinhk61/DarkDesk/releases/latest'),
      );
      handle('windowState', windowState);
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
      await productivity.status().catch((error) => report(error));
      startProductivityTimer();
      await widgetManager.initialize().catch((error) => report(error));
      app.on('activate', showMain);
      if (updateEnabled) {
        const check = () => updates.check().catch(() => {});
        updateStartupTimer = setTimeout(check, 30000);
        updateStartupTimer.unref?.();
        updateTimer = setInterval(check, 6 * 60 * 60 * 1000);
        updateTimer.unref?.();
      }
      for (const directory of [
        ...new Set([runtime.desktop, runtime.sharedDesktop].filter(Boolean)),
      ]) {
        try {
          const watcher = watch(directory, () => {
            runtime.desktopDirty = true;
            clearTimeout(watchTimer);
            watchTimer = setTimeout(() => {
              if (!runtime.busy) emit('desktopChanged');
            }, 700);
          });
          watcher.on('error', () => emit('watchError', 'WATCH_FAILED'));
          watchers.push(watcher);
        } catch {}
      }
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
  clearTimeout(updateStartupTimer);
  clearInterval(updateTimer);
  clearInterval(productivityTimer);
  updates?.dispose();
  shortcutManager?.dispose();
  watchers.forEach((watcher) => watcher.close());
  clearTimeout(watchTimer);
  clearTimeout(windowSaveTimer);
  screen.removeListener('display-removed', fitMainWindow);
  screen.removeListener('display-metrics-changed', fitMainWindow);
});
