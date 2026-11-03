import {
  ArrowRight,
  BookOpen,
  FolderSearch,
  FolderTree,
  ShieldCheck,
  Undo2,
  Keyboard,
  Monitor,
} from 'lucide-react';
import { usePreferences } from '../preferences';
import { native } from '../service';
import { displayAccelerator } from '../../shared/hotkeys';
import '../help.css';

export default function HelpPanel({ onNavigate, busy = false }) {
  const { settings, t, label } = usePreferences();
  const mac = /Mac/i.test(navigator.platform);
  const steps = [
    { id: 'scan', icon: FolderSearch, view: 'scan' },
    { id: 'review', icon: FolderTree, view: 'groups' },
    { id: 'confirm', icon: ShieldCheck, view: 'settings' },
    { id: 'undo', icon: Undo2, view: 'settings' },
  ];
  return (
    <section className="help-page" aria-labelledby="help-title">
      <div className="eyebrow">
        <BookOpen size={16} aria-hidden="true" />
        {t('help.eyebrow')}
      </div>
      <h1 id="help-title" className="settings-title">
        {t('help.title')}
      </h1>
      <p className="muted help-intro">{t('help.body')}</p>
      <ol className="help-steps">
        {steps.map(({ id, icon: Icon, view }, index) => (
          <li key={id}>
            <span className="help-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <Icon className="help-step-icon" size={24} aria-hidden="true" />
            <h2>{t(`help.${id}.title`)}</h2>
            <p>{t(`help.${id}.body`)}</p>
            <button className="btn secondary" disabled={busy} onClick={() => onNavigate(view)}>
              {t(`help.${id}.action`)}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <div className="help-sections">
        <section className="settings-panel" aria-labelledby="help-shortcuts">
          <h2 id="help-shortcuts">
            <Keyboard size={20} aria-hidden="true" />
            {t('help.shortcuts')}
          </h2>
          <p className="muted">{t(native ? 'help.shortcutsNative' : 'help.shortcutsDemo')}</p>
          <dl className="help-shortcuts">
            <div>
              <dt>{t('launcher.title')}</dt>
              <dd>
                <kbd>{displayAccelerator(settings.launcherShortcut, mac)}</kbd>
              </dd>
            </div>
            <div>
              <dt>{t('help.keyboardNavigation')}</dt>
              <dd>
                <kbd>Tab</kbd> / <kbd>Shift + Tab</kbd>
              </dd>
            </div>
            <div>
              <dt>{t('help.closeDialog')}</dt>
              <dd>
                <kbd>Escape</kbd>
              </dd>
            </div>
            {settings.profiles.map((profile) => (
              <div key={profile.id}>
                <dt>{label(profile)}</dt>
                <dd>
                  <kbd>{displayAccelerator(profile.shortcut, mac)}</kbd>
                </dd>
              </div>
            ))}
          </dl>
          <button className="btn secondary" disabled={busy} onClick={() => onNavigate('profiles')}>
            {t('help.editShortcuts')}
          </button>
        </section>
        <section className="settings-panel" aria-labelledby="help-desktop">
          <h2 id="help-desktop">
            <Monitor size={20} aria-hidden="true" />
            {t('help.desktop')}
          </h2>
          <h3>{t('help.trayTitle')}</h3>
          <p className="muted">{t(native ? 'help.trayBody' : 'help.demoBody')}</p>
          <h3>{t('help.personalizeTitle')}</h3>
          <p className="muted">{t('help.personalizeBody')}</p>
          <button className="btn secondary" disabled={busy} onClick={() => onNavigate('settings')}>
            {t('help.openAppearance')}
          </button>
          <h3>{t('help.localTitle')}</h3>
          <p className="muted">{t('help.localBody')}</p>
          <p className="muted">{t('help.launchHistory')}</p>
        </section>
      </div>
    </section>
  );
}
