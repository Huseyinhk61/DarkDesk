import { examples, categories } from './data';
const delay = () => new Promise((resolve) => setTimeout(resolve, 250));
const defaults = {
  mode: 'move',
  autoScan: true,
  excludedExtensions: ['.ini', '.tmp'],
  overrides: {},
};
let demo = examples.map((item, index) => ({
  ...item,
  size: index === 7 ? 1245184 : 2048,
  modified: Date.now() - index * 3600000,
  kind: /\.(lnk|url)$/i.test(item.name) ? 'shortcut' : 'file',
}));
let history = [],
  pending = null;
let settings;
try {
  settings = { ...defaults, ...JSON.parse(localStorage.getItem('darkdesk-settings') || '{}') };
} catch {
  settings = structuredClone(defaults);
}
const copies = new Set();
export const native = !!window.darkdesk;
export const api = window.darkdesk || {
  scan: async () => {
    await delay();
    return demo
      .filter(
        (i) => !settings.excludedExtensions.includes('.' + i.name.split('.').at(-1).toLowerCase()),
      )
      .map((i) => ({ ...i, category: settings.overrides[i.id] ?? i.category }));
  },
  history: async () => structuredClone(history),
  stats: async () => ({
    desktop: 'C:\\Users\\Kullanıcı\\Desktop (demo)',
    total: 16 * 1024 ** 3,
    free: 9.2 * 1024 ** 3,
    storage: null,
    version: '1.1.0',
  }),
  getSettings: async () => structuredClone(settings),
  setSettings: async (value) => {
    localStorage.setItem('darkdesk-settings', JSON.stringify(value));
    settings = structuredClone(value);
    return structuredClone(settings);
  },
  preview: async (items, mode) => {
    await delay();
    const entries = items.map((item) => {
      const source = demo.find((i) => i.id === item.id);
      return {
        ...source,
        ...item,
        target: `Masaüstü\\${categories[item.category].folder}\\${source.name}`,
        conflict: copies.has(`${item.category}/${item.id}`)
          ? 'Hedefte aynı isimde bir dosya var.'
          : '',
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
    if (!pending || pending.token !== token) throw Error('Önizlemeyi yenileyin.');
    const { mode, entries } = pending;
    pending = null;
    const ready = entries.filter((e) => !e.conflict);
    if (!ready.length) throw Error('Çakışmasız öğe yok.');
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
    ready.forEach((i) => copies.add(`${i.category}/${i.id}`));
    if (mode === 'move') demo = demo.filter((i) => !ready.some((x) => x.id === i.id));
    return history.at(-1);
  },
  undo: async () => {
    await delay();
    const batch = [...history].reverse().find((h) => h.status !== 'undone');
    if (!batch) throw Error('Geri alınacak işlem yok.');
    demo = structuredClone(batch.snapshot);
    copies.clear();
    batch.copySnapshot.forEach((x) => copies.add(x));
    batch.status = 'undone';
  },
  reveal: async () => {
    throw Error('Dosyayı Explorer/Finder’da göstermek için masaüstü uygulamasını kullanın.');
  },
  onProgress: () => () => {},
  onDesktopChanged: () => () => {},
  onWatchError: () => () => {},
  window: () => {},
};
