import { useEffect, useState } from 'react';
import { LifeBuoy, Copy, ExternalLink } from 'lucide-react';
import { api } from '../service';
import { usePreferences } from '../preferences';
export default function SupportPanel({ busy, onNavigate }) {
  const { t, settings, errorMessage } = usePreferences();
  const [info, setInfo] = useState(null),
    [copied, setCopied] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api
      .supportInfo()
      .then((value) => {
        if (active) setInfo(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [settings.language, settings.theme]);
  const open = async (id) => {
    try {
      await api.openHelpLink(id);
      setError('');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };
  return (
    <section className="settings-panel support-panel" aria-labelledby="support-title">
      <h2 id="support-title">
        <LifeBuoy size={20} />
        {t('support.title')}
      </h2>
      <p className="muted">{t('support.body')}</p>
      <dl className="support-information">
        {['version', 'platform', 'architecture', 'channel'].map((key) => (
          <div key={key}>
            <dt>{t('support.' + key)}</dt>
            <dd>{info?.[key] || '—'}</dd>
          </div>
        ))}
      </dl>
      <div className="support-actions">
        <button
          type="button"
          className="btn secondary"
          disabled={busy || !info}
          onClick={async () => {
            try {
              await api.copySupportInfo();
              setCopied(true);
              setError('');
            } catch (reason) {
              setError(errorMessage(reason));
            }
          }}
        >
          <Copy size={15} />
          {t('support.copy')}
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => onNavigate('widgets')}
        >
          {t('support.widgets')}
        </button>
      </div>
      <div className="support-links">
        {['guide', 'privacy', 'issue'].map((id) => (
          <button
            type="button"
            key={id}
            className="text-btn"
            disabled={busy}
            onClick={() => open(id)}
          >
            <ExternalLink size={13} />
            {t('support.' + id)}
          </button>
        ))}
      </div>
      {copied && (
        <p role="status" className="success-text">
          {t('support.copied')}
        </p>
      )}
      {error && (
        <p role="alert" className="notice warning">
          {error}
        </p>
      )}
    </section>
  );
}
