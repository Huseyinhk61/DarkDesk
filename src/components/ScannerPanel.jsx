import {
  Radar,
  ShieldCheck,
  ScanLine,
  Monitor,
  Square,
  FolderSearch,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { usePreferences } from '../preferences';
export default function ScannerPanel({
  scope,
  setScope,
  scanSystem,
  busy,
  scanProgress,
  scanResult,
  platform,
}) {
  const { t } = usePreferences();
  return (
    <section className="scanner-panel">
      <div className="scanner-heading">
        <span className="scanner-emblem">
          <Radar size={30} />
        </span>
        <div>
          <h2>{t('scan.title')}</h2>
          <p>{t('scan.body')}</p>
        </div>
        <span className="readonly-label">
          <ShieldCheck size={13} />
          {t('scan.readonly')}
        </span>
      </div>
      <div className="scope-tabs" role="group" aria-label={t('scan.source')}>
        <button
          disabled={!!busy}
          className={scope === 'desktop' ? 'active' : ''}
          onClick={() => setScope('desktop')}
        >
          <Monitor size={16} />
          {t('scan.desktop')}
        </button>
        <button
          disabled={!!busy}
          className={scope === 'system' ? 'active' : ''}
          onClick={() => setScope('system')}
        >
          <FolderSearch size={16} />
          {t('scan.system')}
        </button>
        <button
          disabled={!!busy}
          className={scope === 'downloads' ? 'active' : ''}
          onClick={() => setScope('downloads')}
        >
          <Download size={16} />
          {t('scan.downloads')}
        </button>
      </div>
      <div className="scan-source-chips">
        {(platform === 'linux'
          ? ['linuxSystem', 'linuxUser', 'linuxOpt']
          : ['programFiles', 'programFilesX86', 'startUser', 'registry']
        ).map((key) => (
          <span key={key}>{t('sources.' + key)}</span>
        ))}
      </div>
      <div className="scan-cta">
        <button
          className="btn primary"
          disabled={!!busy && busy !== 'deep'}
          onClick={() => scanSystem(busy === 'deep')}
        >
          <ScanLine className={busy === 'deep' ? 'spin' : ''} size={17} />
          {t(busy === 'deep' ? 'scan.cancel' : 'scan.start')}
        </button>
        <span>{scanProgress ? t('scan.progress', scanProgress) : t('scan.safe')}</span>
      </div>
      {busy === 'deep' && (
        <div className="scan-animation">
          <i />
        </div>
      )}
      {scanResult?.cancelled && <p className="muted">{t('scan.cancelled')}</p>}
      {scanResult?.limited && <p className="warning-text">{t('scan.limited')}</p>}
      {scanResult?.warnings?.length > 0 && (
        <div className="notice warning">
          <AlertTriangle size={16} />
          {t('scan.warnings', { count: scanResult.warnings.length })}
          <span
            title={scanResult.warnings
              .map((w) => `${t('sources.' + w.origin)}: ${w.code}`)
              .join('\n')}
          >
            ⓘ
          </span>
        </div>
      )}
      {scanResult?.supported === false && <p className="warning-text">{t('scan.unsupported')}</p>}
    </section>
  );
}
