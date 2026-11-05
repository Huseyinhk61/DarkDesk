import { Activity } from 'lucide-react';
import { estimateUsage } from '../../shared/usage-estimator';
import { usePreferences } from '../preferences';
import '../usage-estimator.css';

export default function UsageEstimate({ item, detail = false }) {
  const { settings, t } = usePreferences();
  const usage = estimateUsage(item, settings.categories);
  return (
    <div
      className={`usage-estimate ${detail ? 'usage-estimate-detail' : ''}`}
      data-source={usage.source}
    >
      <div className="usage-estimate-label">
        <Activity size={13} aria-hidden="true" />
        <span>{t('usageEstimate.title')}</span>
        <strong>{t(usage.labelKey)}</strong>
      </div>
      <small>{t(usage.noteKey, usage.params)}</small>
      {detail && <p>{t('usageEstimate.scopeNote')}</p>}
    </div>
  );
}
