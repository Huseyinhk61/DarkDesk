import { ArrowUpRight, ChevronLeft, ChevronRight, Layers3 } from 'lucide-react';
import AppIcon from './AppIcon';
import FolderPreview from './FolderPreview';
import { usePreferences } from '../preferences';
import { categoryTrail, summarizeGroups, sanitizeGroupView } from '../../shared/grouping';
import { useEffect, useMemo, useRef, useState } from 'react';
import { folderAccentStyle } from '../../shared/folder-appearance';
import '../custom-folder-colors.css';

function savedView() {
  try {
    return sanitizeGroupView(JSON.parse(localStorage.getItem('darkdesk-group-view') || '{}'));
  } catch {
    return sanitizeGroupView(null);
  }
}
export default function CategoryGrid({
  items,
  filter,
  setFilter,
  onDropItem,
  disabled,
  onCustomize,
}) {
  const [hover, setHover] = useState(null);
  const [view, setView] = useState(savedView);
  const [edges, setEdges] = useState({ previous: false, next: false, overflow: false });
  const grid = useRef(null);
  const { settings, t, label, locale } = usePreferences();
  const summary = useMemo(
    () => summarizeGroups(items, settings.categories),
    [items, settings.categories],
  );
  const trail = useMemo(
    () => categoryTrail(filter, settings.categories),
    [filter, settings.categories],
  );
  const activeRoot = trail[0];
  const current = trail.at(-1);
  const compare = (a, b) =>
    view.sort === 'count'
      ? summary.get(b.id).total - summary.get(a.id).total
      : view.sort === 'name'
        ? label(a).localeCompare(label(b), locale)
        : 0;
  const roots = settings.categories
    .filter((category) => !category.parentId)
    .filter(
      (category) =>
        view.showEmpty || summary.get(category.id).total > 0 || category.id === activeRoot?.id,
    )
    .sort(compare);
  const directChildren = current
    ? settings.categories.filter((category) => category.parentId === current.id)
    : [];
  const children = (
    directChildren.length || !current?.parentId
      ? directChildren
      : settings.categories.filter((category) => category.parentId === current.parentId)
  )
    .filter(
      (category) => view.showEmpty || summary.get(category.id).total > 0 || category.id === filter,
    )
    .sort(compare);
  useEffect(() => {
    try {
      localStorage.setItem('darkdesk-group-view', JSON.stringify(view));
    } catch {}
  }, [view]);
  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    const update = () => {
      const next = {
        previous: element.scrollLeft > 3,
        next: element.scrollLeft + element.clientWidth < element.scrollWidth - 3,
        overflow: element.scrollWidth > element.clientWidth + 3,
      };
      setEdges((previous) =>
        Object.keys(next).every((key) => previous[key] === next[key]) ? previous : next,
      );
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [roots.length, view.sort, view.showEmpty, items, settings.language]);
  const behavior = () =>
    document.documentElement.dataset.motion === 'reduced' ? 'instant' : 'smooth';
  const scroll = (direction) =>
    grid.current?.scrollBy({
      left: direction * grid.current.clientWidth * 0.7,
      behavior: behavior(),
    });
  const keyboard = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...grid.current.querySelectorAll('button.category')];
    const index = buttons.indexOf(event.target.closest('button.category'));
    if (index < 0) return;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : Math.max(
              0,
              Math.min(buttons.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)),
            );
    event.preventDefault();
    buttons[next]?.focus();
    buttons[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: behavior() });
  };
  const dropProps = (id) => ({
    onDragOver: (event) => {
      if (!disabled) {
        event.preventDefault();
        setHover(id);
      }
    },
    onDragLeave: () => setHover(null),
    onDrop: (event) => {
      event.preventDefault();
      setHover(null);
      if (!disabled)
        onDropItem?.(
          event.dataTransfer.getData('application/x-darkdesk-item'),
          id,
          Array.from(event.dataTransfer.files),
        );
    },
  });
  return (
    <div className="category-carousel">
      <div className="group-toolbar">
        <p className="group-toolbar-summary">
          <Layers3 size={15} aria-hidden="true" />
          {t('groups.overview', { count: roots.length })}
        </p>
        <div className="group-view-controls">
          <button
            type="button"
            className="text-btn"
            disabled={disabled}
            onClick={() => onCustomize?.(filter)}
          >
            {t('folderMore.customize')}
          </button>
          <label className="group-sort">
            <span>{t('groups.sort')}</span>
            <select
              aria-label={t('groups.sort')}
              value={view.sort}
              onChange={(event) => setView({ ...view, sort: event.target.value })}
            >
              <option value="manual">{t('groups.sortManual')}</option>
              <option value="count">{t('groups.sortCount')}</option>
              <option value="name">{t('groups.sortName')}</option>
            </select>
          </label>
          <label className="group-empty-toggle">
            <input
              type="checkbox"
              checked={view.showEmpty}
              onChange={(event) => setView({ ...view, showEmpty: event.target.checked })}
            />
            <span>{t('groups.showEmpty')}</span>
          </label>
          {edges.overflow && (
            <div className="category-scroll-controls">
              <span>{t('groups.scrollHint')}</span>
              <button
                type="button"
                disabled={!edges.previous || !!disabled}
                aria-label={t('groups.previous')}
                onClick={() => scroll(-1)}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={!edges.next || !!disabled}
                aria-label={t('groups.next')}
                onClick={() => scroll(1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
      <div
        className="category-grid"
        ref={grid}
        onKeyDown={keyboard}
        role="group"
        aria-label={t('groups.title')}
      >
        {roots.map((category) => {
          const count = summary.get(category.id);
          return (
            <button
              key={category.id}
              disabled={!!disabled}
              aria-pressed={activeRoot?.id === category.id}
              className={`category ${category.color} ${category.customColor ? 'custom-folder-color' : ''} ${activeRoot?.id === category.id ? 'selected' : ''} ${hover === category.id ? 'drag-hover' : ''}`}
              style={folderAccentStyle(category)}
              {...dropProps(category.id)}
              title={t('folderMore.quickHint')}
              onContextMenu={(event) => {
                event.preventDefault();
                if (!disabled) onCustomize?.(category.id);
              }}
              onClick={() => setFilter(filter === category.id ? null : category.id)}
            >
              <div className="category-top">
                <span className="category-icon">
                  <FolderPreview category={category} size={44} />
                </span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </div>
              <h3>{label(category)}</h3>
              <div className="category-count">
                <strong>{count.total}</strong>
                <span>{t('common.items')}</span>
              </div>
              <p>
                {count.apps} {t('common.apps')} <span>·</span> {count.files} {t('common.files')}
              </p>
              <div className="category-line" />
            </button>
          );
        })}
      </div>
      {!roots.length && (
        <div className="group-empty-state">
          <p>{t('groups.noPopulated')}</p>
          <button className="text-btn" onClick={() => setView({ ...view, showEmpty: true })}>
            {t('groups.showAll')}
          </button>
        </div>
      )}
      {current && (
        <div className="category-drilldown">
          <nav className="category-breadcrumb" aria-label={t('groups.path')}>
            <button type="button" disabled={!!disabled} onClick={() => setFilter(null)}>
              {t('groups.all')}
            </button>
            {trail.map((category) => (
              <span key={category.id}>
                <ChevronRight size={13} aria-hidden="true" />
                <button
                  type="button"
                  disabled={!!disabled}
                  aria-current={category.id === filter ? 'true' : undefined}
                  onClick={() => setFilter(category.id)}
                >
                  {label(category)}
                </button>
              </span>
            ))}
          </nav>
          {!!children.length && (
            <div className="subcategory-grid" role="group" aria-label={t('groups.subgroups')}>
              <button
                type="button"
                disabled={!!disabled}
                className={`subcategory-chip subcategory-all ${activeRoot.color} ${activeRoot.customColor ? 'custom-folder-color' : ''}`}
                style={folderAccentStyle(activeRoot)}
                aria-pressed={filter === activeRoot.id}
                onClick={() => setFilter(activeRoot.id)}
              >
                <Layers3 size={15} />
                <span>{t('groups.allIn', { name: label(activeRoot) })}</span>
                <b className="count-badge">{summary.get(activeRoot.id).total}</b>
              </button>
              {children.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  disabled={!!disabled}
                  className={`subcategory-chip ${category.color} ${category.customColor ? 'custom-folder-color' : ''} ${hover === category.id ? 'drag-hover' : ''}`}
                  style={folderAccentStyle(category)}
                  aria-pressed={filter === category.id}
                  {...dropProps(category.id)}
                  onClick={() => setFilter(category.id)}
                >
                  <AppIcon name={category.icon} size={16} />
                  <span>{label(category)}</span>
                  <b className="count-badge">{summary.get(category.id).total}</b>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
