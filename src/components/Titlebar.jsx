import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';

export default function Titlebar({ view }) {
  const { t } = usePreferences();
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .windowState()
      .then((state) => active && setMaximized(state.maximized))
      .catch(() => {});
    const off = api.onWindowStateChanged((state) => setMaximized(state.maximized));
    return () => {
      active = false;
      off();
    };
  }, []);
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
          ['maximize', maximized ? Copy : Square],
          ['close', X],
        ].map(([action, Icon]) => (
          <button
            key={action}
            type="button"
            disabled={!native}
            className={action === 'close' ? 'close' : ''}
            onClick={() => api.window(action)}
            aria-label={t('window.' + (action === 'maximize' && maximized ? 'restore' : action))}
            title={t('window.' + (action === 'maximize' && maximized ? 'restore' : action))}
          >
            <Icon size={action === 'maximize' ? 15 : 19} strokeWidth={1.9} />
          </button>
        ))}
      </div>
    </header>
  );
}
