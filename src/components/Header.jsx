import { ScanLine, FolderSync, ShieldCheck, Monitor, Layers3 } from 'lucide-react';
import { usePreferences } from '../preferences';
export default function Header({
  scan,
  organize,
  busy,
  count,
  last,
  native,
  scope = 'desktop',
  selectedCount = count,
}) {
  const { t, locale } = usePreferences();
  return (
    <header className="desktop-header">
      <div className="desktop-header-copy">
        <div className="eyebrow">
          <span />
          {t('hero.eyebrow')}
          <span className="desktop-connection">
            <ShieldCheck size={13} />
            {t(native ? 'hero.local' : 'hero.demo')}
          </span>
        </div>
        <h1>
          {t('hero.title')}
          <span>.</span>
        </h1>
        <p>{t(scope === 'system' ? 'desktop.systemHint' : 'hero.body')}</p>
        <div className="desktop-source-meta">
          <span>
            <Monitor size={13} />
            {t('scan.' + scope)}
          </span>
          <span>
            <Layers3 size={13} />
            {t('desktop.selection', { selected: selectedCount, count })}
          </span>
          <span className="desktop-scan-time">
            {last
              ? t('hero.lastScan', {
                  time: last.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
                })
              : t('hero.ready')}
          </span>
        </div>
      </div>
      <div className="desktop-header-actions">
        <div className="actions">
          <button className="btn secondary" onClick={scan} disabled={!!busy}>
            <ScanLine size={17} />
            {t(busy === 'scan' ? 'hero.scanning' : 'hero.scan')}
          </button>
          <button className="btn primary" onClick={organize} disabled={!!busy || !selectedCount}>
            <FolderSync size={17} />
            {t(native ? 'hero.organize' : 'hero.organizeDemo')}
          </button>
        </div>
        <small>{t('desktop.reviewHint')}</small>
      </div>
    </header>
  );
}
