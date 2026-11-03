import { useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Save, Keyboard, ShieldCheck } from 'lucide-react';
import { usePreferences } from '../preferences';
import { native } from '../service';
import AppIcon from './AppIcon';
import Modal from './Modal';
export default function Profiles({ runtime, onApply, onRestore, onSave, busy, compact = false }) {
  const { settings, t, label } = usePreferences();
  const [editor, setEditor] = useState(null);
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
        {settings.profiles.map((profile) => (
          <article
            key={profile.id}
            className={`profile-card ${status.activeId === profile.id ? 'active' : ''}`}
          >
            <button
              disabled={!!busy || runtime?.visibilitySupported === false}
              className="profile-activate"
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
              <kbd>{profile.shortcut.replace('CommandOrControl', 'Ctrl')}</kbd>
            </button>
            {!compact && (
              <button
                className="profile-edit"
                onClick={() =>
                  setEditor({
                    ...profile,
                    name: profile.labelKey ? t(profile.labelKey) : profile.name,
                  })
                }
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
                  shortcut: 'CommandOrControl+Alt+5',
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
          <section className="settings-panel">
            <h2>
              <Keyboard size={18} />
              {t('profiles.shortcuts')}
            </h2>
            {runtime?.shortcuts?.map((entry) => (
              <div className="shortcut-status" key={entry.accelerator}>
                <kbd>{entry.accelerator.replace('CommandOrControl', 'Ctrl')}</kbd>
                <span className={entry.registered ? 'success-text' : 'warning-text'}>
                  {t(entry.registered ? 'profiles.registered' : 'profiles.unavailable')}
                </span>
              </div>
            ))}
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
                <input
                  required
                  value={editor.shortcut}
                  onChange={(e) => setEditor({ ...editor, shortcut: e.target.value })}
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
