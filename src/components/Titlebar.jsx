import { Minus, Square, X } from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';

export default function Titlebar({ view }) {
  const { t } = usePreferences();
  return (
    <header className="titlebar">
      <span className="titlebar-breadcrumb">
        {t('window.workspace')}
        <span aria-hidden="true">/</span>
        <b>{t('nav.' + view)}</b>
      </span>
      <div className="window-controls">
        <span className="titlebar-local">
          <span className="online" />
          {t(native ? 'window.connection' : 'window.demo')}
        </span>
        {[
          ['minimize', Minus],
          ['maximize', Square],
          ['close', X],
        ].map(([action, Icon]) => (
          <button
            key={action}
            type="button"
            disabled={!native}
            className={action === 'close' ? 'close' : ''}
            onClick={() => api.window(action)}
            aria-label={t('window.' + action)}
            title={t('window.' + action)}
          >
            <Icon size={action === 'maximize' ? 15 : 19} strokeWidth={1.9} />
          </button>
        ))}
      </div>
    </header>
  );
}
