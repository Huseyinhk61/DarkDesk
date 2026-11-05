import { version as appVersion } from '../package.json';
import { validateSettings } from '../shared/validate';
import { examples } from './data';
import {
  defaultSettings,
  defaultCategories,
  categoryId,
  classify,
  categorySegments,
  enrichItem,
  isDescendant,
} from '../shared/domain';
const delay = () => new Promise((resolve) => setTimeout(resolve, 250));
let settings;
try {
  const old = JSON.parse(localStorage.getItem('darkdesk-settings') || '{}');
  settings = validateSettings(old);
} catch {
  settings = structuredClone(defaultSettings);
}
let demo = examples.map((item, index) => ({
  ...item,
  category: categoryId(item.category),
  scope: 'desktop',
  size: index === 7 ? 1245184 : 2048,
  modified: Date.now() - (index === 7 ? 40 * 86400000 : index * 3600000),
  kind: /\.(lnk|url)$/i.test(item.name) ? 'shortcut' : 'file',
}));
let apps = [],
  history = [],
  pending = null,
  cancelled = false;
const copies = new Set(),
  listeners = new Set();
export const native = !!window.darkdesk;
export const api = window.darkdesk || {
  scan: async (scope) => {
    await delay();
    return (scope === 'system' ? apps : scope === 'downloads' ? downloadItems : demo)
      .filter(
        (i) => !settings.excludedExtensions.includes('.' + i.name.split('.').at(-1).toLowerCase()),
      )
      .map((i) => ({
        ...enrichItem(i, settings),
        usage: usage[i.id] || {
          count: 0,
          lastOpened: null,
          inactive: false,
          scope: 'darkdesk-only',
        },
      }));
  },
  scanSystem: async () => {
    cancelled = false;
    for (let i = 0; i < 4; i++) {
      await delay();
      listeners.forEach((fn) => fn({ visited: (i + 1) * 24, found: (i + 1) * 2 }));
      if (cancelled) break;
    }
    apps = [
      ['Visual Studio Code.exe', 'programFiles'],
      ['Steam.exe', 'programFilesX86'],
      ['Spotify.lnk', 'startUser'],
      ['Figma.exe', 'registry'],
      ['LibreOffice.lnk', 'startCommon'],
      ['VLC.exe', 'programFiles'],
      ['Blender.exe', 'programFiles'],
      ['Terminal.exe', 'registry'],
    ]
      .slice(0, cancelled ? 3 : 8)
      .map(([name, origin], index) => ({
        id: 'app:demo-' + index,
        name,
        source: `C:\\Program Files\\${name}`,
        target: `C:\\Program Files\\${name}`,
        origin,
        kind: 'installed',
        extension: '.exe',
        size: 1048576 * (index + 1),
        modified: Date.now(),
        category: classify({ name }, settings),
      }));
    return {
      items: apps,
      warnings: [],
      sources: ['programFiles', 'programFilesX86', 'startUser', 'registry'],
      cancelled,
      limited: false,
      supported: true,
    };
  },
  cancelScan: async () => {
    cancelled = true;
  },
  history: async () => structuredClone(history),
  updateStatus: async () => ({
    state: 'unsupported',
    reason: 'development',
    currentVersion: appVersion,
    authenticationRequired: false,
    accessConfigured: false,
    accessSupported: false,
  }),
  saveUpdateAccess: async () => {
    throw Error('UPDATE_ACCESS_UNAVAILABLE');
  },
  clearUpdateAccess: async () => api.updateStatus(),
  checkUpdates: async () => api.updateStatus(),
  downloadUpdate: async () => api.updateStatus(),
  installUpdate: async () => {
    throw Error('UPDATE_NOT_READY');
  },
  onUpdateChanged: () => () => {},
  openDownloads: async () => {
    window.open(
      'https://github.com/Huseyinhk61/DarkDesk/releases/latest',
      '_blank',
      'noopener,noreferrer',
    );
  },
  stats: async () => ({
    desktop: 'C:\\Users\\User\\Desktop',
    total: 16 * 1024 ** 3,
    free: 9.2 * 1024 ** 3,
    storage: null,
    version: appVersion,
    platform: 'demo',
  }),
  getSettings: async () => structuredClone(settings),
  applyFolderAppearance: async () => ({
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    details: [],
    unsupported: true,
  }),
  setSettings: async (value) => {
    settings = validateSettings(value);
    localStorage.setItem('darkdesk-settings', JSON.stringify(settings));
    return structuredClone(settings);
  },
  preview: async (items, mode) => {
    await delay();
    const entries = items.map((item) => {
      const source = [...demo, ...apps, ...downloadItems].find((i) => i.id === item.id);
      if (!source) throw Error('TARGET_INVALID');
      const categoryPath = categorySegments(item.category, settings.categories).join('\\');
      return {
        ...source,
        ...item,
        categoryPath,
        name: source.name,
        action: source.kind === 'installed' ? 'shortcut' : mode,
        target: `Desktop\\${categoryPath}\\${source.name}`,
        conflict: copies.has(categoryPath + '/' + item.id) ? 'TARGET_EXISTS' : '',
      };
    });
    pending = { token: crypto.randomUUID(), mode, entries };
    return {
      ...pending,
      ready: entries.filter((e) => !e.conflict).length,
      conflicts: entries.filter((e) => e.conflict).length,
      bytes: entries.filter((e) => !e.conflict).reduce((n, i) => n + i.size, 0),
    };
  },
  organize: async (token) => {
    await delay();
    if (!pending || pending.token !== token) throw Error('TARGET_INVALID');
    const { mode, entries } = pending;
    pending = null;
    const ready = entries.filter((e) => !e.conflict);
    if (!ready.length) throw Error('TARGET_EXISTS');
    history.push({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      mode,
      status: 'completed',
      entries: ready.map((item) => ({
        ...item,
        stage: item.action === 'shortcut' ? 'copied' : mode === 'move' ? 'moved' : 'copied',
      })),
      warnings: [],
      skippedDetails: entries
        .filter((item) => item.conflict)
        .map((item) => ({ id: item.id, code: item.conflict, target: item.target })),
      summary: {
        moved: mode === 'move' ? ready.filter((item) => item.action !== 'shortcut').length : 0,
        copied: mode === 'copy' ? ready.filter((item) => item.action !== 'shortcut').length : 0,
        shortcuts: ready.filter((item) => item.action === 'shortcut').length,
        skipped: entries.filter((item) => item.conflict).length,
        failed: 0,
      },
      snapshot: structuredClone(demo),
      downloadSnapshot: structuredClone(downloadItems),
      copySnapshot: [...copies],
      skipped: entries.filter((e) => e.conflict).map((e) => e.id),
    });
    ready.forEach((i) => copies.add(i.categoryPath + '/' + i.id));
    if (mode === 'move')
      downloadItems = downloadItems.filter((i) => !ready.some((x) => x.id === i.id));
    if (mode === 'move')
      demo = demo.filter((i) => !ready.some((x) => x.id === i.id && x.action !== 'shortcut'));
    return history.at(-1);
  },
  undo: async () => {
    await delay();
    const batch = [...history].reverse().find((h) => h.status !== 'undone');
    if (!batch) throw Error('OPERATION_FAILED');
    demo = structuredClone(batch.snapshot);
    if (batch.downloadSnapshot) downloadItems = structuredClone(batch.downloadSnapshot);
    copies.clear();
    batch.copySnapshot.forEach((x) => copies.add(x));
    batch.status = 'undone';
  },
  itemIcon: async (id, _refresh = false) => {
    if (![...demo, ...apps, ...downloadItems].some((item) => item.id === id))
      throw Error('SOURCE_MISSING');
    return { id, icon: null };
  },
  itemDetails: async (id) => {
    await delay();
    const item = [...demo, ...apps, ...downloadItems].find((item) => item.id === id);
    if (!item) throw Error('SOURCE_MISSING');
    return {
      id,
      icon: null,
      size: item.size,
      created: null,
      modified: item.modified,
      description: null,
      company: null,
      lastOpened: usage[id]?.lastOpened || null,
      usageScope: 'darkdesk-only',
      metadataSource: 'demo',
    };
  },
  revealOutput: async () => {
    throw Error('DEMO_REVEAL');
  },
  reveal: async () => {
    throw Error('DEMO_REVEAL');
  },
  onProgress: () => () => {},
  onScanProgress: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  onDesktopChanged: () => () => {},
  onWatchError: () => () => {},
  window: () => {},
  windowState: async () => ({ maximized: false }),
  onWindowStateChanged: () => () => {},
};

