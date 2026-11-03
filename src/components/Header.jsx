import { ScanLine, FolderSync, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { usePreferences } from '../preferences';
export default function Header({ scan, organize, busy, count, last, native }) {
  const { t, locale } = usePreferences();
  return (
    <>
      <div className="eyebrow">
        <span />
        {t('hero.eyebrow')}
        <span className="local">
          <ShieldCheck size={13} />
          {t(native ? 'hero.local' : 'hero.demo')}
        </span>
      </div>
      <header className="hero">
        <div>
          <h1>
            {t('hero.title')}
            <span>.</span>
          </h1>
          <p>
            {t('hero.body')}
            <br />
            {t('hero.body2')}
          </p>
        </div>
        <div className="hero-visual">
          <div className="orbit one" />
          <div className="orbit two" />
          <div className="floating-folder">
            <FolderSync size={49} strokeWidth={1.3} />
          </div>
          <span className="mini-spark">✦</span>
          <span className="mini-dot" />
        </div>
      </header>
      <div className="action-row">
        <div className="actions">
          <button className="btn primary" onClick={scan} disabled={!!busy}>
            <ScanLine size={17} />
            {t(busy === 'scan' ? 'hero.scanning' : 'hero.scan')}
            <ArrowUpRight size={16} />
          </button>
          <button className="btn secondary" onClick={organize} disabled={!!busy || !count}>
            <FolderSync size={17} />
            {t(native ? 'hero.organize' : 'hero.organizeDemo')}
          </button>
        </div>
        <div className="scan-meta">
          <span className="online" />
          {last
            ? t('hero.lastScan', {
                time: last.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
              })
            : t('hero.ready')}
          <span className="divider" />
          <b>{count}</b>
          {t('common.items')}
        </div>
      </div>
    </>
  );
}
