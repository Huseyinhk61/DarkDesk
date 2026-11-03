import { useEffect, useState } from 'react';
import { Info, LoaderCircle, RefreshCw } from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';
import { formatBytes } from '../utils';
import Modal from './Modal';
import NativeItemIcon from './NativeItemIcon';
import '../details.css';

export default function ItemDetails({ item, fallback, onClose }) {
  const { t, locale } = usePreferences();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setDetails(null);
    setError(false);
    api
      .itemDetails(item.id)
      .then((value) => {
        if (active) setDetails(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [item.id, item.modified, attempt]);
  const unknown = t('info.unavailable');
  const date = (value) => {
    if (value === null || value === undefined || value === '') return unknown;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString(locale) : unknown;
  };
  return (
    <Modal title={t('info.title')} onClose={onClose} labelledBy="item-details-title">
      <div className="item-details">
        <div className="item-details-heading">
          <span className="item-details-icon">
            <NativeItemIcon item={item} fallback={fallback} size={48} eager />
          </span>
          <div>
            <h3>{item.name}</h3>
            <p>{details?.description || (!details && !error ? t('info.loading') : unknown)}</p>
          </div>
        </div>
        {!details && !error && (
          <p className="item-details-loading" role="status">
            <LoaderCircle size={18} className="spin" />
            {t('info.loading')}
          </p>
        )}
        {error && (
          <div className="item-details-error" role="alert">
            <p>{t('info.loadError')}</p>
            <button className="btn secondary" onClick={() => setAttempt((value) => value + 1)}>
              <RefreshCw size={15} />
              {t('info.retry')}
            </button>
          </div>
        )}
        {details && (
          <>
            <dl className="item-details-grid">
              <div>
                <dt>{t('info.description')}</dt>
                <dd>{details.description || unknown}</dd>
              </div>
              <div>
                <dt>{t('info.company')}</dt>
                <dd>{details.company || unknown}</dd>
              </div>
              <div>
                <dt>{t('info.size')}</dt>
                <dd>
                  {Number.isFinite(details.size) ? formatBytes(details.size, locale) : unknown}
                </dd>
              </div>
              <div>
                <dt>{t('info.created')}</dt>
                <dd>{date(details.created)}</dd>
              </div>
              <div>
                <dt>{t('info.modified')}</dt>
                <dd>{date(details.modified)}</dd>
              </div>
              <div>
                <dt>{t('info.lastOpened')}</dt>
                <dd>{date(details.lastOpened)}</dd>
              </div>
            </dl>
            <div className="item-details-source">
              <span>{t('info.source')}</span>
              <code>{item.source}</code>
            </div>
            <p className="item-details-note">
              <Info size={16} />
              {t('info.usageNote')}
            </p>
            {!native && <p className="item-details-note">{t('info.demoNote')}</p>}
          </>
        )}
      </div>
    </Modal>
  );
}
