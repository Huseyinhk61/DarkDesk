import {
  defaultWidgetState,
  normalizeWidgetState,
  validateWidgetPatch,
  widgetIds,
} from '../shared/widget-model';
import { version as appVersion } from '../package.json';
import { validateSettings } from '../shared/validate';
import { examples } from './data';
import { browserLauncherAction, browserLauncherCapabilities } from './launcher-actions';
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
function demoIndexedItems() {
  const indexed = new Map([...demo, ...apps, ...downloadItems].map((item) => [item.id, item]));
  for (const batch of [...history].reverse()) {
    if (batch.status !== 'completed') continue;
    for (const entry of batch.entries) {
      if (
        indexed.has(entry.id) ||
        entry.action === 'shortcut' ||
        !['moved', 'copied'].includes(entry.stage)
      )
        continue;
      indexed.set(entry.id, {
        ...entry,
        source: 'C:\\Users\\User\\' + entry.target,
        scope: 'managed',
      });
    }
  }
  return [...indexed.values()];
}
let widgetModel;
try {
  widgetModel = normalizeWidgetState(
    JSON.parse(localStorage.getItem('darkdesk-preview-widgets') || 'null'),
  );
} catch {
  widgetModel = structuredClone(defaultWidgetState);
}
const widgetListeners = new Set();
function previewWidgetState() {
  return {
    ...structuredClone(widgetModel),
    platform: 'demo',
    placements: Object.fromEntries(
      widgetIds.map((id) => [id, { mode: 'floating', supported: false, reason: 'browser' }]),
    ),
  };
}
function savePreviewWidgets(next) {
  localStorage.setItem('darkdesk-preview-widgets', JSON.stringify(next));
  widgetModel = next;
  const value = previewWidgetState();
  widgetListeners.forEach((fn) => fn(value));
  return value;
}
const commandIds = new Set([
  'command:show',
  'command:organize',
  'command:restore',
  'system:empty-trash',
  'system:lock',
  'system:shutdown',
  'system:mute',
]);
function commandAllowed(id) {
  return commandIds.has(id) || settings.profiles.some((profile) => id === 'command:' + profile.id);
}
function previewCommandUsage() {
  try {
    const value = JSON.parse(localStorage.getItem('darkdesk-preview-commands') || '{}');
    return Object.fromEntries(
      Object.entries(value).filter(
        ([id, record]) =>
          commandAllowed(id) &&
          record &&
          Number.isSafeInteger(record.count) &&
          record.count > 0 &&
          Number.isFinite(record.lastUsed) &&
          record.lastUsed <= Date.now(),
      ),
    );
  } catch {
    return {};
  }
}
const previewAnalytics = () => ({
  enabled: false,
  supported: false,
  capability: 'foreground',
  paused: false,
  samplingAvailable: false,
  runningAvailable: false,
  lastError: null,
  sampleIntervalSeconds: 15,
  retentionDays: 90,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  days: [],
});
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
    if (!demoIndexedItems().some((item) => item.id === id)) throw Error('SOURCE_MISSING');
    return { id, icon: null };
  },
  itemPurpose: async (id) => {
    if (!demoIndexedItems().some((item) => item.id === id)) throw Error('SOURCE_MISSING');
    return {
      id,
      description: null,
      company: null,
      purposeDescription: null,
      purposeSource: null,
      metadataSource: 'demo',
    };
  },
  systemToolsSnapshot: async () => ({
    cpuPercent: null,
    memory: null,
    coreCount: null,
    platform: 'demo',
    sampledAt: Date.now(),
    unsupported: true,
  }),
  getStartupApps: async () => ({ supported: false, platform: 'demo', items: [], warnings: [] }),
  setStartupAppEnabled: async () => {
    throw Error('STARTUP_UNSUPPORTED');
  },
  widgetState: async () => previewWidgetState(),
  saveWidgets: async (patch) => savePreviewWidgets(validateWidgetPatch(widgetModel, patch)),
  showWidget: async (id) => {
    if (!widgetIds.includes(id)) throw Error('WIDGETS_INVALID');
    const next = structuredClone(widgetModel);
    next.widgets[id].enabled = true;
    return savePreviewWidgets(next);
  },
  hideWidget: async (id) => {
    if (!widgetIds.includes(id)) throw Error('WIDGETS_INVALID');
    const next = structuredClone(widgetModel);
    next.widgets[id].enabled = false;
    return savePreviewWidgets(next);
  },
  onWidgetsChanged: (fn) => {
    widgetListeners.add(fn);
    return () => widgetListeners.delete(fn);
  },
  analyticsStatus: async () => previewAnalytics(),
  setAnalyticsEnabled: async (enabled) => {
    if (typeof enabled !== 'boolean') throw Error('ANALYTICS_INVALID');
    if (enabled) throw Error('ANALYTICS_UNSUPPORTED');
    return previewAnalytics();
  },
  clearAnalytics: async () => previewAnalytics(),
  onAnalyticsChanged: () => () => {},
  recordLauncherCommand: async (id) => {
    if (!commandAllowed(id)) throw Error('LAUNCHER_INPUT_INVALID');
    const records = previewCommandUsage();
    records[id] = {
      count: Math.min(Number.MAX_SAFE_INTEGER, (records[id]?.count || 0) + 1),
      lastUsed: Date.now(),
    };
    localStorage.setItem('darkdesk-preview-commands', JSON.stringify(records));
    return { id, ...records[id] };
  },
  itemDetails: async (id) => {
    await delay();
    const item = demoIndexedItems().find((item) => item.id === id);
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
try {
  const saved = JSON.parse(localStorage.getItem('darkdesk-demo-usage') || '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const [id, record] of Object.entries(saved).slice(0, 10000)) {
      if (
        !id ||
        id.length > 512 ||
        ['__proto__', 'constructor', 'prototype'].includes(id) ||
        !record ||
        typeof record !== 'object'
      )
        continue;
      usage[id] = {
        count: Number.isFinite(record.count) && record.count >= 0 ? Math.min(record.count, 1e9) : 0,
        lastOpened:
          Number.isFinite(record.lastOpened) &&
          record.lastOpened > 0 &&
          record.lastOpened <= Date.now()
            ? record.lastOpened
            : null,
        favorite: record.favorite === true,
        inactive: record.inactive === true,
        scope: 'darkdesk-only',
      };
    }
  }
} catch {}
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
    launcherEntries: async () => {
      const indexed = new Map(
        (await api.scan()).concat(await api.scan('system')).map((item) => [item.id, item]),
      );
      const known = new Map(demoIndexedItems().map((item) => [item.id, item]));
      for (const batch of history.filter((batch) => batch.status === 'completed'))
        for (const entry of batch.entries) {
          if (!indexed.has(entry.id) && known.has(entry.id))
            indexed.set(entry.id, enrichItem(known.get(entry.id), settings));
        }
      return {
        settings: structuredClone(settings),
        capabilities: browserLauncherCapabilities(),
        commandUsage: previewCommandUsage(),
        items: [...indexed.values()].map((item) => ({
          ...item,
          usage: usage[item.id] || { count: 0 },
        })),
      };
    },
    launcherAction: browserLauncherAction,
    setLauncherFavorite: async (id, favorite) => {
      if (typeof id !== 'string' || !demoIndexedItems().some((item) => item.id === id))
        throw Error('SOURCE_MISSING');
      if (typeof favorite !== 'boolean') throw Error('LAUNCHER_INPUT_INVALID');
      usage[id] = { ...(usage[id] || { count: 0, lastOpened: null }), favorite };
      localStorage.setItem('darkdesk-demo-usage', JSON.stringify(usage));
      return { id, favorite };
    },
    launch: async (id) => {
      await delay();
      if (!demoIndexedItems().some((item) => item.id === id)) throw Error('SOURCE_MISSING');
      usage[id] = {
        ...usage[id],
        firstSeen: usage[id]?.firstSeen || Date.now(),
        count: (usage[id]?.count || 0) + 1,
        lastOpened: Date.now(),
        inactive: false,
        scope: 'darkdesk-only',
      };
      localStorage.setItem('darkdesk-demo-usage', JSON.stringify(usage));
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
