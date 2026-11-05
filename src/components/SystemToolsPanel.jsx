import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  Clock3,
  Info,
  LockKeyhole,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';
import '../system-tools.css';

const knownErrors = [
  'STARTUP_CHANGED',
  'STARTUP_READ_ONLY',
  'STARTUP_UNSUPPORTED',
  'STARTUP_STATE_UNSAFE',
  'STARTUP_PATH_UNSAFE',
  'STARTUP_INVALID',
];
const readError = (error) =>
  knownErrors.find((code) => String(error?.message || error).includes(code)) ||
  'STARTUP_UNAVAILABLE';
const validSnapshot = (value) => {
  if (!value || typeof value.supported !== 'boolean' || !Array.isArray(value.items))
    throw Error('STARTUP_UNAVAILABLE');
  return value;
};

export default function SystemToolsPanel({ busy = false }) {
  const { t } = usePreferences();
  const [snapshot, setSnapshot] = useState(null);
  const [pending, setPending] = useState('');
  const [failure, setFailure] = useState(null);
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const working = useRef(false),
    alive = useRef(false);
  const refresh = async () => {
    if (working.current) return;
    working.current = true;
    setPending('refresh');
    setFailure(null);
    setNotice(null);
    try {
      const result = validSnapshot(await api.getStartupApps());
      if (alive.current) setSnapshot(result);
    } catch (error) {
      if (alive.current) setFailure(readError(error));
    } finally {
      working.current = false;
      if (alive.current) setPending('');
    }
  };
  useEffect(() => {
    alive.current = true;
    refresh();
    return () => {
      alive.current = false;
    };
  }, []);
  const change = async (item) => {
    if (working.current || busy || !item.canEdit || typeof item.enabled !== 'boolean') return;
    working.current = true;
    setPending(item.id);
    setFailure(null);
    setNotice(null);
    try {
      const result = validSnapshot(await api.setStartupAppEnabled(item.id, !item.enabled));
      if (alive.current) {
        setSnapshot(result);
        setNotice({ name: item.name, enabled: !item.enabled });
      }
    } catch (error) {
      if (alive.current) setFailure(readError(error));
      // A row can change in Task Manager while this page is open. Refresh the
      // authoritative list, while keeping the mutation error visible.
      try {
        const result = validSnapshot(await api.getStartupApps());
        if (alive.current) setSnapshot(result);
      } catch {}
    } finally {
      working.current = false;
      if (alive.current) setPending('');
    }
  };
  const items = snapshot?.items || [];
  const counts = {
    all: items.length,
    enabled: items.filter((item) => item.enabled === true).length,
    disabled: items.filter((item) => item.enabled === false).length,
  };
  const needle = query.trim().toLocaleLowerCase();
  const visible = items.filter(
    (item) =>
      (filter === 'all' || item.enabled === (filter === 'enabled')) &&
      (!needle ||
        [item.name, item.command].some((text) =>
          String(text || '')
            .toLocaleLowerCase()
            .includes(needle),
        )),
  );
  const locked = !!pending || busy;
  return (
    <section className="startup-page" aria-labelledby="startup-title">
      <div className="eyebrow">
        <Activity size={16} aria-hidden="true" />
        {t('startupPlus.eyebrow')}
      </div>
      <div className="startup-heading">
        <div>
          <h1 id="startup-title" className="settings-title">
            {t('startupPlus.title')}
          </h1>
          <p className="muted">{t('startupPlus.body')}</p>
        </div>
        <button className="btn secondary" onClick={refresh} disabled={locked}>
          <RefreshCw
            size={16}
            className={pending === 'refresh' ? 'startup-spin' : ''}
            aria-hidden="true"
          />
          {t('startupPlus.refresh')}
        </button>
      </div>
      <div className="startup-scope">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>{t('startupPlus.scopeTitle')}</strong>
          <p>{t('startupPlus.scopeBody')}</p>
        </div>
      </div>
      {failure && (
        <div className="startup-message startup-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{t('errors.' + failure)}</span>
        </div>
      )}
      {notice && (
        <div className="startup-message startup-success" role="status">
          <Check size={18} aria-hidden="true" />
          <span>
            {t(notice.enabled ? 'startupPlus.enabledNotice' : 'startupPlus.disabledNotice', {
              name: notice.name,
            })}
          </span>
        </div>
      )}
      {(snapshot?.warnings || []).map((code) => (
        <div key={code} className="startup-message" role="status">
          <Info size={18} aria-hidden="true" />
          <span>{t('startupPlus.warning.' + code)}</span>
        </div>
      ))}
      {snapshot?.supported === false ? (
        <div className="settings-panel startup-empty">
          <span className="startup-empty-icon">
            <Power size={28} aria-hidden="true" />
          </span>
          <h2>{t(native ? 'startupPlus.unsupportedTitle' : 'startupPlus.demoTitle')}</h2>
          <p className="muted">
            {t(native ? 'startupPlus.unsupportedBody' : 'startupPlus.demoBody')}
          </p>
        </div>
      ) : (
        <>
          <div className="startup-summary" aria-label={t('startupPlus.summary')}>
            {['all', 'enabled', 'disabled'].map((key, index) => {
              const Icon = [Activity, Power, Clock3][index];
              return (
                <div key={key}>
                  <Icon size={20} aria-hidden="true" />
                  <span>{t('startupPlus.' + key)}</span>
                  <strong>{snapshot ? counts[key] : '—'}</strong>
                </div>
              );
            })}
          </div>
          <section
            className="settings-panel startup-list-panel"
            aria-labelledby="startup-list-title"
            aria-busy={pending === 'refresh'}
          >
            <div className="startup-list-heading">
              <h2 id="startup-list-title">{t('startupPlus.listTitle')}</h2>
              <span className="muted">{t('startupPlus.listCount', { count: visible.length })}</span>
            </div>
            <div className="startup-toolbar">
              <label className="startup-search">
                <Search size={17} aria-hidden="true" />
                <input
                  aria-label={t('startupPlus.search')}
                  placeholder={t('startupPlus.search')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="startup-filter">
                <span className="sr-only">{t('startupPlus.filter')}</span>
                <select
                  className="settings-input"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  {['all', 'enabled', 'disabled'].map((value) => (
                    <option key={value} value={value}>
                      {t('startupPlus.' + value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!snapshot ? (
              <div className="startup-empty" role="status">
                <RefreshCw size={24} aria-hidden="true" className={pending ? 'startup-spin' : ''} />
                <p>{t(pending ? 'startupPlus.loading' : 'startupPlus.retry')}</p>
              </div>
            ) : !visible.length ? (
              <div className="startup-empty">
                <Search size={28} aria-hidden="true" />
                <h3>{t(items.length ? 'startupPlus.noMatches' : 'startupPlus.noItems')}</h3>
                <p className="muted">
                  {t(items.length ? 'startupPlus.noMatchesBody' : 'startupPlus.noItemsBody')}
                </p>
                {items.length > 0 && (
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                  >
                    {t('startupPlus.resetFilters')}
                  </button>
                )}
              </div>
            ) : (
              <ul className="startup-list">
                {visible.map((item) => (
                  <li key={item.id} className="startup-row">
                    <span className="startup-app-icon">
                      <Power size={21} aria-hidden="true" />
                    </span>
                    <div className="startup-app-copy">
                      <div className="startup-app-name">
                        <h3>{item.name}</h3>
                        <span
                          className={
                            'startup-status ' + (item.enabled === true ? 'is-enabled' : '')
                          }
                        >
                          {t(
                            item.enabled === true
                              ? 'startupPlus.enabled'
                              : item.enabled === false
                                ? 'startupPlus.disabled'
                                : 'startupPlus.unknown',
                          )}
                        </span>
                      </div>
                      <span className="startup-source">
                        {t('startupPlus.source.' + item.source)}
                      </span>
                      <code title={item.command}>{item.command}</code>
                      {!item.canEdit && (
                        <span className="startup-readonly">
                          <LockKeyhole size={12} aria-hidden="true" />
                          {t('startupPlus.reason.' + (item.reason || 'unknown-state'))}
                        </span>
                      )}
                    </div>
                    <div className="startup-row-action">
                      {item.canEdit ? (
                        <label className="toggle-setting startup-toggle">
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label={t('startupPlus.toggle', { name: item.name })}
                            checked={item.enabled === true}
                            disabled={locked}
                            onChange={() => change(item)}
                          />
                          <span className="switch" />
                          <span className="sr-only">
                            {t(item.enabled ? 'startupPlus.disable' : 'startupPlus.enable')}
                          </span>
                        </label>
                      ) : (
                        <LockKeyhole size={18} aria-label={t('startupPlus.readOnly')} />
                      )}
                      {pending === item.id && (
                        <span className="startup-saving" role="status">
                          {t('startupPlus.saving')}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <p className="startup-footnote">
        <Info size={16} aria-hidden="true" />
        {t('startupPlus.footnote')}
      </p>
    </section>
  );
}
