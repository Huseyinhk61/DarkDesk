import { Check, ChevronDown, ExternalLink, Folder, Users, Sparkles } from 'lucide-react';
import { useCallback, useState } from 'react';
import NativeItemIcon from './NativeItemIcon';
import ItemDetails from './ItemDetails';
import { usePreferences } from '../preferences';
import AppIcon from './AppIcon';
import { icons } from '../../shared/domain';
import { formatBytes, isShortcut } from '../utils';
import '../desktop-scan.css';
export default function ItemCard({
  item,
  selected,
  toggle,
  onCategory,
  onIcon,
  reveal,
  disabled,
  onAcceptSuggestion,
  classification,
}) {
  const { settings, t, label, locale, language } = usePreferences();
  const [showDetails, setShowDetails] = useState(false);
  const closeDetails = useCallback(() => setShowDetails(false), []);
  const category =
      settings.categories.find((c) => c.id === item.category) || settings.categories[0],
    icon = settings.itemIcons[item.id] || category.icon;
  return (
    <>
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
          <button
            className={`app-icon item-info-trigger ${category.color}`}
            onClick={() => setShowDetails(true)}
            aria-label={t('info.open', { name: item.name })}
          >
            <NativeItemIcon item={item} fallback={icon} size={40} />
          </button>
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
        <h3 title={item.name}>
          <button
            className="item-title-button"
            onClick={() => setShowDetails(true)}
            aria-label={t('info.open', { name: item.name })}
          >
            {item.name.replace(/\.(lnk|exe|url|desktop)$/i, '')}
          </button>
        </h3>
        {(item.shared || item.sourceScope === 'shared') && (
          <span className="shared-item-badge" title={t('scanSummary.sharedHint')}>
            <Users size={12} />
            {t('scanSummary.source.shared')}
          </span>
        )}
        {item.insight?.description?.[language] && (
          <div className="item-purpose">
            <span className={`purpose-badge ${item.insight.confidence === 'known' ? 'known' : ''}`}>
              {t(item.insight.confidence === 'known' ? 'purpose.known' : 'purpose.inferred')}
            </span>
            <p title={item.insight.description[language]}>{item.insight.description[language]}</p>
          </div>
        )}
        {classification && (
          <small
            className={`classification-reason ${classification.needsReview ? 'needs-review' : ''}`}
            title={t('groups.reason.' + classification.source, classification)}
          >
            <Sparkles size={12} />
            {t('groups.reason.' + classification.source, classification)}
          </small>
        )}
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
        <label className="item-icon-picker" title={t('info.fallbackIcon')}>
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
      {showDetails && <ItemDetails item={item} fallback={icon} onClose={closeDetails} />}
    </>
  );
}
