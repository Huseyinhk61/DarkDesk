import { useEffect, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Save, Keyboard, ShieldCheck } from 'lucide-react';
import { usePreferences } from '../preferences';
import { native } from '../service';
import AppIcon from './AppIcon';
import Modal from './Modal';
import KeyBinder from './KeyBinder';
import { displayAccelerator } from '../../shared/hotkeys';
export default function Profiles({ runtime, onApply, onRestore, onSave, busy, compact = false }) {
  const { settings, t, label } = usePreferences();
  const [editor, setEditor] = useState(null);
  const [launcherDraft, setLauncherDraft] = useState(settings.launcherShortcut);
  useEffect(() => setLauncherDraft(settings.launcherShortcut), [settings.launcherShortcut]);
  const [restoreDraft, setRestoreDraft] = useState(settings.restoreShortcut);
  useEffect(() => setRestoreDraft(settings.restoreShortcut), [settings.restoreShortcut]);
  const assignments = [
    { id: 'restore', accelerator: restoreDraft },
    { id: 'launcher', accelerator: launcherDraft },
    ...settings.profiles.map((p) => ({ id: 'profile:' + p.id, accelerator: p.shortcut })),
  ];
  const editProfile = (profile) =>
    setEditor({ ...profile, name: profile.labelKey ? t(profile.labelKey) : profile.name });
  const status = runtime?.profile || {};
  return (
    <section className={compact ? 'profiles-strip' : 'profiles-page'}>
      {!compact && (
        <>
          <div className="eyebrow">{t('nav.profiles')}</div>
          <h1 className="settings-title">{t('profiles.title')}</h1>
          <p className="muted">{t('profiles.body')}</p>
        </>
      )}
      <div className="profiles-heading">
        <div>
          <span className="online" />
          <b>{status.activeId ? t('profiles.active') : t('profiles.normal')}</b>
          {status.activeId && <small>{t('profiles.hidden', { count: status.hidden || 0 })}</small>}
        </div>
        <button className="text-btn" onClick={onRestore} disabled={!!busy || !status.activeId}>
          <Eye size={14} />
          {t('profiles.restore')}
        </button>
      </div>
      <div className="profile-cards">
        <article className={'profile-card default-profile ' + (!status.activeId ? 'active' : '')}>
          <button
            type="button"
            className="profile-activate"
            disabled={!!busy}
            aria-pressed={!status.activeId}
            onClick={onRestore}
          >
            <span className="profile-icon">
              <Eye size={21} />
            </span>
            <span>
              <b>{t('ux311.defaultMode')}</b>
              <small>{t('ux311.defaultBody')}</small>
            </span>
            <kbd>
              {displayAccelerator(settings.restoreShortcut, /Mac/i.test(navigator.platform))}
            </kbd>
          </button>
        </article>
        {settings.profiles.map((profile) => (
          <article
            key={profile.id}
            className={`profile-card ${status.activeId === profile.id ? 'active' : ''}`}
          >
            <button
              disabled={!!busy || runtime?.visibilitySupported === false}
              className="profile-activate"
              title={
                profile.categories.length
                  ? profile.categories
                      .map((id) => label(settings.categories.find((c) => c.id === id)))
                      .join(' · ')
                  : t('profiles.allHidden')
              }
              onClick={() => onApply(profile.id)}
              aria-pressed={status.activeId === profile.id}
            >
              <span className="profile-icon">
                <AppIcon name={profile.icon} />
              </span>
              <span>
                <b>{profile.labelKey ? t(profile.labelKey) : profile.name}</b>
                <small>
                  {profile.categories.length
                    ? profile.categories
                        .map((id) => label(settings.categories.find((c) => c.id === id)))
                        .join(' · ')
                    : t('profiles.allHidden')}
                </small>
              </span>
              <kbd>{displayAccelerator(profile.shortcut, /Mac/i.test(navigator.platform))}</kbd>
            </button>
            {!compact && (
              <button
                className="profile-edit"
                onClick={() => editProfile(profile)}
                aria-label={`${t('common.edit')} ${profile.name}`}
              >
                <Pencil size={13} />
              </button>
            )}
          </article>
        ))}
      </div>
      {!compact && (
        <>
          <div className="info-note">
            <ShieldCheck size={17} />
            {t('profiles.safety')}
          </div>
          {!native && <p className="notice">{t('profiles.demo')}</p>}
          {runtime?.visibilitySupported === false && (
            <p className="notice warning">{t('profiles.unsupported')}</p>
          )}
          <div className="profiles-bottom">
            <button
              className="btn secondary"
              disabled={!!busy}
              onClick={() =>
                setEditor({
                  id: crypto.randomUUID(),
                  name: '',
                  categories: [],
                  shortcut:
                    Array.from(
                      { length: 20 },
                      (_, i) => 'CommandOrControl+Alt+' + (i < 5 ? i + 5 : 'F' + (i - 4)),
                    ).find((key) => !assignments.some((entry) => entry.accelerator === key)) ||
                    'CommandOrControl+Shift+Alt+9',
                  icon: 'folder',
                  isNew: true,
                })
              }
            >
              <Plus size={16} />
              {t('profiles.new')}
            </button>
            <div>
              <Keyboard size={16} />
              {settings.launcherShortcut}
            </div>
          </div>
          <section className="settings-panel profiles-shortcuts-panel">
            <h2>
              <Keyboard size={18} />
              {t('profiles.shortcuts')}
            </h2>
            <p className="muted shortcut-help">
              {t(native ? 'shortcuts.globalHelp' : 'shortcuts.demoHelp')}
            </p>
            <div className="profile-shortcut-editor">
              <label className="field-label" htmlFor="profile-launcher-shortcut">
                {t('launcher.shortcut')}
              </label>
              <KeyBinder
                id="profile-launcher-shortcut"
                label={t('launcher.shortcut')}
                value={launcherDraft}
                currentId="launcher"
                assignments={assignments}
                disabled={!!busy}
                onChange={setLauncherDraft}
              />
              <label className="field-label" htmlFor="profile-restore-shortcut">
                {t('ux311.defaultMode')}
              </label>
              <KeyBinder
                id="profile-restore-shortcut"
                label={t('ux311.defaultMode')}
                value={restoreDraft}
                currentId="restore"
                assignments={assignments}
                disabled={!!busy}
                onChange={setRestoreDraft}
              />
              <button
                type="button"
                className="btn secondary"
                disabled={
                  !!busy ||
                  (launcherDraft === settings.launcherShortcut &&
                    restoreDraft === settings.restoreShortcut)
                }
                onClick={() =>
                  onSave({
                    ...settings,
                    launcherShortcut: launcherDraft,
                    restoreShortcut: restoreDraft,
                  })
                }
              >
                <Save size={15} />
                {t('common.save')}
              </button>
            </div>
            {runtime?.shortcuts?.map((entry) => {
              const profile = settings.profiles.find(
                (p) => entry.id === 'profile:' + p.id || entry.accelerator === p.shortcut,
              );
              return (
                <div className="shortcut-status" key={entry.id || entry.accelerator}>
                  <span className="shortcut-name">
                    {profile
                      ? profile.labelKey
                        ? t(profile.labelKey)
                        : profile.name
                      : t(entry.id === 'restore' ? 'ux311.defaultMode' : 'launcher.title')}
                  </span>
                  <kbd>
                    {displayAccelerator(entry.accelerator, /Mac/i.test(navigator.platform))}
                  </kbd>
                  <span className={entry.registered ? 'success-text' : 'warning-text'}>
                    {t(
                      !native
                        ? 'shortcuts.demo'
                        : entry.registered
                          ? 'profiles.registered'
                          : entry.reason === 'recording'
                            ? 'shortcuts.paused'
                            : 'shortcuts.occupied',
                    )}
                  </span>
                  {profile && (
                    <button
                      type="button"
                      className="shortcut-reassign"
                      onClick={() => editProfile(profile)}
                      disabled={!!busy}
                    >
                      {t('shortcuts.reassign')}
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
      {editor && (
        <Modal
          title={t(editor.isNew ? 'profiles.new' : 'profiles.edit')}
          onClose={() => setEditor(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const value = { ...editor, labelKey: undefined, isNew: undefined };
              const profiles = editor.isNew
                ? [...settings.profiles, value]
                : settings.profiles.map((p) => (p.id === value.id ? value : p));
              if (await onSave({ ...settings, profiles })) setEditor(null);
            }}
          >
            <div className="editor-grid">
              <label>
                {t('profiles.name')}
                <input
                  required
                  maxLength={100}
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                />
              </label>
              <label>
                {t('profiles.shortcut')}
                <KeyBinder
                  id="profile-shortcut"
                  label={t('profiles.shortcut')}
                  value={editor.shortcut}
                  currentId={'profile:' + editor.id}
                  assignments={assignments}
                  disabled={!!busy}
                  onChange={(shortcut) => setEditor({ ...editor, shortcut })}
                />
              </label>
            </div>
            <label className="field-label">
              {t('profiles.visibleNames')}
              <input
                className="settings-input"
                value={(editor.visibleNames || []).join(', ')}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    visibleNames: e.target.value
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label className="field-label">{t('profiles.categories')}</label>
            <div className="profile-category-options">
              {settings.categories.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={editor.categories.includes(c.id)}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        categories: e.target.checked
                          ? [...editor.categories, c.id]
                          : editor.categories.filter((id) => id !== c.id),
                      })
                    }
                  />
                  {c.parentId ? '↳ ' : ''}
                  {label(c)}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              {!editor.isNew && settings.profiles.length > 1 && (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={!!busy}
                  onClick={async () => {
                    if (
                      await onSave({
                        ...settings,
                        profiles: settings.profiles.filter((p) => p.id !== editor.id),
                      })
                    )
                      setEditor(null);
                  }}
                >
                  {t('profiles.remove')}
                </button>
              )}
              <button className="btn primary" disabled={!!busy}>
                <Save size={15} />
                {t('profiles.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
