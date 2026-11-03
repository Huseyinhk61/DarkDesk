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
  ScanLine,
  Info,
  LoaderCircle,
  AlertTriangle,
  ArrowDownUp,
  RefreshCw,
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CategoryGrid from './components/CategoryGrid';
import ItemCard from './components/ItemCard';
import Settings from './components/Settings';
import PreviewModal from './components/PreviewModal';
import { categories } from './data';
import { api, native } from './service';
import { canUndo, formatBytes, isShortcut } from './utils';
const initialSettings = {
  mode: 'move',
  autoScan: true,
  excludedExtensions: ['.ini', '.tmp'],
  overrides: {},
};
export default function App() {
  const [view, setView] = useState('groups');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('loading');
  const [last, setLast] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(initialSettings);
  const [plan, setPlan] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [layout, setLayout] = useState(() => localStorage.getItem('darkdesk-layout') || 'grid');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('name');
  const [progress, setProgress] = useState(null);
  const knownIds = useRef(new Set());
  const searchRef = useRef(null);
  const busyRef = useRef(true);
  const notify = useCallback((message, kind = 'info') => setToast({ message, kind }), []);
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
    const [data, batches, system] = await Promise.all([api.scan(), api.history(), api.stats()]);
    const oldIds = knownIds.current;
    setSelected(
      (previous) =>
        new Set(
          data
            .filter((item) => previous.has(item.id) || !oldIds.has(item.id))
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
        if (active) {
          setError(e.message);
          notify(e.message, 'error');
        }
      } finally {
        if (active) finish();
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh, finish, notify]);
  useEffect(() => {
    const unsubscribe = api.onDesktopChanged(async () => {
      if (!settings.autoScan || !start('scan')) return;
      try {
        await refresh();
      } catch (e) {
        setError(e.message);
      } finally {
        finish();
      }
    });
    const offProgress = api.onProgress(setProgress);
    const offError = api.onWatchError((message) => notify(message, 'error'));
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
      offError();
      clearInterval(timer);
    };
  }, [settings.autoScan, refresh, start, finish, notify]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.kind === 'error' ? 12000 : 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    localStorage.setItem('darkdesk-layout', layout);
  }, [layout]);
  useEffect(() => {
    const handler = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k' &&
        view !== 'settings'
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view]);
  const scan = async () => {
    if (!start('scan')) return;
    try {
      await refresh();
      notify('Tarama tamamlandı. Kategori önerilerini gözden geçirebilirsin.');
    } catch (e) {
      setError(e.message);
      notify(e.message, 'error');
    } finally {
      finish();
    }
  };
  const saveSettings = async (value) => {
    if (!start('settings')) return;
    try {
      setSettings(await api.setSettings(value));
      await refresh();
      notify('Tercihlerin bu cihaza kaydedildi.');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      finish();
    }
  };
  const changeCategory = async (item, category) =>
    saveSettings({ ...settings, overrides: { ...settings.overrides, [item.id]: category } });
  const preview = async () => {
    if (!selected.size) return notify('Önce düzenlenecek öğeleri seç.');
    if (!start('preview')) return;
    try {
      setPlan(
        await api.preview(
          items.filter((i) => selected.has(i.id)).map(({ id, category }) => ({ id, category })),
          settings.mode,
        ),
      );
    } catch (e) {
      notify(e.message, 'error');
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
      notify(
        `${result.entries.length} öğe ${settings.mode === 'move' ? 'taşındı' : 'kopyalandı'}.${native ? ' Geçmişten geri alabilirsin.' : ' Demo: gerçek dosyalar değişmedi.'}`,
      );
    } catch (e) {
      notify(e.message, 'error');
      try {
        await refresh();
      } catch {
        /* Preserve the original operation error. */
      }
    } finally {
      finish();
    }
  };
  const undo = async () => {
    if (!start('undo')) return;
    try {
      await api.undo();
      await refresh();
      notify('Son düzenleme geri alındı.');
    } catch (e) {
      notify(e.message, 'error');
      try {
        setHistory(await api.history());
      } catch {
        /* Preserve original error. */
      }
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
              .toLocaleLowerCase('tr')
              .includes(query.toLocaleLowerCase('tr')),
        )
        .sort((a, b) =>
          sort === 'size'
            ? b.size - a.size
            : sort === 'modified'
              ? b.modified - a.modified
              : a.name.localeCompare(b.name, 'tr'),
        ),
    [items, type, filter, query, sort],
  );
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selected.has(item.id));
  const selectedBytes = items
    .filter((item) => selected.has(item.id))
    .reduce((sum, item) => sum + (item.size || 0), 0);
  const toggle = (id) =>
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleVisible = () =>
    setSelected((previous) => {
      const next = new Set(previous);
      visible.forEach((item) => (allVisibleSelected ? next.delete(item.id) : next.add(item.id)));
      return next;
    });
  const closePlan = useCallback(() => setPlan(null), []);
  const busyLabels = {
    loading: 'Masaüstün hazırlanıyor…',
    scan: 'Masaüstü taranıyor…',
    preview: 'Hedefler ve çakışmalar kontrol ediliyor…',
    organize: 'Dosyalar doğrulanarak düzenleniyor…',
    undo: 'Son düzenleme geri alınıyor…',
    settings: 'Tercihler kaydediliyor…',
  };
  return (
    <div className="app-shell">
      <Sidebar {...{ view, setView, stats, native }} />
      <div className="main-shell">
        <div className="titlebar">
          <span>
            Çalışma alanı <span>/</span>
            <b>
              {view === 'settings'
                ? 'Otomasyon & Ayarlar'
                : view === 'scan'
                  ? 'Masaüstü Tarama'
                  : 'Akıllı Gruplar'}
            </b>
          </span>
          <div>
            <span className="titlebar-local">
              <span className="online" />
              {native ? 'Yerel bağlantı aktif' : 'Önizleme modu'}
            </span>
            <button disabled={!native} onClick={() => api.window('minimize')} aria-label="Küçült">
              <Minus size={14} />
            </button>
            <button disabled={!native} onClick={() => api.window('maximize')} aria-label="Büyüt">
              <Square size={11} />
            </button>
            <button
              disabled={!native}
              className="close"
              onClick={() => api.window('close')}
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <main aria-busy={!!busy}>
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={20} />
              <span>{error}</span>
              <button className="btn secondary" disabled={!!busy} onClick={scan}>
                <RefreshCw size={14} />
                Yeniden dene
              </button>
            </div>
          )}
          {view === 'settings' ? (
            <Settings {...{ settings, stats, history, undo, busy }} onSave={saveSettings} />
          ) : (
            <>
              <Header {...{ scan, busy, last, native }} count={items.length} organize={preview} />
              {view === 'scan' && (
                <section className="scan-info">
                  <ScanLine size={25} />
                  <div>
                    <h3>Masaüstü Tarama Motoru</h3>
                    <p>
                      Dosya adları, uzantılar ve Windows kısayol hedefleri analiz edilir. Manuel
                      kategori tercihlerin hatırlanır.
                    </p>
                    <code>{stats?.desktop}</code>
                    <div className="scan-details">
                      <span>{items.filter(isShortcut).length} kısayol</span>
                      <span>{items.filter((i) => !isShortcut(i)).length} dosya</span>
                      <span>{formatBytes(items.reduce((sum, i) => sum + i.size, 0))}</span>
                      <span>
                        {settings.autoScan && native ? 'Canlı takip açık' : 'Manuel tarama'}
                      </span>
                    </div>
                  </div>
                </section>
              )}
              <div className="section-heading">
                <h2>
                  Akıllı grupların <span>05</span>
                </h2>
                <span>Her dosya için doğru bir yer.</span>
              </div>
              <fieldset disabled={!!busy} className="category-fieldset">
                <CategoryGrid {...{ items, filter, setFilter }} />
              </fieldset>
              <section className="live-panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      Masaüstün, kontrol altında{' '}
                      <span className="live-tag">
                        <span />
                        {native && settings.autoScan ? 'CANLI' : 'HAZIR'}
                      </span>
                    </h2>
                    <p>Taşımadan önce gözden geçir. Her şey tam istediğin yerde olsun.</p>
                  </div>
                  <button
                    className="text-btn"
                    onClick={undo}
                    disabled={!canUndo(history) || !!busy}
                  >
                    <Undo2 size={15} />
                    Geri al
                  </button>
                </div>
                <div className="toolbar">
                  <div className="filter-tabs">
                    {[
                      ['all', 'Tüm öğeler', items.length],
                      ['shortcuts', 'Kısayollar', items.filter(isShortcut).length],
                      ['files', 'Dosyalar', items.filter((i) => !isShortcut(i)).length],
                    ].map(([id, label, count]) => (
                      <button
                        key={id}
                        className={type === id ? 'active' : ''}
                        onClick={() => setType(id)}
                      >
                        {label}
                        <span>{count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="tools">
                    <div className="search">
                      <Search size={15} />
                      <input
                        ref={searchRef}
                        aria-label="Öğe ara"
                        placeholder="Öğe ara… (Ctrl K)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button onClick={() => setQuery('')} aria-label="Aramayı temizle">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="sort-select">
                      <ArrowDownUp size={14} />
                      <select
                        aria-label="Öğeleri sırala"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="name">Ada göre</option>
                        <option value="size">Boyuta göre</option>
                        <option value="modified">En yeni</option>
                      </select>
                    </div>
                    <button
                      className="tool-btn"
                      title="Düzenleme ayarları"
                      aria-label="Düzenleme ayarları"
                      onClick={() => setView('settings')}
                    >
                      <SlidersHorizontal size={16} />
                    </button>
                    <div className="view-toggle">
                      <button
                        className={layout === 'grid' ? 'active' : ''}
                        onClick={() => setLayout('grid')}
                        aria-label="Kart görünümü"
                        aria-pressed={layout === 'grid'}
                      >
                        <LayoutGrid size={15} />
                      </button>
                      <button
                        className={layout === 'list' ? 'active' : ''}
                        onClick={() => setLayout('list')}
                        aria-label="Liste görünümü"
                        aria-pressed={layout === 'list'}
                      >
                        <List size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="selection-line">
                  <button
                    onClick={toggleVisible}
                    disabled={!!busy || !visible.length}
                    aria-label="Görünen öğeleri seç veya kaldır"
                  >
                    <span className={`checkbox ${allVisibleSelected ? 'on' : ''}`}>
                      {allVisibleSelected && <Check size={11} />}
                    </span>
                    {selected.size} öğe seçili{' '}
                    <span className="selection-size">· {formatBytes(selectedBytes)}</span>
                  </button>
                  <span>
                    {filter !== null && (
                      <button
                        onClick={() => setFilter(null)}
                        aria-label="Kategori filtresini temizle"
                      >
                        <X size={12} />
                      </button>
                    )}
                    <Folder size={12} />
                    {filter === null
                      ? `${visible.length} / ${items.length} öğe`
                      : categories[filter].folder}
                  </span>
                </div>
                <div className={`items-grid ${layout === 'list' ? 'list-layout' : ''}`}>
                  {visible.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      selected={selected.has(item.id)}
                      toggle={() => toggle(item.id)}
                      onCategory={(category) => changeCategory(item, category)}
                      disabled={!!busy}
                      reveal={() => api.reveal(item.id).catch((e) => notify(e.message, 'error'))}
                    />
                  ))}
                </div>
                {!visible.length && (
                  <div className="empty">
                    <Folder size={32} />
                    <h3>
                      {busy
                        ? 'Masaüstün hazırlanıyor…'
                        : items.length
                          ? 'Bu filtreye uygun öğe bulunamadı.'
                          : 'Masaüstünde düzenlenecek öğe yok.'}
                    </h3>
                    <p>
                      {items.length
                        ? 'Aramanı veya kategori filtreni değiştirebilirsin.'
                        : 'Yeni dosyaları görmek için yeniden tara.'}
                    </p>
                    {items.length > 0 && (
                      <button
                        className="btn secondary"
                        onClick={() => {
                          setQuery('');
                          setFilter(null);
                          setType('all');
                        }}
                      >
                        Filtreleri temizle
                      </button>
                    )}
                  </div>
                )}
                <div className="panel-footer">
                  <ShieldCheck size={14} />
                  <span>
                    {native
                      ? 'Dosyaların cihazında kalır. Kontrol her zaman sende.'
                      : 'Demo verileri görüntüleniyor. Gerçek dosyalar için masaüstü uygulamasını başlat.'}
                  </span>
                  <span className="footer-right">
                    {settings.mode === 'move' ? 'Taşıma modu' : 'Kopyalama modu'}
                    <span>✦</span>
                  </span>
                </div>
              </section>
            </>
          )}
          <div className="page-footer">
            <span>DAHA SADE BİR MASAÜSTÜ, DAHA NET BİR ZİHİN.</span>
            <span>
              DarkDesk <span>✦</span>
            </span>
          </div>
        </main>
      </div>
      {busy && (
        <div className="activity-bar" role="status">
          <LoaderCircle size={16} className="spin" />
          <span>{busyLabels[busy]}</span>
          {progress && (
            <b>
              {progress.completed} / {progress.total}
            </b>
          )}
        </div>
      )}
      {toast && (
        <div
          className={`toast ${toast.kind === 'error' ? 'error-toast' : ''}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          <Info size={18} />
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Bildirimi kapat">
            <X size={16} />
          </button>
        </div>
      )}
      {plan && <PreviewModal {...{ plan, native }} onClose={closePlan} onConfirm={execute} />}
    </div>
  );
}
