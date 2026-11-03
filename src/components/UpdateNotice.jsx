import { useState } from 'react';
import { Download, RotateCw, X } from 'lucide-react';
import { usePreferences } from '../preferences';
import '../updates.css';

export default function UpdateNotice({ update, onOpen }) {
  const { t } = usePreferences();
  const [dismissed, setDismissed] = useState(null);
  const key = `${update?.version || ''}:${update?.state || ''}`;
  if (!['available', 'downloaded'].includes(update?.state) || dismissed === key) return null;
  const ready = update.state === 'downloaded';
  const Icon = ready ? RotateCw : Download;
  return (
    <aside className="update-notice" role="status" aria-live="polite">
      <Icon size={20} />
      <div>
        <b>
          {t(ready ? 'update.noticeReady' : 'update.noticeAvailable', {
            version: update.version || '',
          })}
        </b>
        <p>{t(ready ? 'update.noticeReadyBody' : 'update.noticeBody')}</p>
      </div>
      <button type="button" className="btn secondary" onClick={onOpen}>
        {t('update.review')}
      </button>
      <button
        type="button"
        className="update-notice-close"
        onClick={() => setDismissed(key)}
        aria-label={t('update.dismiss')}
      >
        <X size={17} />
      </button>
    </aside>
  );
}
