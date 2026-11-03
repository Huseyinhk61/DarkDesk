import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Minus,
  Square,
  X,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Undo2,
  Folder,
  Check,
  ShieldCheck,
  Info,
  LoaderCircle,
  AlertTriangle,
  ArrowDownUp,
  RefreshCw,
  FolderTree,
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CategoryGrid from './components/CategoryGrid';
import ItemCard from './components/ItemCard';
import Settings from './components/Settings';
import PreviewModal from './components/PreviewModal';
import CategoryManager from './components/CategoryManager';
import ScannerPanel from './components/ScannerPanel';
import EmptyState from './components/EmptyState';
import { api, native } from './service';
import { canUndo, formatBytes, isShortcut } from './utils';
import { usePreferences } from './preferences';
export default function App() {
  const { settings, setSettings, t, locale, errorMessage, categoryLabel } = usePreferences();
  const [view, setView] = useState('groups'),
    [items, setItems] = useState([]),
    [selected, setSelected] = useState(new Set()),
    [filter, setFilter] = useState(null),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState('loading'),
    [last, setLast] = useState(null),
    [stats, setStats] = useState(null),
    [history, setHistory] = useState([]),
    [plan, setPlan] = useState(null),
    [toast, setToast] = useState(null),
    [error, setError] = useState(''),
    [layout, setLayout] = useState(() => localStorage.getItem('darkdesk-layout') || 'grid'),
    [type, setType] = useState('all'),
    [sort, setSort] = useState('name'),
    [progress, setProgress] = useState(null),
    [scope, setScopeState] = useState('desktop'),
    [scanProgress, setScanProgress] = useState(null),
    [scanResult, setScanResult] = useState(null);
  const [shown, setShown] = useState(48);
  useEffect(() => setShown(48), [query, filter, type, scope]);
  const knownIds = useRef(new Set()),
    searchRef = useRef(null),
    busyRef = useRef(true),
    scopeRef = useRef('desktop');
  const notify = useCallback(
    (message, kind = 'info', undoable = false) =>
      setToast({ ...(typeof message === 'object' ? message : { message }), kind, undoable }),
    [],
  );
  const start = useCallback((name) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(name);
    return true;
  }, []);
  const finish = useCallback(() => {
    busyRef.current = false;
    setBusy('');
    setProgress(null);
  }, []);
  const refresh = useCallback(async () => {
    const [data, batches, system] = await Promise.all([
      api.scan(scopeRef.current),
      api.history(),
      api.stats(),
    ]);
    const oldIds = knownIds.current;
    setSelected(
      (previous) =>
        new Set(
          data
            .filter((item) => previous.has(item.id) || !oldIds.has(item.id))
            .slice(0, 5000)
            .map((item) => item.id),
        ),
    );
    knownIds.current = new Set(data.map((item) => item.id));
    setItems(data);
    setHistory(batches);
    setStats(system);
    setLast(new Date());
    setError('');
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const value = await api.getSettings();
        if (active) {
          setSettings(value);
          await refresh();
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) finish();
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh, finish, setSettings]);
  useEffect(() => {
    const unsubscribe = api.onDesktopChanged(async () => {
      if (!settings.autoScan || scopeRef.current !== 'desktop' || !start('scan')) return;
      try {
        await refresh();
      } catch (e) {
        setError(e.message);
      } finally {
        finish();
      }
    });
    const offProgress = api.onProgress(setProgress),
      offScan = api.onScanProgress(setScanProgress),
      offError = api.onWatchError((message) => setError(message));
    const timer = setInterval(
      () =>
        api
          .stats()
          .then(setStats)
          .catch(() => {}),
      15000,
    );
    return () => {
      unsubscribe();
      offProgress();
      offScan();
      offError();
      clearInterval(timer);
    };
  }, [settings.autoScan, refresh, start, finish]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.kind === 'error' ? 12000 : 8000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => localStorage.setItem('darkdesk-layout', layout), [layout]);
  useEffect(() => {
    const onKey = (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'k' &&
        !['settings', 'categories'].includes(view)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);
  const scanDesktop = async () => {
    if (!start('scan')) return;
    try {
      await refresh();
      notify(t('notify.scanned'));
    } catch (e) {
      setError(e.message);
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const scanSystem = async (cancel = false) => {
    if (cancel) {
      await api.cancelScan();
      return;
    }
    if (!start('deep')) return;
    scopeRef.current = 'system';
    setScopeState('system');
    setView('scan');
    setScanProgress({ visited: 0, found: 0 });
    try {
      const result = await api.scanSystem();
      setScanResult(result);
      await refresh();
      notify(t('scan.complete', { count: result.items.length }));
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const scan = () => (scopeRef.current === 'system' ? scanSystem() : scanDesktop());
  const setScope = async (value) => {
    if (!start('scan')) return;
    scopeRef.current = value;
    setScopeState(value);
    setFilter(null);
    setType('all');
    try {
      await refresh();
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const saveSettings = async (value) => {
    if (!start('settings')) return false;
    try {
      const saved = await api.setSettings(value);
      setSettings(saved);
      if (filter && !saved.categories.some((c) => c.id === filter)) setFilter(null);
      await refresh();
      notify({ key: 'notify.saved' });
      return true;
    } catch (e) {
      notify(errorMessage(e), 'error');
      return false;
    } finally {
      finish();
    }
  };
  const preview = async () => {
    if (!selected.size) return notify(t('notify.select'));
    if (!start('preview')) return;
    try {
      setPlan(
        await api.preview(
          items.filter((i) => selected.has(i.id)).map(({ id, category }) => ({ id, category })),
          settings.mode,
        ),
      );
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const execute = async () => {
    if (!start('organize')) return;
    const token = plan.token;
    setPlan(null);
    try {
      const result = await api.organize(token);
      await refresh();
      notify(t('notify.organized', { count: result.entries.length }), 'success', true);
    } catch (e) {
      notify(errorMessage(e), 'error');
      try {
        await refresh();
      } catch {}
    } finally {
      finish();
    }
  };
  const undo = async () => {
    if (!start('undo')) return;
    try {
      await api.undo();
      await refresh();
      notify(t('notify.undone'), 'success');
    } catch (e) {
      notify(errorMessage(e), 'error');
      try {
        setHistory(await api.history());
      } catch {}
    } finally {
      finish();
    }
  };
  const visible = useMemo(
    () =>
      items
        .filter(
          (item) =>
            (type === 'all' || (type === 'shortcuts' ? isShortcut(item) : !isShortcut(item))) &&
            (filter === null || item.category === filter) &&
            `${item.name} ${item.target || ''}`
              .toLocaleLowerCase(locale)
              .includes(query.toLocaleLowerCase(locale)),
        )
        .sort((a, b) =>
          sort === 'size'
            ? b.size - a.size
            : sort === 'modified'
              ? b.modified - a.modified
              : a.name.localeCompare(b.name, locale),
        ),
    [items, type, filter, query, sort, locale],
  );
  const displayed = visible.slice(0, shown);
  const allVisibleSelected =
    displayed.length > 0 && displayed.every((item) => selected.has(item.id));
  const selectedBytes = items
    .filter((item) => selected.has(item.id))
    .reduce((n, i) => n + (i.size || 0), 0);
  const toggle = (id) =>
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleVisible = () =>
    setSelected((previous) => {
      const next = new Set(previous);
      displayed.forEach((item) => (allVisibleSelected ? next.delete(item.id) : next.add(item.id)));
      return next;
    });
  const closePlan = useCallback(() => setPlan(null), []);
  return (
    <div className="app-shell">
      <Sidebar {...{ view, setView, stats, native }} />
      <div className="main-shell">
        <div className="titlebar">
          <span>
            {t('window.workspace')}
            <span>/</span>
            <b>{t('nav.' + view)}</b>
          </span>
          <div>
            <span className="titlebar-local">
              <span className="online" />
              {t(native ? 'window.connection' : 'window.demo')}
            </span>
            {[
              ['minimize', Minus],
              ['maximize', Square],
              ['close', X],
            ].map(([action, Icon]) => (
              <button
                key={action}
                disabled={!native}
                className={action === 'close' ? 'close' : ''}
                onClick={() => api.window(action)}
                aria-label={t('window.' + action)}
              >
                <Icon size={action === 'maximize' ? 11 : 14} />
              </button>
            ))}
          </div>
        </div>
        <main aria-busy={!!busy}>
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={20} />
              <span>{errorMessage(error)}</span>
              <button className="btn secondary" disabled={!!busy} onClick={scan}>
                <RefreshCw size={14} />
                {t('common.retry')}
              </button>
            </div>
          )}
          {view === 'settings' ? (
            <Settings {...{ stats, history, undo, busy }} onSave={saveSettings} />
          ) : view === 'categories' ? (
            <CategoryManager onSave={saveSettings} busy={busy} />
          ) : (
            <>
              <Header {...{ scan, busy, last, native }} count={items.length} organize={preview} />
              {view === 'scan' && (
                <ScannerPanel
                  platform={stats?.platform}
                  {...{ scope, setScope, scanSystem, busy, scanProgress, scanResult }}
                />
              )}
              <div className="section-heading">
                <h2>
                  {t('groups.title')}
                  <span>{settings.categories.length.toString().padStart(2, '0')}</span>
                </h2>
                <button className="text-btn" onClick={() => setView('categories')}>
                  <FolderTree size={14} />
                  {t('groups.manage')}
                </button>
              </div>
              <fieldset disabled={!!busy} className="category-fieldset">
                <CategoryGrid {...{ items, filter, setFilter }} />
              </fieldset>
              <section className="live-panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      {t('panel.title')}
                      <span className="live-tag">
                        <span />
                        {t(
                          native && settings.autoScan ? 'common.live' : 'common.ready',
                        ).toLocaleUpperCase(locale)}
                      </span>
                    </h2>
                    <p>{t('panel.body')}</p>
                  </div>
                  <button
                    className="text-btn"
                    onClick={undo}
                    disabled={!canUndo(history) || !!busy}
                  >
                    <Undo2 size={15} />
                    {t('common.undo')}
                  </button>
                </div>
                <div className="toolbar">
                  <div className="filter-tabs">
                    {[
                      ['all', 'common.all', items.length],
                      ['shortcuts', 'common.shortcuts', items.filter(isShortcut).length],
                      ['files', 'panel.files', items.filter((i) => !isShortcut(i)).length],
                    ].map(([id, key, count]) => (
                      <button
                        key={id}
                        className={type === id ? 'active' : ''}
                        onClick={() => setType(id)}
                      >
                        {t(key)}
                        <span>{count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="tools">
                    <div className="search">
                      <Search size={15} />
                      <input
                        ref={searchRef}
                        aria-label={t('panel.search')}
                        placeholder={t('panel.searchPlaceholder')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button onClick={() => setQuery('')} aria-label={t('panel.clearSearch')}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="sort-select">
                      <ArrowDownUp size={14} />
                      <select
                        aria-label={t('panel.sort')}
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        {[
                          ['name', 'panel.sortName'],
                          ['size', 'panel.sortSize'],
                          ['modified', 'panel.sortDate'],
                        ].map(([id, key]) => (
                          <option value={id} key={id}>
                            {t(key)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="tool-btn"
                      aria-label={t('panel.settings')}
                      onClick={() => setView('settings')}
                    >
                      <SlidersHorizontal size={16} />
                    </button>
                    <div className="view-toggle">
                      {[
                        ['grid', LayoutGrid],
                        ['list', List],
                      ].map(([id, Icon]) => (
                        <button
                          key={id}
                          className={layout === id ? 'active' : ''}
                          onClick={() => setLayout(id)}
                          aria-label={t('panel.' + id)}
                          aria-pressed={layout === id}
                        >
                          <Icon size={15} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="selection-line">
                  <button
                    onClick={toggleVisible}
                    disabled={!!busy || !visible.length}
                    aria-label={t('panel.selectVisible')}
                  >
                    <span className={`checkbox ${allVisibleSelected ? 'on' : ''}`}>
                      {allVisibleSelected && <Check size={11} />}
                    </span>
                    {t('panel.selected', { count: selected.size })}
                    <span className="selection-size">· {formatBytes(selectedBytes, locale)}</span>
                  </button>
                  <span>
                    {filter !== null && (
                      <button onClick={() => setFilter(null)} aria-label={t('panel.clearCategory')}>
                        <X size={12} />
                      </button>
                    )}
                    <Folder size={12} />
                    {filter === null
                      ? `${visible.length} / ${items.length} ${t('common.items')}`
                      : categoryLabel(filter)}
                  </span>
                </div>
                <div className={`items-grid ${layout === 'list' ? 'list-layout' : ''}`} key={scope}>
                  {displayed.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      selected={selected.has(item.id)}
                      toggle={() => toggle(item.id)}
                      onCategory={(category) =>
                        saveSettings({
                          ...settings,
                          overrides: { ...settings.overrides, [item.id]: category },
                        })
                      }
                      onIcon={(icon) =>
                        saveSettings({
                          ...settings,
                          itemIcons: { ...settings.itemIcons, [item.id]: icon },
                        })
                      }
                      disabled={!!busy}
                      reveal={() =>
                        api
                          .reveal(item.id)
                          .catch((e) =>
                            notify(
                              e.message === 'DEMO_REVEAL'
                                ? t('notify.demoReveal')
                                : errorMessage(e),
                              'error',
                            ),
                          )
                      }
                    />
                  ))}
                </div>
                {visible.length > shown && (
                  <div className="load-more">
                    <button className="btn secondary" onClick={() => setShown((n) => n + 48)}>
                      {t('panel.more', { count: visible.length - shown })}
                    </button>
                  </div>
                )}
                {!visible.length && (
                  <EmptyState
                    filtered={items.length > 0}
                    system={scope === 'system'}
                    busy={busy}
                    clear={() => {
                      setQuery('');
                      setFilter(null);
                      setType('all');
                    }}
                    scan={scope === 'system' ? () => scanSystem() : scan}
                  />
                )}
                <div className="panel-footer">
                  <ShieldCheck size={14} />
                  <span>{t(native ? 'panel.keepLocal' : 'panel.demoNote')}</span>
                  <span className="footer-right">
                    {t(
                      scope === 'system'
                        ? 'panel.linkMode'
                        : settings.mode === 'move'
                          ? 'panel.moveMode'
                          : 'panel.copyMode',
                    )}
                    <span>✦</span>
                  </span>
                </div>
              </section>
            </>
          )}
          <div className="page-footer">
            <span>{t('footer.tagline')}</span>
            <span>
              DarkDesk <span>✦</span>
            </span>
          </div>
        </main>
      </div>
      {busy && (
        <div className="activity-bar" role="status">
          <LoaderCircle size={16} className="spin" />
          <span>{t('busy.' + busy)}</span>
          {progress && (
            <b>
              {progress.completed} / {progress.total}
            </b>
          )}
          {busy === 'deep' && <button onClick={() => api.cancelScan()}>{t('scan.cancel')}</button>}
        </div>
      )}
      {toast && (
        <div
          className={`toast ${toast.kind === 'error' ? 'error-toast' : ''}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-icon">
            {toast.kind === 'success' ? <Check size={18} /> : <Info size={18} />}
          </span>
          <span>{toast.key ? t(toast.key, toast.params) : toast.message}</span>
          {toast.undoable && (
            <button className="toast-undo" disabled={!!busy || !canUndo(history)} onClick={undo}>
              <Undo2 size={14} />
              {t('common.undo')}
            </button>
          )}
          <button onClick={() => setToast(null)} aria-label={t('notify.dismiss')}>
            <X size={16} />
          </button>
        </div>
      )}
      {plan && <PreviewModal {...{ plan, native }} onClose={closePlan} onConfirm={execute} />}
    </div>
  );
}
