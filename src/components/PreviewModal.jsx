import { ArrowRight, AlertTriangle, FolderCheck, ShieldCheck, Link2 } from 'lucide-react';
import Modal from './Modal';
import { usePreferences } from '../preferences';
import { formatBytes } from '../utils';
export default function PreviewModal({ plan, native, onClose, onConfirm }) {
  const { t, locale, errorMessage } = usePreferences();
  const shortcut = plan.entries.some((e) => e.action === 'shortcut');
  return (
    <Modal title={t('preview.title')} onClose={onClose}>
      <p>{t('preview.body', { count: plan.ready })}</p>
      {!native && (
        <div className="notice">
          <ShieldCheck size={17} />
          {t('preview.demo')}
        </div>
      )}
      {shortcut && (
        <div className="notice">
          <Link2 size={17} />
          {t('scan.safe')}
        </div>
      )}
      <div className="preview-totals">
        <span>
          <FolderCheck size={18} />
          {t('preview.ready', { count: plan.ready })}
        </span>
        <span>
          <b>{formatBytes(plan.bytes, locale)}</b>
          {t('common.total')}
        </span>
        <span className={plan.conflicts ? 'warning-text' : ''}>
          <AlertTriangle size={16} />
          {t('preview.conflicts', { count: plan.conflicts })}
        </span>
      </div>
      {plan.conflicts > 0 && <div className="notice warning">{t('preview.skipNote')}</div>}
      <div className="preview-entries">
        {plan.entries.map((entry) => (
          <div className={`preview-entry ${entry.conflict ? 'conflict' : ''}`} key={entry.id}>
            <div>
              <b>{entry.name || entry.id}</b>
              <small title={entry.target}>
                {entry.conflict ? errorMessage(entry.conflict) : entry.categoryPath || entry.target}
              </small>
            </div>
            <span>
              {entry.conflict
                ? t('preview.skip')
                : entry.action === 'shortcut'
                  ? t('common.shortcut')
                  : formatBytes(entry.size, locale)}
            </span>
          </div>
        ))}
      </div>
      <div className="info-note">
        <ShieldCheck size={16} />
        {t('preview.verified')}
      </div>
      <div className="modal-actions">
        <button className="btn secondary" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" disabled={!plan.ready} onClick={onConfirm}>
          {t(
            shortcut ? 'preview.shortcut' : plan.mode === 'move' ? 'preview.move' : 'preview.copy',
            { count: plan.ready },
          )}
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
