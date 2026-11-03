import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import AppIcon from './AppIcon';
import { usePreferences } from '../preferences';
import { isDescendant } from '../../shared/domain';
import { useRef, useState } from 'react';
export default function CategoryGrid({ items, filter, setFilter, onDropItem, disabled }) {
  const [hover, setHover] = useState(null);
  const grid = useRef(null);
  const scroll = (direction) =>
    grid.current?.scrollBy({
      left: direction * grid.current.clientWidth * 0.7,
      behavior: document.documentElement.dataset.motion === 'reduced' ? 'instant' : 'smooth',
    });
  const { settings, t, label } = usePreferences();
  return (
    <div className="category-carousel">
      <div className="category-grid" ref={grid}>
        {settings.categories
          .filter((c) => !c.parentId)
          .map((c) => {
            const list = items.filter((i) => isDescendant(i.category, c.id, settings.categories)),
              apps = list.filter(
                (i) => i.kind === 'installed' || /\.(lnk|exe|url|app|desktop)$/i.test(i.name),
              ).length;
            return (
              <button
                key={c.id}
                aria-pressed={filter === c.id}
                className={`category ${c.color} ${filter === c.id ? 'selected' : ''} ${hover === c.id ? 'drag-hover' : ''}`}
                onDragOver={(e) => {
                  if (!disabled) {
                    e.preventDefault();
                    setHover(c.id);
                  }
                }}
                onDragLeave={() => setHover(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setHover(null);
                  if (!disabled)
                    onDropItem?.(
                      e.dataTransfer.getData('application/x-darkdesk-item'),
                      c.id,
                      Array.from(e.dataTransfer.files),
                    );
                }}
                onClick={() => setFilter(filter === c.id ? null : c.id)}
              >
                <div className="category-top">
                  <span className="category-icon">
                    <AppIcon name={c.icon} size={24} strokeWidth={2} />
                  </span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </div>
                <h3>
                  {c.parentId && <span className="subgroup-prefix">↳ </span>}
                  {label(c)}
                </h3>
                <div className="category-count">
                  <strong>{list.length}</strong>
                  <span>{t('common.items')}</span>
                </div>
                <p>
                  {apps} {t('common.apps')} <span>·</span> {list.length - apps} {t('common.files')}
                </p>
                <div className="category-line" />
              </button>
            );
          })}
      </div>
      <div className="category-scroll-controls">
        <span>{t('groups.scrollHint')}</span>
        <button type="button" aria-label={t('groups.previous')} onClick={() => scroll(-1)}>
          <ChevronLeft size={16} />
        </button>
        <button type="button" aria-label={t('groups.next')} onClick={() => scroll(1)}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
