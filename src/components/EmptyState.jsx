import { FolderSearch, Sparkles, ScanLine, Search } from 'lucide-react';
import { usePreferences } from '../preferences';
export default function EmptyState({ filtered, system, downloads, busy, clear, scan }) {
  const { t } = usePreferences();
  return (
    <div className="empty illustrated-empty">
      <div className="empty-art">
        <span className="empty-orbit" />
        <FolderSearch size={48} strokeWidth={1} />
        <Sparkles className="empty-spark" size={21} />
        <span className="empty-dots">· · ·</span>
      </div>
      <h3>
        {t(
          busy
            ? 'busy.loading'
            : filtered
              ? 'empty.filtered'
              : system
                ? 'empty.system'
                : downloads
                  ? 'empty.downloads'
                  : 'empty.title',
        )}
      </h3>
      <p>
        {t(
          filtered
            ? 'empty.filteredBody'
            : system
              ? 'empty.systemBody'
              : downloads
                ? 'empty.downloadsBody'
                : 'empty.body',
        )}
      </p>
      <button disabled={!!busy} className="btn secondary" onClick={filtered ? clear : scan}>
        {filtered ? <Search size={15} /> : <ScanLine size={15} />}{' '}
        {t(
          filtered
            ? 'empty.clear'
            : system
              ? 'empty.scan'
              : downloads
                ? 'scan.scanDownloads'
                : 'hero.scan',
        )}
      </button>
    </div>
  );
}
