import { useState } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, FolderTree, Workflow } from 'lucide-react';
import { usePreferences } from '../preferences';
import { icons, colors, categorySegments } from '../../shared/domain';
import AppIcon from './AppIcon';
import Modal from './Modal';
export default function CategoryManager({ onSave, busy }) {
  const { settings, t, label } = usePreferences();
  const [editor, setEditor] = useState(null),
    [deleting, setDeleting] = useState(null),
    [rule, setRule] = useState({
      match: 'contains',
      pattern: '',
      categoryId: settings.categories[0].id,
      enabled: true,
    });
  const descendants = (id) => {
    const result = new Set([id]);
    let previous;
    do {
      previous = result.size;
      settings.categories.forEach((c) => {
        if (result.has(c.parentId)) result.add(c.id);
      });
    } while (previous !== result.size);
    return result;
  };
  const saveCategory = async (e) => {
    e.preventDefault();
    const categories = editor.isNew
      ? [...settings.categories, { ...editor, isNew: undefined }]
      : settings.categories.map((c) =>
          c.id === editor.id ? { ...editor, labelKey: undefined } : c,
        );
    if (await onSave({ ...settings, categories })) setEditor(null);
  };
  const remove = async () => {
    const excluded = descendants(deleting.id);
    const categories = settings.categories.filter((c) => !excluded.has(c.id));
    if (!categories.length) return;
    const rules = settings.rules.filter((r) => !excluded.has(r.categoryId));
    if (await onSave({ ...settings, categories, rules })) setDeleting(null);
  };
  const saveRule = async (e) => {
    e.preventDefault();
    const next = { ...rule, id: rule.id || crypto.randomUUID() };
    const rules = rule.id
      ? settings.rules.map((r) => (r.id === rule.id ? next : r))
      : [...settings.rules, next];
    if (await onSave({ ...settings, rules }))
      setRule({
        match: 'contains',
        pattern: '',
        categoryId: settings.categories[0].id,
        enabled: true,
      });
  };
  const reorder = (index, offset) => {
    const rules = [...settings.rules];
    [rules[index], rules[index + offset]] = [rules[index + offset], rules[index]];
    onSave({ ...settings, rules });
  };
  return (
    <>
      <div className="eyebrow">{t('nav.categories')}</div>
      <h1 className="settings-title">{t('manager.title')}</h1>
      <p className="muted">{t('manager.body')}</p>
      <section className="settings-panel">
        <div className="manager-heading">
          <h2>
            <FolderTree size={20} />
            {t('manager.groups')}
            <span className="count-badge">{settings.categories.length}</span>
          </h2>
          <button
            className="btn primary"
            disabled={!!busy}
            onClick={() =>
              setEditor({
                id: crypto.randomUUID(),
                name: '',
                folder: '',
                parentId: null,
                icon: 'folder',
                color: 'purple',
                isNew: true,
              })
            }
          >
            <Plus size={16} />
            {t('manager.new')}
          </button>
        </div>
        <div className="managed-groups">
          {settings.categories.map((c) => (
            <div className="managed-group" key={c.id}>
              <span className={`category-icon ${c.color}`}>
                <AppIcon name={c.icon} />
              </span>
              <div>
                <b>{label(c)}</b>
                <small>{categorySegments(c.id, settings.categories).join(' / ')}</small>
              </div>
              <button
                disabled={!!busy}
                className="tool-btn"
                onClick={() => setEditor({ ...c, name: label(c) })}
                aria-label={`${t('common.edit')} ${label(c)}`}
              >
                <Pencil size={14} />
              </button>
              <button
                disabled={!!busy || descendants(c.id).size === settings.categories.length}
                className="tool-btn"
                aria-label={`${t('common.delete')} ${label(c)}`}
                onClick={() => setDeleting(c)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="settings-panel">
        <h2>
          <Workflow size={20} />
          {t('manager.rules')}
        </h2>
        <p className="muted">{t('manager.ruleBody')}</p>
        <form className="rule-form" onSubmit={saveRule}>
          <select
            aria-label={t('manager.contains')}
            value={rule.match}
            onChange={(e) => setRule({ ...rule, match: e.target.value })}
          >
            <option value="contains">{t('manager.contains')}</option>
            <option value="extension">{t('manager.extension')}</option>
          </select>
          <input
            required
            maxLength={120}
            aria-label={t('manager.pattern')}
            placeholder={t('manager.pattern')}
            value={rule.pattern}
            onChange={(e) => setRule({ ...rule, pattern: e.target.value })}
          />
          <select
            aria-label={t('manager.ruleCategory')}
            value={rule.categoryId}
            onChange={(e) => setRule({ ...rule, categoryId: e.target.value })}
          >
            {settings.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c)}
              </option>
            ))}
          </select>
          <button disabled={!!busy} className="btn primary" type="submit">
            <Plus size={15} />
            {t(rule.id ? 'common.save' : 'manager.ruleAdd')}
          </button>
          {rule.id && (
            <button
              className="btn secondary"
              type="button"
              onClick={() =>
                setRule({
                  match: 'contains',
                  pattern: '',
                  categoryId: settings.categories[0].id,
                  enabled: true,
                })
              }
            >
              {t('common.cancel')}
            </button>
          )}
        </form>
        <div className="rules-list">
          {!settings.rules.length && <p className="muted">{t('manager.ruleEmpty')}</p>}
          {settings.rules.map((r, index) => (
            <div className="rule-row" key={r.id}>
              <input
                type="checkbox"
                checked={r.enabled}
                disabled={!!busy}
                aria-label={`${t('manager.ruleEnabled')} ${r.pattern}`}
                onChange={(e) =>
                  onSave({
                    ...settings,
                    rules: settings.rules.map((x) =>
                      x.id === r.id ? { ...x, enabled: e.target.checked } : x,
                    ),
                  })
                }
              />
              <span>
                <b>{r.pattern}</b>
                <small>
                  {t(r.match === 'contains' ? 'manager.contains' : 'manager.extension')} →{' '}
                  {label(settings.categories.find((c) => c.id === r.categoryId))}
                </small>
              </span>
              <button
                className="tool-btn"
                disabled={!!busy || index === 0}
                aria-label={t('manager.up')}
                onClick={() => reorder(index, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="tool-btn"
                disabled={!!busy || index === settings.rules.length - 1}
                aria-label={t('manager.down')}
                onClick={() => reorder(index, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                className="tool-btn"
                disabled={!!busy}
                aria-label={`${t('common.edit')} ${r.pattern}`}
                onClick={() => setRule({ ...r })}
              >
                <Pencil size={14} />
              </button>
              <button
                className="tool-btn"
                disabled={!!busy}
                aria-label={`${t('common.delete')} ${r.pattern}`}
                onClick={() =>
                  onSave({ ...settings, rules: settings.rules.filter((x) => x.id !== r.id) })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
      {editor && (
        <Modal
          title={t(editor.isNew ? 'manager.new' : 'manager.edit')}
          onClose={() => setEditor(null)}
        >
          <form onSubmit={saveCategory}>
            <div className="editor-grid">
              <label>
                {t('common.name')}
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={editor.name}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      name: e.target.value,
                      ...(editor.isNew ? { folder: e.target.value } : {}),
                    })
                  }
                />
              </label>
              <label>
                {t('common.folder')}
                <input
                  required
                  maxLength={120}
                  value={editor.folder}
                  onChange={(e) => setEditor({ ...editor, folder: e.target.value })}
                />
              </label>
              <label>
                {t('common.parent')}
                <select
                  aria-label={t('common.parent')}
                  value={editor.parentId || ''}
                  onChange={(e) => setEditor({ ...editor, parentId: e.target.value || null })}
                >
                  <option value="">{t('common.none')}</option>
                  {settings.categories
                    .filter((c) => !descendants(editor.id).has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {label(c)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                {t('common.color')}
                <select
                  aria-label={t('common.color')}
                  value={editor.color}
                  onChange={(e) => setEditor({ ...editor, color: e.target.value })}
                >
                  {colors.map((c) => (
                    <option key={c} value={c}>
                      {t('colors.' + c)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field-label">{t('common.icon')}</label>
            <div className="icon-options">
              {icons.map((icon) => (
                <button
                  type="button"
                  key={icon}
                  className={editor.icon === icon ? 'chosen' : ''}
                  onClick={() => setEditor({ ...editor, icon })}
                  aria-label={t('icons.' + icon)}
                  aria-pressed={editor.icon === icon}
                >
                  <AppIcon name={icon} />
                </button>
              ))}
            </div>
            <p className="muted">{t('manager.folderNote')}</p>
            <div className="modal-actions">
              <button className="btn secondary" type="button" onClick={() => setEditor(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn primary" disabled={!!busy}>
                {t('manager.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title={t('manager.delete')} onClose={() => setDeleting(null)}>
          <p>{label(deleting)}</p>
          <p>{t('manager.deleteNote')}</p>
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </button>
            <button className="btn primary" disabled={!!busy} onClick={remove}>
              {t('manager.confirmDelete')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
