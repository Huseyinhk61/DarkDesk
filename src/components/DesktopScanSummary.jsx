import { Monitor, Users, AlertTriangle, FilterX, Copy } from 'lucide-react';
import { usePreferences } from '../preferences';
import '../desktop-scan.css';

export default function DesktopScanSummary({
  report,
  mode,
  filteredCount,
  totalCount,
  onClearFilters,
}) {
  const { t } = usePreferences();
  if (!report || !Array.isArray(report.sources)) return null;
  const sources = report.sources.filter((source) => ['desktop', 'shared'].includes(source.scope));
  const blocked = sources.some((source) => ['denied', 'error'].includes(source.status));
  const excluded = report.excluded || {};
  const hiddenByFilters = Number.isFinite(filteredCount) && filteredCount < totalCount;
  return (
    <section className="desktop-scan-summary" aria-label={t('scanSummary.title')}>
      <div className="desktop-scan-summary-heading">
        <strong>
          <Monitor size={16} />
          {t('scanSummary.title')}
        </strong>
        <span>{t('scanSummary.total', { count: report.total ?? totalCount ?? 0 })}</span>
      </div>
      <div className="desktop-scan-source-list">
        {sources.map((source) => (
          <span
            className={`desktop-scan-source ${source.status}`}
            key={source.scope}
            title={source.path}
          >
            {source.scope === 'shared' ? <Users size={14} /> : <Monitor size={14} />}
            {t('scanSummary.source.' + source.scope)}
            <b>
              {source.status === 'ready'
                ? source.count
                : t(
                    'scanSummary.status.' +
                      (['missing', 'denied', 'error'].includes(source.status)
                        ? source.status
                        : 'error'),
                  )}
            </b>
          </span>
        ))}
      </div>
      {blocked && (
        <p className="desktop-scan-warning" role="status">
          <AlertTriangle size={15} />
          {t('scanSummary.access')}
        </p>
      )}
      {mode === 'copy' && (
        <p className="desktop-scan-copy">
          <Copy size={15} />
          {t('scanSummary.copyMode')}
        </p>
      )}
      {hiddenByFilters && (
        <div className="desktop-scan-filter-note">
          <span>{t('scanSummary.filtered', { visible: filteredCount, total: totalCount })}</span>
          <button className="text-btn" onClick={onClearFilters}>
            <FilterX size={14} />
            {t('scanSummary.clearFilters')}
          </button>
        </div>
      )}
      <details className="desktop-scan-details">
        <summary>{t('scanSummary.details')}</summary>
        <ul>
          {sources.map((source) => (
            <li key={source.scope}>
              {t('scanSummary.source.' + source.scope)}: <code>{source.path}</code>
            </li>
          ))}
        </ul>
        {excluded.folders > 0 && <p>{t('scanSummary.folders', { count: excluded.folders })}</p>}
        {(excluded.hidden > 0 || excluded.extensions > 0) && (
          <p>
            {t('scanSummary.excluded', {
              hidden: excluded.hidden || 0,
              extensions: excluded.extensions || 0,
            })}
          </p>
        )}
        {!!report.warnings?.length && (
          <p>{t('scanSummary.warnings', { count: report.warnings.length })}</p>
        )}
      </details>
    </section>
  );
}
