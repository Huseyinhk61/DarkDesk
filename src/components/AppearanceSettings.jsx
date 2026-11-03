import { Check, Globe, Paintbrush, RotateCcw, Accessibility } from 'lucide-react';
import { themes, resolveTheme } from '../../shared/appearance';
import { usePreferences } from '../preferences';
import AppIcon from './AppIcon';
import '../appearance.css';
export default function AppearanceSettings({ onSave, busy }) {
  const { settings, t } = usePreferences();
  const update = (patch) => onSave({ ...settings, ...patch });
  return (
    <section className="settings-panel appearance-panel">
      <h2>
        <Paintbrush size={20} />
        {t('settings.appearance')}
      </h2>
      <p className="muted appearance-intro">{t('appearance.intro')}</p>
      <span className="field-label" id="theme-options-label">
        {t('settings.theme')}
      </span>
      <div className="theme-options" role="group" aria-labelledby="theme-options-label">
        {themes.map((theme) => {
          const preview = resolveTheme(theme.id, true);
          return (
            <button
              key={theme.id}
              type="button"
              disabled={!!busy}
              className={`theme-option ${settings.theme === theme.id ? 'chosen' : ''}`}
              aria-label={t('themes.' + theme.id)}
              aria-describedby={'theme-description-' + theme.id}
              aria-pressed={settings.theme === theme.id}
              onClick={() => update({ theme: theme.id })}
            >
              <span
                aria-hidden="true"
                className={`theme-swatch swatch-${theme.id}`}
                style={{
                  '--preview-bg': preview.tokens.bg,
                  '--preview-surface': preview.tokens.raised,
                  '--preview-accent': preview.tokens.accent,
                }}
              >
                <i />
                <i />
                <i />
              </span>
              <span className="theme-option-copy">
                <b>{t('themes.' + theme.id)}</b>
                <small id={'theme-description-' + theme.id}>
                  {t('appearance.theme.' + theme.id)}
                </small>
              </span>
              {settings.theme === theme.id && <Check aria-hidden="true" size={16} />}
            </button>
          );
        })}
      </div>
      <h2>
        <Accessibility size={20} />
        {t('appearance.accessibility')}
      </h2>
      <div className="appearance-fields accessibility-fields">
        <label>
          <span>{t('appearance.scale')}</span>
          <select
            aria-label={t('appearance.scale')}
            value={settings.uiScale}
            disabled={!!busy}
            onChange={(event) => update({ uiScale: Number(event.target.value) })}
          >
            {[100, 115, 130].map((scale) => (
              <option key={scale} value={scale}>
                {t('appearance.scale.' + scale)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('appearance.density')}</span>
          <select
            aria-label={t('appearance.density')}
            value={settings.density}
            disabled={!!busy}
            onChange={(event) => update({ density: event.target.value })}
          >
            <option value="comfortable">{t('appearance.comfortable')}</option>
            <option value="compact">{t('appearance.compact')}</option>
          </select>
        </label>
        <label>
          <span>{t('appearance.motion')}</span>
          <select
            aria-label={t('appearance.motion')}
            value={settings.motion}
            disabled={!!busy}
            onChange={(event) => update({ motion: event.target.value })}
          >
            <option value="system">{t('appearance.motionSystem')}</option>
            <option value="reduced">{t('appearance.motionReduced')}</option>
          </select>
        </label>
      </div>
      <p className="muted">{t('appearance.motionNote')}</p>
      <div className="appearance-fields">
        <label>
          <span>
            <Globe size={15} />
            {t('settings.language')}
          </span>
          <select
            aria-label={t('settings.language')}
            value={settings.language}
            disabled={!!busy}
            onChange={(event) => update({ language: event.target.value })}
          >
            <option value="tr">{t('languages.tr')}</option>
            <option value="en">{t('languages.en')}</option>
          </select>
        </label>
        <label>
          <span>{t('settings.iconPack')}</span>
          <select
            aria-label={t('settings.iconPack')}
            value={settings.iconPack}
            disabled={!!busy}
            onChange={(event) => update({ iconPack: event.target.value })}
          >
            {['lucide', 'tabler', 'minimal'].map((pack) => (
              <option key={pack} value={pack}>
                {t('packs.' + pack)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="icon-pack-preview">
        {['code', 'palette', 'gamepad', 'file', 'wrench', 'music'].map((icon) => (
          <AppIcon key={icon} name={icon} size={27} />
        ))}
      </div>
      <p className="muted">{t('settings.iconsNote')}</p>
      <button
        type="button"
        className="btn secondary appearance-reset"
        disabled={!!busy}
        onClick={() =>
          update({
            theme: 'midnight',
            iconPack: 'lucide',
            uiScale: 100,
            density: 'comfortable',
            motion: 'system',
          })
        }
      >
        <RotateCcw size={16} />
        {t('appearance.reset')}
      </button>
    </section>
  );
}
