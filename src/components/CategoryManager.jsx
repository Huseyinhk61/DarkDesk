import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  FolderTree,
  Workflow,
  Search,
  FolderPlus,
  FolderSync,
} from 'lucide-react';
import { usePreferences } from '../preferences';
import { icons, colors, categorySegments, normalize, matchesRule } from '../../shared/domain';
import AppIcon from './AppIcon';
import Modal from './Modal';
import FolderPreview from './FolderPreview';
import FolderAppearanceSettings from './FolderAppearanceSettings';
import {
  folderColors,
  folderPalette,
  folderAccentStyle,
  resolveFolderTheme,
  folderThemes,
} from '../../shared/folder-appearance';
import '../custom-folder-colors.css';
const hexColor = /^#[a-f\d]{6}$/i;
const gradientPresets = [
  { id: 'aurora', from: '#6366f1', to: '#d946ef' },
  { id: 'ocean', from: '#06b6d4', to: '#2563eb' },
  { id: 'sunset', from: '#f59e0b', to: '#e11d48' },
  { id: 'forest', from: '#84cc16', to: '#047857' },
  { id: 'rose', from: '#fb7185', to: '#a21caf' },
  { id: 'graphite', from: '#94a3b8', to: '#334155' },
];
export default function CategoryManager({
  onSave,
  busy,
  items = [],
  onApplyFolders,
  platform,
  onPrepareFolder,
  requestedCategory,
  onCategoryOpened,
  lastFolderResult,
}) {
  const { settings, t, label } = usePreferences();
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null),
    [colorDraft, setColorDraft] = useState(null),
    [deleting, setDeleting] = useState(null),
    [rule, setRule] = useState({
      match: 'contains',
      pattern: '',
      categoryId: settings.categories[0].id,
      enabled: true,
    });
  const openEditor = (category) => {
    setEditor(category);
    setColorDraft(category.customColor ? { ...category.customColor } : null);
  };
  useEffect(() => {
    if (requestedCategory) {
      const category = settings.categories.find((value) => value.id === requestedCategory);
      if (category) openEditor({ ...category, name: label(category) });
      onCategoryOpened?.();
    }
  }, [requestedCategory]);
  const customValid =
    !colorDraft || (hexColor.test(colorDraft.from) && hexColor.test(colorDraft.to));
  const chooseCustom = (color) => {
    setColorDraft(color);
    if (hexColor.test(color.from) && hexColor.test(color.to))
      setEditor((previous) => ({ ...previous, customColor: color }));
  };
  const updateCustom = (field, value) => {
    const palette = folderPalette(editor);
    chooseCustom({ ...(colorDraft || { from: palette.fill, to: palette.shade }), [field]: value });
  };
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
  const ordered = useMemo(() => {
    const rows = [];
    const walk = (parent, depth) =>
      settings.categories
        .filter((category) => category.parentId === parent)
        .forEach((category) => {
          rows.push({ ...category, depth });
          if (depth < 15) walk(category.id, depth + 1);
        });
    walk(null, 0);
    const search = normalize(query.trim());
    return rows.filter(
      (category) =>
        !search ||
        normalize(
          label(category) + ' ' + categorySegments(category.id, settings.categories).join(' / '),
        ).includes(search),
    );
  }, [settings.categories, query, label]);
  const rulePreview = useMemo(() => {
    if (!rule.pattern.trim()) return null;
    try {
      return { matches: items.filter((item) => matchesRule(rule, item)) };
    } catch {
      return { invalid: true };
    }
  }, [items, rule.pattern, rule.match]);
  const saveCategory = async (e) => {
    e.preventDefault();
    if (!customValid) return;
    const original = settings.categories.find((category) => category.id === editor.id);
    const next = {
      ...editor,
      isNew: undefined,
      depth: undefined,
      labelKey:
        original?.labelKey && editor.name === label(original) ? original.labelKey : undefined,
    };
    const categories = editor.isNew
      ? [...settings.categories, next]
      : settings.categories.map((c) => (c.id === editor.id ? next : c));
    if (await onSave({ ...settings, categories }, { applyFolders: true })) setEditor(null);
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
        <p className="muted">{t('folderMore.prepareHint')}</p>
        <FolderAppearanceSettings
          onSave={onSave}
          onApply={onApplyFolders}
          busy={busy}
          platform={platform}
          externalResult={lastFolderResult}
        />
      </section>
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
              openEditor({
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
        <div className="manager-toolbar">
          <label className="manager-search">
            <Search size={16} />
            <input
              type="search"
              aria-label={t('manager.search')}
              placeholder={t('manager.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <span className="muted">
            {ordered.length} / {settings.categories.length}
          </span>
        </div>
        {!ordered.length && (
          <p className="muted" role="status">
            {t('manager.noResults')}
          </p>
        )}
        <div className="managed-groups">
          {ordered.map((c) => (
            <div
              className="managed-group"
              key={c.id}
              style={{ '--group-depth': c.depth, ...folderAccentStyle(c) }}
            >
              <span
                className={`category-icon ${c.color} ${c.customColor ? 'custom-folder-color' : ''}`}
                style={folderAccentStyle(c)}
              >
                <FolderPreview category={c} size={42} />
              </span>
              <div>
                <b>{label(c)}</b>
                <small>{categorySegments(c.id, settings.categories).join(' / ')}</small>
              </div>
              <button
                type="button"
                className="tool-btn"
                disabled={!!busy || platform !== 'win32' || !onPrepareFolder}
                aria-label={t('folderMore.prepareFor', { name: label(c) })}
                title={t('folderMore.prepare')}
                onClick={() => onPrepareFolder(c.id)}
              >
                <FolderSync size={15} />
              </button>
              <button
                type="button"
                disabled={!!busy || c.depth >= 15}
                className="tool-btn"
                aria-label={t('manager.newChild', { name: label(c) })}
                onClick={() =>
                  openEditor({
                    id: crypto.randomUUID(),
                    name: '',
                    folder: '',
                    parentId: c.id,
                    icon: 'folder',
                    color: c.color,
                    customColor: c.customColor ? { ...c.customColor } : undefined,
                    isNew: true,
                  })
                }
              >
                <FolderPlus size={15} />
              </button>
              <button
                disabled={!!busy}
                className="tool-btn"
                onClick={() => openEditor({ ...c, name: label(c) })}
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
            <option value="regex">{t('manager.regex')}</option>
          </select>
          <input
            required
            maxLength={256}
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
        <p className="muted">{t('manager.regexHelp')}</p>
        {rulePreview && (
          <div className="rule-preview" role="status">
            {rulePreview.invalid ? (
              t('manager.previewInvalid')
            ) : (
              <>
                <b>{t('manager.previewMatches', { count: rulePreview.matches.length })}</b>
                <small>{t('manager.previewNote')}</small>
                {!!rulePreview.matches.length && (
                  <ul>
                    {rulePreview.matches.slice(0, 4).map((item) => (
                      <li key={item.id}>{item.name}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
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
                  {t(
                    r.match === 'regex'
                      ? 'manager.regex'
                      : r.match === 'contains'
                        ? 'manager.contains'
                        : 'manager.extension',
                  )}{' '}
                  → {label(settings.categories.find((c) => c.id === r.categoryId))}
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
            <div
              className={`category-editor-preview ${editor.customColor ? 'custom-folder-color' : ''}`}
              style={folderAccentStyle(editor)}
              aria-label={t('manager.preview')}
            >
              <FolderPreview category={editor} size={84} />
              <div>
                <b>{editor.name || t('manager.new')}</b>
                <small>
                  {t('folders.theme.' + resolveFolderTheme(editor, settings.folderTheme))} ·{' '}
                  {editor.customColor ? t('customFolder.custom') : t('colors.' + editor.color)}
                </small>
              </div>
            </div>
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
            </div>
            <label className="category-style-field">
              {t('folders.categoryStyle')}
              <select
                aria-label={t('folders.categoryStyle')}
                value={editor.folderTheme || ''}
                disabled={!!busy}
                onChange={(event) =>
                  setEditor({ ...editor, folderTheme: event.target.value || undefined })
                }
              >
                <option value="">
                  {t('folders.inheritStyle', { style: t('folders.theme.' + settings.folderTheme) })}
                </option>
                {folderThemes.map((theme) => (
                  <option key={theme} value={theme}>
                    {t('folders.theme.' + theme)}
                  </option>
                ))}
              </select>
            </label>
            <label className="category-style-field">
              {t('folderMore.glyphSize')}
              <select
                aria-label={t('folderMore.glyphSize')}
                disabled={!!busy}
                value={editor.folderGlyphSize || 'normal'}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    folderGlyphSize: e.target.value === 'normal' ? undefined : e.target.value,
                  })
                }
              >
                {['small', 'normal', 'large'].map((size) => (
                  <option key={size} value={size}>
                    {t('folderMore.glyph.' + size)}
                  </option>
                ))}
              </select>
            </label>
            <span className="field-label" id="folder-color-options-label">
              {t('common.color')}
            </span>
            <div
              className="folder-color-options"
              role="group"
              aria-labelledby="folder-color-options-label"
            >
              {colors.map((color) => (
                <button
                  className={`folder-color-option ${color}`}
                  type="button"
                  key={color}
                  disabled={!!busy}
                  style={{ '--swatch': folderColors[color].fill }}
                  aria-label={t('colors.' + color)}
                  aria-pressed={!editor.customColor && editor.color === color}
                  onClick={() => {
                    setColorDraft(null);
                    setEditor({ ...editor, color, customColor: undefined });
                  }}
                >
                  {t('colors.' + color)}
                </button>
              ))}
            </div>
            <section className="custom-folder-editor" aria-labelledby="custom-folder-title">
              <div className="custom-folder-heading">
                <h3 id="custom-folder-title">{t('customFolder.title')}</h3>
                {(editor.customColor || colorDraft) && (
                  <button
                    className="text-btn"
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      setColorDraft(null);
                      setEditor({ ...editor, customColor: undefined });
                    }}
                  >
                    {t('customFolder.reset')}
                  </button>
                )}
              </div>
              <p className="muted">{t('customFolder.body')}</p>
              <div className="custom-color-fields">
                {['from', 'to'].map((field) => {
                  const palette = folderPalette(editor);
                  const value =
                    colorDraft?.[field] ?? (field === 'from' ? palette.fill : palette.shade);
                  const valid = hexColor.test(value);
                  return (
                    <div className="custom-color-field" key={field}>
                      <label htmlFor={'custom-folder-' + field}>{t('customFolder.' + field)}</label>
                      <div className="custom-color-inputs">
                        <input
                          type="color"
                          aria-label={t('customFolder.picker.' + field)}
                          value={valid ? value : field === 'from' ? palette.fill : palette.shade}
                          onChange={(event) => updateCustom(field, event.target.value)}
                          disabled={!!busy}
                        />
                        <input
                          id={'custom-folder-' + field}
                          type="text"
                          inputMode="text"
                          spellCheck={false}
                          autoComplete="off"
                          maxLength={7}
                          value={value}
                          placeholder="#6366f1"
                          aria-invalid={!valid}
                          aria-describedby={!valid ? 'custom-folder-error' : undefined}
                          onChange={(event) => updateCustom(field, event.target.value)}
                          disabled={!!busy}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {!customValid && (
                <p className="custom-color-error" id="custom-folder-error" role="alert">
                  {t('customFolder.invalid')}
                </p>
              )}
              <div
                className="custom-gradient-presets"
                role="group"
                aria-label={t('customFolder.presets')}
              >
                {gradientPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="custom-gradient-preset"
                    style={{ '--preset-from': preset.from, '--preset-to': preset.to }}
                    aria-label={t('customFolder.preset.' + preset.id)}
                    aria-pressed={
                      editor.customColor?.from === preset.from &&
                      editor.customColor?.to === preset.to
                    }
                    disabled={!!busy}
                    onClick={() => chooseCustom({ from: preset.from, to: preset.to })}
                  >
                    <span aria-hidden="true" />
                    <small>{t('customFolder.preset.' + preset.id)}</small>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="text-btn"
                disabled={!!busy || !customValid}
                onClick={() => {
                  const color = colorDraft?.from || folderPalette(editor).fill;
                  chooseCustom({ from: color, to: color });
                }}
              >
                {t('customFolder.solid')}
              </button>
              <small className="muted">{t('customFolder.applyNote')}</small>
            </section>
            <label className="field-label">{t('common.icon')}</label>
            <div className="icon-options">
              {icons.map((icon) => (
                <button
                  type="button"
                  key={icon}
                  disabled={!!busy}
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
              <button className="btn primary" disabled={!!busy || !customValid}>
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
