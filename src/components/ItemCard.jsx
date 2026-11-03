import { Check, ChevronDown, ExternalLink, File, Folder, Link2 } from 'lucide-react';
import { categories } from '../data';
import { formatBytes, isShortcut } from '../utils';
export default function ItemCard({ item, selected, toggle, onCategory, reveal, disabled }) {
  const category = categories[item.category];
  return (
    <article className={`item-card ${selected ? 'checked' : ''}`}>
      <div className="item-top">
        <div
          className="app-icon"
          style={{ color: item.tint || 'var(--accent)', background: `${item.tint || '#818cf8'}14` }}
        >
          {item.mark || (isShortcut(item) ? <Link2 size={24} /> : <File size={24} />)}
        </div>
        <button
          disabled={disabled}
          className={`checkbox ${selected ? 'on' : ''}`}
          onClick={toggle}
          aria-label={`${item.name} seç`}
          aria-pressed={selected}
        >
          {selected && <Check size={12} />}
        </button>
      </div>
      <h3 title={item.name}>{item.name.replace(/\.(lnk|exe|url)$/i, '')}</h3>
      <p className="file-path" title={item.target || item.source}>
        {item.target || item.source}
      </p>
      <div className="item-metadata">
        <span>
          {isShortcut(item) ? 'Kısayol' : item.extension?.slice(1).toUpperCase() || 'Dosya'}
        </span>
        <span>{formatBytes(item.size)}</span>
      </div>
      <div className="destination">
        <Folder size={13} />
        <span>Hedef klasör</span>
        <button
          disabled={disabled}
          onClick={reveal}
          aria-label={`${item.name} klasörde göster`}
          title="Explorer / Finder’da göster"
        >
          <ExternalLink size={12} />
        </button>
      </div>
      <div className={`select-wrap ${category.color}`}>
        <span className="color-dot" />
        <select
          disabled={disabled}
          value={item.category}
          onChange={(event) => onCategory(Number(event.target.value))}
          aria-label={`${item.name} hedef klasörü`}
        >
          {categories.map((c, index) => (
            <option key={c.name} value={index}>
              {c.name}
            </option>
          ))}
        </select>
        <ChevronDown size={13} />
      </div>
    </article>
  );
}
