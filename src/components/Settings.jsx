import { useEffect, useState } from 'react';
import {
  Settings2,
  History,
  ShieldCheck,
  Undo2,
  Check,
  Save,
  Radio,
  Folder,
  RotateCcw,
} from 'lucide-react';
import { canUndo } from '../utils';
import { usePreferences } from '../preferences';
import AppearanceSettings from './AppearanceSettings';
import KeyBinder from './KeyBinder';
import UpdatePanel from './UpdatePanel';
export default function Settings({ onSave, stats, history, undo, busy, update, onApplyFolders }) {
  const { settings, t, locale, errorMessage } = usePreferences();
  const operationDraft = (value) => ({
    mode: value.mode,
    autoScan: value.autoScan,
    overrides: value.overrides,
    launcherShortcut: value.launcherShortcut,
  });
  const operationalVersion = JSON.stringify({
    ...operationDraft(settings),
    excludedExtensions: settings.excludedExtensions,
  });
  const [draft, setDraft] = useState(() => operationDraft(settings)),
    [extensions, setExtensions] = useState(settings.excludedExtensions.join(', ')),
    [error, setError] = useState('');
  useEffect(() => {
    setDraft(operationDraft(settings));
    setExtensions(settings.excludedExtensions.join(', '));
  }, [operationalVersion]);
  const submit = async (e) => {
    e.preventDefault();
    const list = extensions
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((x) => (x.startsWith('.') ? x.toLowerCase() : '.' + x.toLowerCase()));
    if (list.some((x) => !/^\.[a-z0-9]{1,12}$/i.test(x))) {
      setError(t('errors.EXTENSIONS_INVALID'));
      return;
    }
    setError('');
    await onSave({ ...settings, ...draft, excludedExtensions: [...new Set(list)] });
  };
  return (
    <>
      <div className="eyebrow">{t('settings.eyebrow')}</div>
      <h1 className="settings-title">{t('settings.title')}</h1>
      <p className="muted">{t('settings.body')}</p>
      <UpdatePanel update={update} busy={!!busy} />
      <AppearanceSettings
        onSave={onSave}
        busy={busy}
        onApplyFolders={onApplyFolders}
        platform={stats?.platform}
      />
      <form onSubmit={submit}>
        <fieldset disabled={!!busy}>
          <section className="settings-panel">
            <h2>
              <Settings2 size={20} />
              {t('settings.method')}
            </h2>
            <div role="radiogroup" aria-label={t('settings.method')}>
              {['move', 'copy'].map((mode) => (
                <button
                  type="button"
                  key={mode}
                  role="radio"
                  aria-checked={draft.mode === mode}
                  className={`mode-option ${draft.mode === mode ? 'chosen' : ''}`}
                  onClick={() => setDraft({ ...draft, mode })}
                >
                  <span className="radio">{draft.mode === mode && <span />}</span>
                  <div>
                    <b>{t('settings.' + mode)}</b>
                    <p>{t('settings.' + mode + 'Body')}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="info-note">
              <ShieldCheck size={18} />
              {t('settings.approval')}
            </div>
            <h2>
              <Radio size={19} />
              {t('settings.watch')}
            </h2>
            <label className="toggle-setting">
              <span>
                <b>{t('settings.autoScan')}</b>
                <small>{t('settings.autoScanBody')}</small>
              </span>
              <input
                type="checkbox"
                checked={draft.autoScan}
                onChange={(e) => setDraft({ ...draft, autoScan: e.target.checked })}
              />
              <span className="switch" />
            </label>
            <label className="field-label" htmlFor="extensions">
              {t('settings.excluded')}
            </label>
            <input
              className="settings-input"
              id="extensions"
              placeholder=".ini, .tmp"
              value={extensions}
              onChange={(e) => setExtensions(e.target.value)}
            />
            <p className="muted">{t('settings.hidden')}</p>
            <h2>{t('settings.path')}</h2>
            <code className="desktop-path">{stats?.desktop || t('common.loading')}</code>
            <div className="settings-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => setDraft({ ...draft, overrides: {} })}
              >
                <RotateCcw size={15} />
                {t('settings.reset')}
              </button>
              <button className="btn primary" type="submit">
                <Save size={15} />
                {t('common.save')}
              </button>
            </div>
            <p className="muted">{t('tray.note')}</p>
            <label className="field-label" htmlFor="launcher-shortcut">
              {t('launcher.shortcut')}
            </label>
            <KeyBinder
              id="launcher-shortcut"
              label={t('launcher.shortcut')}
              value={draft.launcherShortcut}
              currentId="launcher"
              assignments={settings.profiles.map((p) => ({
                id: 'profile:' + p.id,
                accelerator: p.shortcut,
              }))}
              disabled={!!busy}
              onChange={(launcherShortcut) => setDraft({ ...draft, launcherShortcut })}
            />
            {error && (
              <p role="alert" className="warning-text">
                {error}
              </p>
            )}
          </section>
        </fieldset>
      </form>
      <section className="settings-panel" id="history">
        <div className="history-heading">
          <h2>
            <History size={20} />
            {t('history.title')}
            <span className="count-badge">{history.length}</span>
          </h2>
          <button className="btn secondary" disabled={!canUndo(history) || !!busy} onClick={undo}>
            <Undo2 size={15} />
            {t('common.undoLast')}
          </button>
        </div>
        {history.length ? (
          <div className="history-list">
            {[...history].reverse().map((batch) => (
              <div className="history-row" key={batch.id}>
                <span className={`history-icon ${batch.status === 'undone' ? 'done' : ''}`}>
                  {batch.status === 'undone' ? <Check size={18} /> : <Folder size={18} />}
                </span>
                <span>
                  <b>
                    {batch.entries.filter((e) => e.stage !== 'planned').length} {t('common.items')}{' '}
                    ·{' '}
                    {t(
                      'history.' +
                        (batch.entries.some((e) => e.action === 'shortcut')
                          ? 'shortcut'
                          : batch.mode),
                    )}
                  </b>
                  <small>
                    {new Date(batch.date).toLocaleString(locale)}
                    {batch.skipped?.length > 0 &&
                      ` · ${t('history.skipped', { count: batch.skipped.length })}`}
                  </small>
                  {batch.origin && batch.origin !== 'manual' && (
                    <small>{t('history.' + batch.origin)}</small>
                  )}
                  {batch.error && (
                    <small className="warning-text">{errorMessage(batch.error)}</small>
                  )}
                </span>
                <span
                  className={`status-badge ${batch.status === 'undone' ? 'success' : batch.error ? 'warning' : ''}`}
                >
                  {t('status.' + (batch.status || 'completed'))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">{t('history.empty')}</p>
        )}
        <p className="muted history-note">{t('history.note')}</p>
      </section>
    </>
  );
}
