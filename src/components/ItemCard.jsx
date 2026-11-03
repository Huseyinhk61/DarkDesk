import { Check, ChevronDown, ExternalLink, Folder, Link2 } from 'lucide-react';
import { usePreferences } from '../preferences';
import AppIcon from './AppIcon';
import { icons } from '../../shared/domain';
import { formatBytes, isShortcut } from '../utils';
export default function ItemCard({
  item,
  selected,
  toggle,
  onCategory,
  onIcon,
  reveal,
  disabled,
  onAcceptSuggestion,
}) {
  const { settings, t, label, locale } = usePreferences();
  const category =
      settings.categories.find((c) => c.id === item.category) || settings.categories[0],
    icon = settings.itemIcons[item.id] || category.icon;
  return (
    <article
      className={`item-card ${selected ? 'checked' : ''}`}
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-darkdesk-item', item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      title={t('drag.hint')}
    >
      <div className="item-top">
        <div className={`app-icon ${category.color}`}>
          <AppIcon name={icon} size={25} />
        </div>
        <button
          disabled={disabled}
          className={`checkbox ${selected ? 'on' : ''}`}
          onClick={toggle}
          aria-label={t('panel.selectItem', { name: item.name })}
          aria-pressed={selected}
        >
          {selected && <Check size={12} />}
        </button>
      </div>
      <h3 title={item.name}>{item.name.replace(/\.(lnk|exe|url|desktop)$/i, '')}</h3>
      <p className="file-path" title={item.target || item.source}>
        {item.target || item.source}
      </p>
      <div className="item-metadata">
        <span>
          {t(
            item.kind === 'installed'
              ? 'common.installed'
              : isShortcut(item)
                ? 'common.shortcut'
                : 'common.file',
          )}
        </span>
        <span>{formatBytes(item.size, locale)}</span>
      </div>
      {item.suggestion && (
        <div className="smart-suggestion">
          <span>
            {t('smart.suggestion', {
              name: label(settings.categories.find((c) => c.id === item.suggestion.categoryId)),
            })}
          </span>
          <small title={t('smart.note')}>
            {t('smart.similarity', { score: Math.round(item.suggestion.score * 100) + '%' })}
          </small>
          <button
            disabled={disabled}
            onClick={() => onAcceptSuggestion(item.suggestion.categoryId)}
          >
            {t('smart.accept')}
          </button>
        </div>
      )}
      {item.usage?.inactive && settings.categories.some((c) => c.id === 'archive') && (
        <div className="inactivity-note">
          <span>{t('usage.inactive')}</span>
          <button disabled={disabled} onClick={() => onCategory('archive')}>
            {t('usage.archive')}
          </button>
        </div>
      )}
      <div className="destination">
        <Folder size={13} />
        <span>{t('panel.destination')}</span>
        <button
          disabled={disabled}
          onClick={reveal}
          aria-label={t('panel.reveal', { name: item.name })}
        >
          <ExternalLink size={12} />
        </button>
      </div>
      <div className={`select-wrap ${category.color}`}>
        <span className="color-dot" />
        <select
          disabled={disabled}
          value={item.category}
          onChange={(e) => onCategory(e.target.value)}
          aria-label={t('panel.categoryFor', { name: item.name })}
        >
          {settings.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentId ? '↳ ' : ''}
              {label(c)}
            </option>
          ))}
        </select>
        <ChevronDown size={13} />
      </div>
      <label className="item-icon-picker">
        <AppIcon name={icon} size={12} />
        <select
          value={icon}
          disabled={disabled}
          onChange={(e) => onIcon(e.target.value)}
          aria-label={t('panel.iconFor', { name: item.name })}
        >
          {icons.map((name) => (
            <option value={name} key={name}>
              {t('icons.' + name)}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}
