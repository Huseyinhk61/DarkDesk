import { validateSettings } from '../shared/validate';
import { examples } from './data';
import {
  defaultSettings,
  defaultCategories,
  categoryId,
  classify,
  categorySegments,
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
  modified: Date.now() - index * 3600000,
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
    return (scope === 'system' ? apps : demo)
      .filter(
        (i) => !settings.excludedExtensions.includes('.' + i.name.split('.').at(-1).toLowerCase()),
      )
      .map((i) => ({ ...i, category: classify(i, settings) }));
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
  stats: async () => ({
    desktop: 'C:\\Users\\User\\Desktop',
    total: 16 * 1024 ** 3,
    free: 9.2 * 1024 ** 3,
    storage: null,
    version: '2.0.0',
    platform: 'demo',
  }),
  getSettings: async () => structuredClone(settings),
  setSettings: async (value) => {
    settings = validateSettings(value);
    localStorage.setItem('darkdesk-settings', JSON.stringify(settings));
    return structuredClone(settings);
  },
  preview: async (items, mode) => {
    await delay();
    const entries = items.map((item) => {
      const source = [...demo, ...apps].find((i) => i.id === item.id);
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
      entries: ready,
      snapshot: structuredClone(demo),
      copySnapshot: [...copies],
      skipped: entries.filter((e) => e.conflict).map((e) => e.id),
    });
    ready.forEach((i) => copies.add(i.categoryPath + '/' + i.id));
    if (mode === 'move')
      demo = demo.filter((i) => !ready.some((x) => x.id === i.id && x.action !== 'shortcut'));
    return history.at(-1);
  },
  undo: async () => {
    await delay();
    const batch = [...history].reverse().find((h) => h.status !== 'undone');
    if (!batch) throw Error('OPERATION_FAILED');
    demo = structuredClone(batch.snapshot);
    copies.clear();
    batch.copySnapshot.forEach((x) => copies.add(x));
    batch.status = 'undone';
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
};
