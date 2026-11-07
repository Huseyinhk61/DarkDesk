import { useState, useEffect } from 'react';
import { Archive, Download, Filter, Sparkles, Eye, Play, Save, Clock, Info } from 'lucide-react';
import { usePreferences } from '../preferences';
import { api, native } from '../service';
import { formatBytes } from '../utils';
export default function AutomationPanel({ runtime, onSave, onRun, busy }) {
  const { settings, t, label, locale, errorMessage } = usePreferences();
  const [draft, setDraft] = useState(settings),
    [preview, setPreview] = useState(null),
    [error, setError] = useState('');
  const configVersion = JSON.stringify({
    automation: settings.automation,
    scanFilters: settings.scanFilters,
  });
  useEffect(() => setDraft(settings), [configVersion]);
  const update = (value) => setDraft({ ...draft, automation: { ...draft.automation, ...value } });
  const filters = (value) =>
    setDraft({ ...draft, scanFilters: { ...draft.scanFilters, ...value } });
  const list = (value) =>
    value
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
  return (
    <>
      <div className="eyebrow">{t('nav.automation')}</div>
      <h1 className="settings-title">{t('automation.title')}</h1>
      <p className="muted">{t('automation.body')}</p>
      {!native && (
        <div className="notice">
          <Info size={17} />
          {t('automation.demo')}
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          await onSave({
            ...settings,
            automation: draft.automation,
            scanFilters: draft.scanFilters,
          });
        }}
      >
        <fieldset disabled={!!busy}>
          <div className="automation-grid">
            <section className="settings-panel">
              <h2>
                <Archive size={20} />
                {t('automation.archive')}
              </h2>
              <label className="toggle-setting">
                <span>
                  <small>{t('automation.archiveBody')}</small>
                </span>
                <input
                  type="checkbox"
                  aria-label={t('automation.archive')}
                  checked={draft.automation.archiveEnabled}
                  onChange={(e) => update({ archiveEnabled: e.target.checked })}
                />
                <span className="switch" />
              </label>
              <label className="field-label" htmlFor="archive-days">
                {t('automation.days')}
              </label>
              <input
                id="archive-days"
                className="settings-input"
                type="number"
                min={1}
                max={3650}
                value={draft.automation.archiveDays}
                onChange={(e) => update({ archiveDays: Number(e.target.value) })}
              />
              <label className="field-label" htmlFor="archive-category">
                {t('automation.destination')}
              </label>
              <select
                id="archive-category"
                className="settings-input"
                value={draft.automation.archiveCategoryId}
                onChange={(e) => update({ archiveCategoryId: e.target.value })}
              >
                {settings.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {label(c)}
                  </option>
                ))}
              </select>
            </section>
            <section className="settings-panel">
              <h2>
                <Download size={20} />
                {t('automation.downloads')}
              </h2>
              <label className="toggle-setting">
                <span>
                  <small>{t('automation.downloadsBody')}</small>
                </span>
                <input
                  type="checkbox"
                  aria-label={t('automation.downloads')}
                  checked={draft.automation.downloadsEnabled}
                  onChange={(e) => update({ downloadsEnabled: e.target.checked })}
                />
                <span className="switch" />
              </label>
              <label className="field-label" htmlFor="settle-seconds">
                {t('automation.settle')}
              </label>
              <input
                id="settle-seconds"
                className="settings-input"
                type="number"
                min={5}
                max={300}
                value={draft.automation.settleSeconds}
                onChange={(e) => update({ settleSeconds: Number(e.target.value) })}
              />
              <label className="field-label" htmlFor="download-mode">
                {t('settings.method')}
              </label>
              <select
                id="download-mode"
                className="settings-input"
                value={draft.automation.downloadMode}
                onChange={(e) => update({ downloadMode: e.target.value })}
              >
                <option value="move">{t('settings.move')}</option>
                <option value="copy">{t('settings.copy')}</option>
              </select>
            </section>
          </div>
          <section className="settings-panel">
            <h2>
              <Filter size={20} />
              {t('filters.title')}
            </h2>
            <p className="muted">{t('filters.body')}</p>
            <div className="editor-grid">
              {[
                ['excludedDirectories', 'filters.directories'],
                ['excludedNames', 'filters.blacklist'],
                ['allowedNames', 'filters.whitelist'],
              ].map(([key, title]) => (
                <label key={key}>
                  {t(title)}
                  <textarea
                    value={draft.scanFilters[key].join(', ')}
                    onChange={(e) => filters({ [key]: list(e.target.value) })}
                  />
                </label>
              ))}
              <label>
                {t('filters.depth')}
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={draft.scanFilters.maxDepth}
                  onChange={(e) => filters({ maxDepth: Number(e.target.value) })}
                />
              </label>
            </div>
            <p className="muted">{t('filters.help')}</p>
          </section>
          <section className="settings-panel">
            <h2>
              <Sparkles size={20} />
              {t('smart.title')}
            </h2>
            <label className="toggle-setting">
              <span>
                <b>{t('smart.toggle')}</b>
                <small>{t('smart.body')}</small>
              </span>
              <input
                type="checkbox"
                checked={draft.smartTagging}
                onChange={(e) => setDraft({ ...draft, smartTagging: e.target.checked })}
              />
              <span className="switch" />
            </label>
            <p className="muted">{t('smart.note')}</p>
          </section>
          <div className="notice warning">
            <Info size={18} />
            {t('automation.warning')}
          </div>
          <div className="automation-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={async () => {
                setError('');
                try {
                  setPreview(await api.automationPreview(draft));
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              <Eye size={16} />
              {t('automation.preview')}
            </button>
            <button className="btn primary" type="submit">
              <Save size={16} />
              {t('automation.save')}
            </button>
          </div>
        </fieldset>
      </form>
      <section className="settings-panel">
        <div className="manager-heading">
          <h2>
            <Clock size={18} />
            {t('automation.lastRun')}
          </h2>
          <small className="muted">
            {runtime?.automation?.lastRun
              ? new Date(runtime.automation.lastRun).toLocaleString(locale)
              : t('automation.never')}
          </small>
        </div>
        <button
          className="btn secondary"
          disabled={
            !!busy || (!settings.automation.archiveEnabled && !settings.automation.downloadsEnabled)
          }
          onClick={onRun}
        >
          <Play size={15} />
          {t('automation.run')}
        </button>
        {runtime?.automation?.lastError && (
          <p role="alert" className="warning-text">
            {errorMessage(runtime.automation.lastError)}
          </p>
        )}
      </section>
      {preview && (
        <section className="settings-panel">
          <h2>{t('automation.previewTitle')}</h2>
          <div className="preview-totals">
            <span>{t('automation.archivedCount', { count: preview.archive.length })}</span>
            <span>{t('automation.downloadCount', { count: preview.downloads.length })}</span>
          </div>
          {![...preview.archive, ...preview.downloads].length && (
            <p className="muted">{t('automation.noCandidates')}</p>
          )}
          {[...preview.archive, ...preview.downloads].slice(0, 50).map((item) => (
            <div className="preview-entry" key={item.id}>
              <div>
                <b>{item.name}</b>
                <small>{item.source}</small>
              </div>
              <span>{formatBytes(item.size, locale)}</span>
            </div>
          ))}
        </section>
      )}
      {error && (
        <p role="alert" className="warning-text">
          {error}
        </p>
      )}
      <section className="settings-panel">
        <h2>
          <Clock size={18} />
          {t('usage.title')}
        </h2>
        <p className="muted">{t('usage.body')}</p>
        <p className="muted">{t('automation.undoNote')}</p>
      </section>
    </>
  );
}
