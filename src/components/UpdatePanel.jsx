import { useState } from 'react';
import { Download, RefreshCw, RotateCw, ExternalLink, CircleCheck, Info } from 'lucide-react';
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
  return [...errorCodes].find((code) => raw.includes(code)) || 'GENERIC';
}

export default function UpdatePanel({ update, busy = false }) {
  const { t, locale } = usePreferences();
  const snapshot = useUpdates(update === undefined);
  const [returned, setReturned] = useState(null),
    [pending, setPending] = useState(false),
    [failure, setFailure] = useState(null);
  // Native events remain authoritative; returned snapshots also support a standalone panel.
  const value = update ?? returned ?? snapshot;
  const state = statusNames.has(value?.state) ? value.state : 'idle';
  const working = pending || state === 'checking' || state === 'downloading' || value?.installing;
  const unsupported = state === 'unsupported';
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
  const act = async (method) => {
    if (pending) return;
    setPending(true);
    setFailure(null);
    try {
      const result = await api[method]();
      if (result?.state) setReturned(result);
    } catch (problem) {
      setFailure(errorCode(problem));
    } finally {
      setPending(false);
    }
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
            disabled={!!working}
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
            disabled={!!working}
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
