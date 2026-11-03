import {
  Radar,
  ShieldCheck,
  ScanLine,
  Monitor,
  FolderSearch,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { usePreferences } from '../preferences';
export default function ScannerPanel({
  scope,
  setScope,
  scanSystem,
  scan,
  busy,
  scanProgress,
  scanResult,
  platform,
  desktopPath,
  downloadsPath,
}) {
  const { t } = usePreferences();
  const system = scope === 'system';
  const deepScanning = system && busy === 'deep';
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
          aria-pressed={scope === 'desktop'}
          onClick={() => setScope('desktop')}
        >
          <Monitor size={16} />
          {t('scan.desktop')}
        </button>
        <button
          disabled={!!busy}
          className={scope === 'system' ? 'active' : ''}
          aria-pressed={scope === 'system'}
          onClick={() => setScope('system')}
        >
          <FolderSearch size={16} />
          {t('scan.system')}
        </button>
        <button
          disabled={!!busy}
          className={scope === 'downloads' ? 'active' : ''}
          aria-pressed={scope === 'downloads'}
          onClick={() => setScope('downloads')}
        >
          <Download size={16} />
          {t('scan.downloads')}
        </button>
      </div>
      {system ? (
        <div className="scan-source-chips">
          {(platform === 'linux'
            ? ['linuxSystem', 'linuxUser', 'linuxOpt']
            : ['programFiles', 'programFilesX86', 'startUser', 'registry']
          ).map((key) => (
            <span key={key}>{t('sources.' + key)}</span>
          ))}
        </div>
      ) : (
        <div className="scan-source-chips">
          <span>{(scope === 'downloads' ? downloadsPath : desktopPath) || t('scan.' + scope)}</span>
        </div>
      )}
      <div className="scan-cta">
        <button
          className="btn primary"
          disabled={!!busy && !deepScanning}
          onClick={() => (deepScanning ? scanSystem(true) : scan())}
        >
          <ScanLine className={deepScanning || busy === 'scan' ? 'spin' : ''} size={17} />
          {t(
            deepScanning
              ? 'scan.cancel'
              : busy === 'scan'
                ? 'hero.scanning'
                : system
                  ? 'scan.start'
                  : scope === 'downloads'
                    ? 'scan.scanDownloads'
                    : 'scan.scanDesktop',
          )}
        </button>
        <span>
          {system && scanProgress
            ? t('scan.progress', scanProgress)
            : t(
                system
                  ? 'scan.safe'
                  : scope === 'downloads'
                    ? 'scan.downloadsHint'
                    : 'scan.desktopHint',
              )}
        </span>
      </div>
      {deepScanning && (
        <div className="scan-animation">
          <i />
        </div>
      )}
      {system && scanResult?.cancelled && <p className="muted">{t('scan.cancelled')}</p>}
      {system && scanResult?.limited && <p className="warning-text">{t('scan.limited')}</p>}
      {system && scanResult?.warnings?.length > 0 && (
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
      {system && scanResult?.supported === false && (
        <p className="warning-text">{t('scan.unsupported')}</p>
      )}
    </section>
  );
}
