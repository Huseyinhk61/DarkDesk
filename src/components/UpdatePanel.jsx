import { useState } from 'react';
import {
  Download,
  RefreshCw,
  RotateCw,
  ExternalLink,
  CircleCheck,
  Info,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../service';
import { usePreferences } from '../preferences';
import { useUpdates } from '../useUpdates';
import '../updates.css';

const errorCodes = new Set([
  'UPDATE_NETWORK',
  'UPDATE_SOURCE_UNAVAILABLE',
  'UPDATE_METADATA',
  'UPDATE_INTEGRITY',
  'UPDATE_DOWNLOAD_FAILED',
  'UPDATE_ACCESS',
  'UPDATE_CHECK_FAILED',
  'UPDATE_INSTALL_FAILED',
  'UPDATE_BUSY',
  'UPDATE_NOT_READY',
  'UPDATE_CANCELLED',
  'UPDATE_AUTH_REQUIRED',
  'UPDATE_AUTH_FAILED',
  'UPDATE_ACCESS_UNAVAILABLE',
]);
const statusNames = new Set([
  'idle',
  'checking',
  'available',
  'not-available',
  'downloading',
  'downloaded',
  'error',
  'unsupported',
]);
function errorCode(error) {
  const raw = typeof error === 'string' ? error : error?.message || '';
  return (
    [...errorCodes].sort((a, b) => b.length - a.length).find((code) => raw.includes(code)) ||
    'GENERIC'
  );
}

export default function UpdatePanel({ update, busy = false }) {
  const { t, locale } = usePreferences();
  const snapshot = useUpdates(update === undefined);
  const [returned, setReturned] = useState(null),
    [pending, setPending] = useState(false),
    [failure, setFailure] = useState(null),
    [accessToken, setAccessToken] = useState('');
  // Native events remain authoritative; returned snapshots also support a standalone panel.
  const value = update ?? returned ?? snapshot;
  const state = statusNames.has(value?.state) ? value.state : 'idle';
  const working = pending || state === 'checking' || state === 'downloading' || value?.installing;
  const unsupported = state === 'unsupported';
  const authenticationRequired = value?.authenticationRequired === true;
  const accessConfigured = value?.accessConfigured === true;
  const accessSupported = value?.accessSupported === true && !unsupported;
  const accessMissing = authenticationRequired && (!accessConfigured || !accessSupported);
  const error =
    failure ||
    (value?.errorCode || state === 'error'
      ? errorCodes.has(value.errorCode)
        ? value.errorCode
        : 'GENERIC'
      : null);
  const percent = Math.min(
    100,
    Math.max(
      0,
      Number(typeof value.progress === 'number' ? value.progress : value.progress?.percent) || 0,
    ),
  );
  const act = async (method, ...args) => {
    if (pending) return;
    setPending(true);
    setFailure(null);
    try {
      const result = await api[method](...args);
      if (result?.state) setReturned(result);
      return result;
    } catch (problem) {
      setFailure(errorCode(problem));
      return null;
    } finally {
      setPending(false);
    }
  };
  const saveAccess = async (event) => {
    event.preventDefault();
    if (!accessSupported || working || !accessToken.trim()) return;
    const result = await act('saveUpdateAccess', accessToken.trim());
    if (result?.accessConfigured === true) setAccessToken('');
  };
  const clearAccess = async () => {
    const result = await act('clearUpdateAccess');
    if (result?.accessConfigured === false) setAccessToken('');
  };
  const reason = ['development', 'portable', 'platform', 'unavailable'].includes(value?.reason)
    ? value.reason
    : 'unavailable';
  const checked = value?.lastChecked ? new Date(value.lastChecked) : null;
  return (
    <section className="settings-panel update-panel" id="updates" aria-labelledby="updates-title">
      <div className="update-panel-heading">
        <h2 id="updates-title">
          <RefreshCw size={20} />
          {t('update.title')}
        </h2>
        <span className={`update-state update-state-${state}`} role="status" aria-live="polite">
          {t('update.state.' + state)}
        </span>
      </div>
      <p className="muted">{t('update.body')}</p>
      <dl className="update-versions">
        <div>
          <dt>{t('update.current')}</dt>
          <dd>{value?.currentVersion || '—'}</dd>
        </div>
        {value?.version && (
          <div>
            <dt>{t('update.newVersion')}</dt>
            <dd>{value.version}</dd>
          </div>
        )}
        {checked && Number.isFinite(checked.getTime()) && (
          <div>
            <dt>{t('update.lastChecked')}</dt>
            <dd>{checked.toLocaleString(locale)}</dd>
          </div>
        )}
      </dl>
      {authenticationRequired && (
        <div className="update-access">
          <div className="update-access-heading">
            <KeyRound size={18} />
            <h3>{t('update.access.title')}</h3>
          </div>
          <p className="update-access-status" role="status">
            {t(accessConfigured ? 'update.access.configured' : 'update.access.required')}
          </p>
          {accessSupported ? (
            <form onSubmit={saveAccess} className="update-access-form">
              <label htmlFor="update-access-token">{t('update.access.label')}</label>
              <div className="update-access-controls">
                <input
                  id="update-access-token"
                  type="password"
                  value={accessToken}
                  autoComplete="new-password"
                  spellCheck={false}
                  maxLength={512}
                  aria-describedby="update-access-help"
                  disabled={!!working}
                  onChange={(event) => setAccessToken(event.target.value)}
                />
                <button
                  className="btn secondary"
                  type="submit"
                  disabled={!!working || !accessToken.trim()}
                >
                  <ShieldCheck size={16} />
                  {t('update.access.save')}
                </button>
                {accessConfigured && (
                  <button
                    className="text-btn"
                    type="button"
                    disabled={!!working}
                    onClick={clearAccess}
                  >
                    {t('update.access.clear')}
                  </button>
                )}
              </div>
              <p id="update-access-help" className="muted">
                {t('update.access.storage')}
              </p>
            </form>
          ) : (
            <>
              <p className="update-note">{t('update.access.unsupported')}</p>
              {accessConfigured && (
                <button
                  className="text-btn"
                  type="button"
                  disabled={!!working}
                  onClick={clearAccess}
                >
                  {t('update.access.clear')}
                </button>
              )}
            </>
          )}
          <details className="update-access-guidance">
            <summary>{t('update.access.guideTitle')}</summary>
            <p>{t('update.access.guide')}</p>
            <p>{t('update.access.secret')}</p>
          </details>
          <p className="muted update-private-download">{t('update.access.manual')}</p>
        </div>
      )}
      {unsupported && (
        <p className="update-note">
          <Info size={17} />
          {t('update.unsupported.' + reason)}
        </p>
      )}
      {state === 'downloaded' && (
        <p className="update-note update-ready">
          <CircleCheck size={17} />
          {t('update.ready')}
        </p>
      )}
      {state === 'downloading' && (
        <div className="update-download-progress">
          <div
            role="progressbar"
            aria-label={t('update.progress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <output>{Math.round(percent)}%</output>
        </div>
      )}
      {error && (
        <p className="update-error" role="alert">
          {t('update.errors.' + error)}
        </p>
      )}
      <div className="update-actions">
        {!unsupported && (
          <button
            type="button"
            className="btn secondary"
            disabled={!!working || accessMissing}
            onClick={() => act('checkUpdates')}
          >
            <RefreshCw size={16} className={state === 'checking' ? 'spin' : ''} />
            {t('update.check')}
          </button>
        )}
        {state === 'available' && (
          <button
            type="button"
            className="btn primary"
            disabled={!!working || accessMissing}
            onClick={() => act('downloadUpdate')}
          >
            <Download size={16} />
            {t('update.download')}
          </button>
        )}
        {state === 'downloaded' && (
          <button
            type="button"
            className="btn primary"
            disabled={!!working || !!busy}
            onClick={() => act('installUpdate')}
          >
            <RotateCw size={16} />
            {t(value?.installing ? 'update.installing' : 'update.install')}
          </button>
        )}
        <button
          type="button"
          className="text-btn update-manual"
          disabled={pending}
          onClick={() => act('openDownloads')}
        >
          <ExternalLink size={15} />
          {t('update.manual')}
        </button>
      </div>
      {state === 'downloaded' && busy && (
        <p className="muted update-busy-note">{t('update.waitForFiles')}</p>
      )}
      {!unsupported && <p className="muted update-policy">{t('update.policy')}</p>}
    </section>
  );
}
