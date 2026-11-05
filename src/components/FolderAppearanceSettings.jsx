import { useEffect, useState } from 'react';
import { Check, FolderSync, FolderHeart } from 'lucide-react';
import { folderThemes } from '../../shared/folder-appearance';
import { usePreferences } from '../preferences';
import FolderPreview from './FolderPreview';
import { native } from '../service';

export default function FolderAppearanceSettings({ onSave, onApply, busy, platform }) {
  const { settings, t, categoryLabel, errorMessage } = usePreferences();
  const [result, setResult] = useState(null),
    [applying, setApplying] = useState(false);
  const appearanceVersion = JSON.stringify({
    theme: settings.folderTheme,
    categories: settings.categories.map(({ id, folder, parentId, icon, color, customColor }) => ({
      id,
      folder,
      parentId,
      icon,
      color,
      customColor,
    })),
  });
  useEffect(() => setResult(null), [appearanceVersion]);
  const supported = native && platform === 'win32';
  const apply = async () => {
    if (!supported || applying || busy) return;
    setApplying(true);
    try {
      setResult(await onApply());
    } finally {
      setApplying(false);
    }
  };
  return (
    <section className="folder-appearance-panel" aria-labelledby="folder-appearance-title">
      <h2 id="folder-appearance-title">
        <FolderHeart size={20} />
        {t('folders.title')}
      </h2>
      <p className="muted">{t('folders.body')}</p>
      <div className="folder-theme-options" role="group" aria-label={t('folders.theme')}>
        {folderThemes.map((theme) => (
          <button
            key={theme}
            type="button"
            className={`folder-theme-option ${settings.folderTheme === theme ? 'chosen' : ''}`}
            aria-label={t('folders.theme.' + theme)}
            aria-pressed={settings.folderTheme === theme}
            disabled={!!busy || applying}
            onClick={() => {
              setResult(null);
              onSave({ ...settings, folderTheme: theme });
            }}
          >
            <div className="folder-preview-row" aria-hidden="true">
              {['blue', 'purple', 'green'].map((color) => (
                <FolderPreview
                  key={color}
                  category={{ color, icon: 'folder' }}
                  theme={theme}
                  size={38}
                />
              ))}
            </div>
            <span>
              <b>{t('folders.theme.' + theme)}</b>
              {settings.folderTheme === theme && <Check size={15} />}
            </span>
            <small>{t('folders.themeDescription.' + theme)}</small>
          </button>
        ))}
      </div>
      <p className="muted">{t('folders.colorHint')}</p>
      <div className="folder-apply-row">
        <button
          className="btn secondary"
          type="button"
          disabled={!supported || !!busy || applying || !onApply}
          onClick={apply}
        >
          <FolderSync size={16} />
          {t(applying ? 'folders.applying' : 'folders.apply')}
        </button>
        <small className="muted">
          {t(supported ? 'folders.applyNote' : 'folders.platformNote')}
        </small>
      </div>
      {result && (
        <div className="folder-apply-result" role="status">
          <p>{t('folders.result', result)}</p>
          {result.refreshPending && <p className="muted">{t('folders.refreshPending')}</p>}
          {result.details?.some((entry) => ['skipped', 'failed'].includes(entry.status)) && (
            <details>
              <summary>{t('folders.resultDetails')}</summary>
              <ul>
                {result.details
                  .filter((entry) => ['skipped', 'failed'].includes(entry.status))
                  .map((entry) => (
                    <li key={entry.categoryId}>
                      {categoryLabel(entry.categoryId)} ·{' '}
                      {entry.code ? errorMessage(entry.code) : t('folders.skipped')}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