const runtimeListeners = new Set(),
  commandListeners = new Set();
const usage = {
  'Steam.lnk': {
    count: 3,
    lastOpened: Date.now() - 210 * 86400000,
    inactive: true,
    scope: 'darkdesk-only',
  },
};
let downloadItems = [
  {
    id: 'download:demo-one',
    name: 'Capture.png',
    source: 'Downloads/Capture.png',
    size: 1800000,
    modified: Date.now() - 86400000,
    kind: 'file',
    scope: 'downloads',
  },
  {
    id: 'download:demo-two',
    name: 'setup.exe',
    source: 'Downloads/setup.exe',
    size: 2400000,
    modified: Date.now() - 86400000,
    kind: 'file',
    scope: 'downloads',
  },
  {
    id: 'download:demo-vector',
    name: 'migration_cluster.blob',
    source: 'Downloads/migration_cluster.blob',
    size: 200,
    modified: Date.now() - 86400000,
    kind: 'file',
    scope: 'downloads',
  },
];
let runtime = {
  busy: null,
  profile: { activeId: null, hidden: 0, tracked: 0 },
  automation: { lastRun: null, lastError: null },
  shortcuts: [],
  visibilitySupported: true,
  trayAvailable: false,
  lastError: null,
};
const notifyRuntime = () => runtimeListeners.forEach((fn) => fn(structuredClone(runtime)));
if (!native)
  Object.assign(api, {
    runtimeStatus: async () => structuredClone(runtime),
    onRuntimeChanged: (fn) => {
      runtimeListeners.add(fn);
      return () => runtimeListeners.delete(fn);
    },
    onCommand: (fn) => {
      commandListeners.add(fn);
      return () => commandListeners.delete(fn);
    },
    onLauncherShown: () => () => {},
    applyProfile: async (id) => {
      await delay();
      const profile = settings.profiles.find((p) => p.id === id);
      if (!profile) throw Error('PROFILE_INVALID');
      runtime.profile = {
        activeId: id,
        tracked: demo.length,
        hidden: demo.filter(
          (i) =>
            !(profile.visibleNames || []).some(
              (name) => name.toLowerCase() === i.name.toLowerCase(),
            ) &&
            !profile.categories.some((cid) =>
              isDescendant(classify(i, settings), cid, settings.categories),
            ),
        ).length,
      };
      notifyRuntime();
      return runtime.profile;
    },
    restoreProfile: async () => {
      await delay();
      runtime.profile = { activeId: null, hidden: 0, tracked: 0 };
      notifyRuntime();
      return runtime.profile;
    },
    launcherEntries: async () => ({
      settings: structuredClone(settings),
      items: (await api.scan())
        .concat(await api.scan('system'))
        .map((i) => ({ ...i, usage: usage[i.id] || { count: 0 } })),
    }),
    launch: async (id) => {
      await delay();
      usage[id] = {
        count: (usage[id]?.count || 0) + 1,
        lastOpened: Date.now(),
        inactive: false,
        scope: 'darkdesk-only',
      };
    },
    runCommand: async (value) => {
      if (value.type === 'profile') return api.applyProfile(value.id);
      if (value.type === 'restore') return api.restoreProfile();
      commandListeners.forEach((fn) => fn(value));
    },
    openLauncher: async () => commandListeners.forEach((fn) => fn({ type: 'launcher' })),
    hideLauncher: async () => {},
    registerDroppedFiles: async (files) => {
      const result = [];
      for (const file of files) {
        let item =
          demo.find((i) => i.name === file.name) || downloadItems.find((i) => i.name === file.name);
        if (!item) {
          item = {
            id: 'download:' + crypto.randomUUID(),
            name: file.name,
            source: 'Downloads/' + file.name,
            size: file.size,
            modified: Date.now(),
            kind: 'file',
            scope: 'downloads',
          };
          downloadItems.push(item);
        }
        result.push(enrichItem(item, settings));
      }
      return result;
    },
    automationPreview: async (draft) => {
      const value = validateSettings(draft || settings);
      return {
        archive: demo.filter(
          (i) => i.modified < Date.now() - value.automation.archiveDays * 86400000,
        ),
        downloads: downloadItems.filter(
          (i) => i.modified < Date.now() - value.automation.settleSeconds * 1000,
        ),
      };
    },
    runAutomation: async () => {
      const candidate = await api.automationPreview(settings),
        groups = [];
      if (settings.automation.archiveEnabled)
        groups.push({
          items: candidate.archive.map((i) => ({
            ...i,
            category: settings.automation.archiveCategoryId,
          })),
          mode: 'move',
          origin: 'automation-archive',
        });
      if (settings.automation.downloadsEnabled)
        groups.push({
          items: candidate.downloads.map((i) => enrichItem(i, settings)),
          mode: settings.automation.downloadMode,
          origin: 'automation-downloads',
        });
      for (const group of groups) {
        if (!group.items.length) continue;
        const plan = await api.preview(
          group.items.map(({ id, category }) => ({ id, category })),
          group.mode,
        );
        if (plan.ready) {
          const batch = await api.organize(plan.token);
          batch.origin = group.origin;
        }
      }
      runtime.automation = { lastRun: new Date().toISOString(), lastError: null };
      notifyRuntime();
      return runtime.automation;
    },
  });
