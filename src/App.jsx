import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import Titlebar from './components/Titlebar';
import Header from './components/Header';
import CategoryGrid from './components/CategoryGrid';
import ItemCard from './components/ItemCard';
import PreviewModal from './components/PreviewModal';
import ScannerPanel from './components/ScannerPanel';
import EmptyState from './components/EmptyState';
import { api, native } from './service';
import { canUndo, formatBytes, isShortcut } from './utils';
import { usePreferences } from './preferences';
import { isDescendant } from '../shared/domain';
import { folderAppearanceVersion } from '../shared/folder-appearance';
import { classificationReason } from '../shared/grouping';
import { matchesAccelerator } from '../shared/hotkeys';
import Profiles from './components/Profiles';
import { publishNotice } from './notifications';
import { useUpdates } from './useUpdates';
import UpdateNotice from './components/UpdateNotice';
import { refreshNativeIcons } from './components/NativeItemIcon';
import OperationReceipt from './components/OperationReceipt';
import DesktopScanSummary from './components/DesktopScanSummary';
const Settings = lazy(() => import('./components/Settings'));
const Launcher = lazy(() => import('./components/Launcher'));
const CurrencyConverter = lazy(() => import('./components/CurrencyConverter'));
const CategoryManager = lazy(() => import('./components/CategoryManager'));
const AutomationPanel = lazy(() => import('./components/AutomationPanel'));
const HelpPanel = lazy(() => import('./components/HelpPanel'));
const WidgetsPanel = lazy(() => import('./components/WidgetsPanel'));
const SystemToolsPanel = lazy(() => import('./components/SystemToolsPanel'));
const AnalyticsPanel = lazy(() => import('./components/AnalyticsPanel'));
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
    [reviewOnly, setReviewOnly] = useState(false),
    [sort, setSort] = useState('name'),
    [progress, setProgress] = useState(null),
    [scope, setScopeState] = useState('desktop'),
    [locationPath, setLocationPath] = useState(''),
    [scanProgress, setScanProgress] = useState(null),
    [scanResult, setScanResult] = useState(null),
    [runtime, setRuntime] = useState(null),
    [launcherOpen, setLauncherOpen] = useState(false);
  useEffect(() => api.onSettingsChanged?.((value) => setSettings(value)), [setSettings]);
  const update = useUpdates();
  const [requestedCategory, setRequestedCategory] = useState(null),
    [folderResult, setFolderResult] = useState(null);
  const customizeCategory = (id) => {
    setRequestedCategory(id || null);
    setView('categories');
  };
  const [updatesRequested, setUpdatesRequested] = useState(0);
  const backendBusy = useRef(null);
  const runtimeRevision = useRef(0);
  const acceptRuntime = useCallback((value, revision) => {
    if (revision !== runtimeRevision.current) return;
    setRuntime(value);
    backendBusy.current = value.busy;
  }, []);
  const syncRuntime = useCallback(async () => {
    const revision = runtimeRevision.current;
    acceptRuntime(await api.runtimeStatus(), revision);
  }, [acceptRuntime]);
  const mainRef = useRef(null);
  const previousView = useRef(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    if (previousView.current !== null && previousView.current !== view)
      mainRef.current?.focus({ preventScroll: true });
    previousView.current = view;
  }, [view, scope]);
  const [shown, setShown] = useState(48);
  useEffect(() => setShown(48), [query, filter, type, scope, reviewOnly]);
  const knownIds = useRef(new Set()),
    searchRef = useRef(null),
    busyRef = useRef(true),
    scopeRef = useRef('desktop'),
    refreshRequest = useRef(0);
  const notify = useCallback((message, kind = 'info', undoable = false) => {
    setToast({ ...(typeof message === 'object' ? message : { message }), kind, undoable });
    if (typeof message === 'string') publishNotice(message, kind);
  }, []);
  const start = useCallback((name) => {
    if (busyRef.current || backendBusy.current) return false;
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
    const requestedScope = scopeRef.current;
    const request = ++refreshRequest.current;
    const data = await api.scan(requestedScope);
    const revision = runtimeRevision.current;
    const [batches, system, runtimeState] = await Promise.all([
      api.history(),
      api.stats(),
      api.runtimeStatus(),
    ]);
    if (request !== refreshRequest.current || requestedScope !== scopeRef.current) return;
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
    acceptRuntime(runtimeState, revision);
    setLast(new Date());
    setError('');
  }, [acceptRuntime]);
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
        !e.defaultPrevented &&
        !document.querySelector('[role="dialog"][aria-modal="true"]') &&
        !e.altKey &&
        !e.shiftKey &&
        !e.target.closest?.('[data-keybinder]') &&
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
    if (!['system', 'custom'].includes(scopeRef.current) || !start('deep')) return;
    setView('scan');
    setScanProgress({ visited: 0, found: 0 });
    try {
      const result = await (scopeRef.current === 'custom' ? api.scanLocation() : api.scanSystem());
      setScanResult(result);
      await refresh();
      notify(t('scan.complete', { count: result.items.length }));
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const chooseLocation = async () => {
    if (!start('deep')) return;
    try {
      const result = await api.chooseScanLocation();
      if (!result || (result.cancelled && !result.path)) return;
      scopeRef.current = 'custom';
      setScopeState('custom');
      setLocationPath(result.path);
      setFilter(null);
      setQuery('');
      setType('all');
      setReviewOnly(false);
      setSelected(new Set());
      setScanResult(result);
      await refresh();
      notify(t('scan.complete', { count: result.items.length }));
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const scan = () =>
    ['system', 'custom'].includes(scopeRef.current) ? scanSystem() : scanDesktop();
  const setScope = async (value) => {
    if (
      !['desktop', 'system', 'downloads'].includes(value) ||
      value === scopeRef.current ||
      !start('scan')
    )
      return;
    scopeRef.current = value;
    setScopeState(value);
    setItems([]);
    setSelected(new Set());
    setQuery('');
    setFilter(null);
    setType('all');
    setReviewOnly(false);
    try {
      await refresh();
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const applyFolders = async () => {
    if (!start('folder-appearance')) return null;
    try {
      const result = await api.applyFolderAppearance();
      setFolderResult(result);
      await refresh();
      notify(
        t('folders.result', result),
        result.failed ? 'error' : result.updated ? 'success' : 'info',
      );
      return result;
    } catch (error) {
      notify(errorMessage(error), 'error');
      return null;
    } finally {
      finish();
    }
  };
  const prepareFolder = async (id) => {
    if (!start('folder-appearance')) return;
    try {
      const result = await api.prepareCategoryFolder(id);
      setFolderResult(result);
      notify(t('folders.result', result), result.failed ? 'error' : 'info');
      return result;
    } catch (error) {
      notify(errorMessage(error), 'error');
    } finally {
      finish();
    }
  };
  const saveSettings = async (value, { applyFolders = false } = {}) => {
    if (!start('settings')) return false;
    try {
      const updateFolders =
        native &&
        stats?.platform === 'win32' &&
        (applyFolders || folderAppearanceVersion(settings) !== folderAppearanceVersion(value));
      const saved = await api.setSettings(value);
      setSettings(saved);
      let appearanceWarning = '';
      if (updateFolders) {
        try {
          const result = await api.applyFolderAppearance();
          setFolderResult(result);
          if (
            result.failed ||
            result.refreshPending ||
            result.details?.some((entry) => entry.code && entry.code !== 'FOLDER_NOT_CREATED')
          )
            appearanceWarning =
              t('folders.result', result) +
              (result.refreshPending ? ' ' + t('folders.refreshPending') : '');
        } catch (error) {
          appearanceWarning = errorMessage(error);
        }
      }
      if (filter && !saved.categories.some((c) => c.id === filter)) setFilter(null);
      await refresh();
      if (appearanceWarning)
        notify(t('customFolder.savedApplyWarning', { message: appearanceWarning }), 'info');
      else notify({ key: 'notify.saved' });
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
  const classificationMetadata = useMemo(
    () => new Map(items.map((item) => [item.id, classificationReason(item, settings)])),
    [items, settings],
  );
  const reviewCount = [...classificationMetadata.values()].filter(
    (reason) => reason.needsReview,
  ).length;
  const visible = useMemo(
    () =>
      items
        .filter(
          (item) =>
            (!reviewOnly || classificationMetadata.get(item.id)?.needsReview) &&
            (type === 'all' || (type === 'shortcuts' ? isShortcut(item) : !isShortcut(item))) &&
            (filter === null || isDescendant(item.category, filter, settings.categories)) &&
            `${item.name} ${item.target || ''} ${item.insight?.description?.[settings.language] || ''}`
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
    [
      items,
      type,
      filter,
      query,
      sort,
      locale,
      settings.categories,
      settings.language,
      reviewOnly,
      classificationMetadata,
    ],
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
  const applyProfile = async (id) => {
    if (!start('profile')) return;
    try {
      await api.applyProfile(id);
      await syncRuntime();
      notify(t('profiles.applied'));
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const restoreProfile = async () => {
    if (!start('profile')) return;
    try {
      await api.restoreProfile();
      await syncRuntime();
      notify(t('profiles.restored'));
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const runAutomation = async () => {
    if (!settings.automation.archiveEnabled && !settings.automation.downloadsEnabled)
      return notify(t('automation.disabled'));
    if (!start('automation')) return;
    try {
      await api.runAutomation();
      await refresh();
      notify(t('automation.completed'), 'success', true);
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const handleCommand = async (command) => {
    if (command.type === 'updates') {
      setView('settings');
      setUpdatesRequested((value) => value + 1);
      return;
    }
    if (command.type === 'launcher') {
      setLauncherOpen(true);
      return;
    }
    if (command.type === 'show') {
      setView('groups');
      return;
    }
    if (command.type === 'profile') return applyProfile(command.id);
    if (command.type === 'restore') return restoreProfile();
    if (command.type === 'organize') {
      if (!start('preview')) return;
      try {
        scopeRef.current = 'desktop';
        setScopeState('desktop');
        setView('groups');
        const data = await api.scan('desktop');
        if (!data.length) return notify(t('notify.select'));
        setItems(data);
        setSelected(new Set(data.map((i) => i.id)));
        knownIds.current = new Set(data.map((i) => i.id));
        setLast(new Date());
        setPlan(
          await api.preview(
            data.map(({ id, category }) => ({ id, category })),
            settings.mode,
          ),
        );
      } catch (e) {
        notify(errorMessage(e), 'error');
      } finally {
        finish();
      }
    }
  };
  const commandRef = useRef(handleCommand);
  commandRef.current = handleCommand;
  useEffect(() => {
    const off = api.onRuntimeChanged((value) => {
      acceptRuntime(value, ++runtimeRevision.current);
    });
    const offCommand = api.onCommand((value) => commandRef.current(value));
    const keydown = (e) => {
      if (native || e.defaultPrevented || e.target.closest?.('[data-keybinder]')) return;
      const mac = /Mac/i.test(navigator.platform);
      const launcherKey =
        matchesAccelerator(settings.launcherShortcut, e, mac) ||
        matchesAccelerator('Control+Space', e, mac);
      const restoreKey = matchesAccelerator(settings.restoreShortcut, e, mac);
      const profile = settings.profiles.find((p) => matchesAccelerator(p.shortcut, e, mac));
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        // Suppress Space's default button activation while a page shortcut is blocked.
        if (launcherKey || profile || restoreKey) e.preventDefault();
        return;
      }
      if (launcherKey) {
        e.preventDefault();
        setLauncherOpen((open) => !open);
      }
      if (restoreKey) {
        e.preventDefault();
        commandRef.current({ type: 'restore' });
      }
      if (profile) {
        e.preventDefault();
        commandRef.current({ type: 'profile', id: profile.id });
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      off();
      offCommand();
      window.removeEventListener('keydown', keydown);
    };
  }, [settings.profiles, settings.launcherShortcut, settings.restoreShortcut, acceptRuntime]);
  useEffect(() => {
    if (view === 'settings' && updatesRequested)
      document.getElementById('updates')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [view, updatesRequested]);
  const navigate = (value) => {
    if (value === 'launcher') {
      api.openLauncher().catch((e) => notify(errorMessage(e), 'error'));
      return;
    }
    setView(value);
  };
  const dropItem = async (id, category, files = []) => {
    if (!start(files.length ? 'preview' : 'settings')) return;
    try {
      let dropped = [];
      if (files.length) dropped = await api.registerDroppedFiles(files);
      else {
        const item = items.find((i) => i.id === id);
        if (!item) throw Error('DROP_INVALID');
        dropped = [item];
      }
      const overrides = { ...settings.overrides };
      dropped.forEach((i) => (overrides[i.id] = category));
      const saved = await api.setSettings({ ...settings, overrides });
      setSettings(saved);
      if (files.length) {
        setPlan(
          await api.preview(
            dropped.map((i) => ({ id: i.id, category })),
            saved.mode,
          ),
        );
        notify(t('drag.external'));
      } else {
        await refresh();
        notify(t('drag.assigned'));
      }
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      finish();
    }
  };
  const blocked = busy || runtime?.busy;

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        {t('a11y.skipContent')}
      </a>
      <Sidebar {...{ view, stats, native, update }} setView={navigate} />
      <div className="main-shell">
        <Titlebar view={view} native={native} />
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          aria-label={t('nav.' + view)}
          aria-busy={!!blocked}
        >
          <UpdateNotice
            update={update}
            onOpen={() => {
              setView('settings');
              setUpdatesRequested((value) => value + 1);
            }}
          />
          {runtime?.lastError && (
            <div className="notice warning runtime-error" role="alert">
              {errorMessage(runtime.lastError)}
            </div>
          )}
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
          <Suspense
            fallback={
              <div className="empty-state" role="status">
                <LoaderCircle size={24} className="spin" />
                {t('common.loading')}
              </div>
            }
          >
            {view === 'currency' ? (
              <CurrencyConverter />
            ) : view === 'widgets' ? (
              <WidgetsPanel />
            ) : view === 'systemTools' ? (
              <SystemToolsPanel />
            ) : view === 'analytics' ? (
              <AnalyticsPanel />
            ) : view === 'help' ? (
              <HelpPanel onNavigate={navigate} busy={!!blocked} />
            ) : view === 'profiles' ? (
              <Profiles
                runtime={runtime}
                onApply={applyProfile}
                onRestore={restoreProfile}
                onSave={saveSettings}
                busy={blocked}
              />
            ) : view === 'automation' ? (
              <AutomationPanel
                runtime={runtime}
                onSave={saveSettings}
                onRun={runAutomation}
                busy={blocked}
              />
            ) : view === 'settings' ? (
              <Settings
                {...{ stats, history, undo, update }}
                busy={blocked}
                onSave={saveSettings}
                onApplyFolders={applyFolders}
              />
            ) : view === 'categories' ? (
              <CategoryManager
                onSave={saveSettings}
                busy={blocked}
                items={items}
                onApplyFolders={applyFolders}
                onPrepareFolder={prepareFolder}
                desktopPath={stats?.desktop}
                lastFolderResult={folderResult}
                requestedCategory={requestedCategory}
                onCategoryOpened={() => setRequestedCategory(null)}
                platform={stats?.platform}
              />
            ) : (
              <>
                <Header
                  {...{ scan, last, native }}
                  busy={blocked}
                  count={items.length}
                  selectedCount={selected.size}
                  scope={scope}
                  organize={preview}
                />
                {scope === 'desktop' && (
                  <DesktopScanSummary
                    report={runtime?.desktopScanReport}
                    mode={settings.mode}
                    filteredCount={visible.length}
                    totalCount={items.length}
                    onClearFilters={() => {
                      setQuery('');
                      setFilter(null);
                      setType('all');
                      setReviewOnly(false);
                    }}
                  />
                )}
                <OperationReceipt
                  batch={[...history].reverse().find((batch) => batch.status !== 'undone')}
                  busy={blocked}
                  native={native}
                  undo={undo}
                  onReveal={(id, index) =>
                    api.revealOutput(id, index).catch((e) => notify(errorMessage(e), 'error'))
                  }
                />
                <Profiles
                  compact
                  runtime={runtime}
                  onApply={applyProfile}
                  onRestore={restoreProfile}
                  busy={blocked}
                />
                {view === 'scan' && (
                  <ScannerPanel
                    platform={stats?.platform}
                    {...{
                      scope,
                      setScope,
                      scanSystem,
                      scan,
                      scanProgress,
                      scanResult,
                      chooseLocation,
                      locationPath,
                    }}
                    busy={blocked}
                    desktopPath={stats?.desktop}
                    downloadsPath={stats?.downloads}
                  />
                )}
                <div className="section-heading">
                  <h2>
                    {t('groups.title')}
                    <span>
                      {settings.categories
                        .filter((category) => !category.parentId)
                        .length.toString()
                        .padStart(2, '0')}
                    </span>
                  </h2>
                  <button className="text-btn" onClick={() => setView('categories')}>
                    <FolderTree size={14} />
                    {t('groups.manage')}
                  </button>
                </div>
                <fieldset disabled={!!busy} className="category-fieldset">
                  <CategoryGrid
                    onCustomize={customizeCategory}
                    {...{ items, filter, setFilter }}
                    disabled={!!blocked}
                    onDropItem={dropItem}
                  />
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
                    <div className="panel-header-actions">
                      <button
                        type="button"
                        className="group-review-toggle"
                        aria-pressed={reviewOnly}
                        disabled={!!blocked || (!reviewCount && !reviewOnly)}
                        title={!reviewCount ? t('groups.reviewEmpty') : undefined}
                        onClick={() => {
                          if (!reviewOnly) {
                            setFilter(null);
                            setQuery('');
                            setType('all');
                          }
                          setReviewOnly(!reviewOnly);
                        }}
                      >
                        <AlertTriangle size={14} />
                        {t('groups.review', { count: reviewCount })}
                      </button>
                      <button
                        className="text-btn"
                        onClick={undo}
                        disabled={!canUndo(history) || !!blocked}
                      >
                        <Undo2 size={15} />
                        {t('common.undo')}
                      </button>
                    </div>
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
                      <button
                        className="tool-btn icons-refresh"
                        disabled={!!blocked}
                        onClick={refreshNativeIcons}
                        aria-label={t('desktop.refreshIcons')}
                        title={t('desktop.refreshIcons')}
                      >
                        <RefreshCw size={16} />
                        <span>{t('desktop.refreshIcons')}</span>
                      </button>
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
                        <button
                          onClick={() => setFilter(null)}
                          aria-label={t('panel.clearCategory')}
                        >
                          <X size={12} />
                        </button>
                      )}
                      <Folder size={12} />
                      {filter === null
                        ? `${visible.length} / ${items.length} ${t('common.items')}`
                        : categoryLabel(filter)}
                    </span>
                  </div>
                  <div
                    className={`items-grid ${layout === 'list' ? 'list-layout' : ''}`}
                    key={scope}
                  >
                    {displayed.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        classification={classificationMetadata.get(item.id)}
                        selected={selected.has(item.id)}
                        toggle={() => toggle(item.id)}
                        onCategory={(category) =>
                          saveSettings({
                            ...settings,
                            overrides: { ...settings.overrides, [item.id]: category },
                          })
                        }
                        onDescription={(text) =>
                          saveSettings({
                            ...settings,
                            itemDescriptions: { ...settings.itemDescriptions, [item.id]: text },
                          })
                        }
                        onIcon={(icon) =>
                          saveSettings({
                            ...settings,
                            itemIcons: { ...settings.itemIcons, [item.id]: icon },
                          })
                        }
                        disabled={!!blocked}
                        onAcceptSuggestion={(category) =>
                          saveSettings({
                            ...settings,
                            overrides: { ...settings.overrides, [item.id]: category },
                          })
                        }
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
                      system={['system', 'custom'].includes(scope)}
                      downloads={scope === 'downloads'}
                      busy={busy}
                      clear={() => {
                        setQuery('');
                        setFilter(null);
                        setType('all');
                        setReviewOnly(false);
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
          </Suspense>
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
            <button className="toast-undo" disabled={!!blocked || !canUndo(history)} onClick={undo}>
              <Undo2 size={14} />
              {t('common.undo')}
            </button>
          )}
          <button onClick={() => setToast(null)} aria-label={t('notify.dismiss')}>
            <X size={16} />
          </button>
        </div>
      )}
      {launcherOpen && (
        <Suspense fallback={null}>
          <Launcher onClose={() => setLauncherOpen(false)} onCommand={handleCommand} />
        </Suspense>
      )}
      {plan && <PreviewModal {...{ plan, native }} onClose={closePlan} onConfirm={execute} />}
    </div>
  );
}
