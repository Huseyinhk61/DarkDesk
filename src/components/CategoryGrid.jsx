import { ArrowUpRight } from 'lucide-react';
import AppIcon from './AppIcon';
import { usePreferences } from '../preferences';
export default function CategoryGrid({ items, filter, setFilter }) {
  const { settings, t, label } = usePreferences();
  return (
    <div className="category-grid">
      {settings.categories.map((c) => {
        const list = items.filter((i) => i.category === c.id),
          apps = list.filter(
            (i) => i.kind === 'installed' || /\.(lnk|exe|url|app|desktop)$/i.test(i.name),
          ).length;
        return (
          <button
            key={c.id}
            className={`category ${c.color} ${filter === c.id ? 'selected' : ''}`}
            onClick={() => setFilter(filter === c.id ? null : c.id)}
          >
            <div className="category-top">
              <span className="category-icon">
                <AppIcon name={c.icon} />
              </span>
              <ArrowUpRight size={15} />
            </div>
            <h3>
              {c.parentId && <span className="subgroup-prefix">↳ </span>}
              {label(c)}
            </h3>
            <div className="category-count">
              <strong>{list.length}</strong>
              <span>{t('common.items')}</span>
              <div className="category-dots">•••</div>
            </div>
            <p>
              {apps} {t('common.apps')} <span>·</span> {list.length - apps} {t('common.files')}
            </p>
            <div className="category-line" />
          </button>
        );
      })}
    </div>
  );
}
