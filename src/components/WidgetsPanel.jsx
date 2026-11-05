import { useEffect, useState } from 'react';
import { Cpu, StickyNote, ListTodo, Monitor, RotateCcw } from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';
import { WidgetContent } from './WidgetWindow';
import '../widgets.css';
export default function WidgetsPanel({ busy }) {
  const { t, errorMessage } = usePreferences();
  const [state, setState] = useState(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState('');
  useEffect(() => {
    let active = true;
    const receive = (value) => {
      if (active) setState(value);
    };
    const off = api.onWidgetsChanged?.(receive);
    api
      .widgetState()
      .then(receive)
      .catch((reason) => setError(errorMessage(reason)));
    return () => {
      active = false;
      off?.();
    };
  }, []);
  const run = async (id, fn) => {
    if (pending || busy) return;
    setPending(id);
    setError('');
    try {
      setState(await fn());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending('');
    }
  };
  return (
    <>
      <div className="eyebrow">{t('nav.widgets')}</div>
      <h1 className="settings-title">{t('widgetPlus.title')}</h1>
      <p className="muted">{t('widgetPlus.body')}</p>
      {error && (
        <p className="notice warning" role="alert">
          {error}
        </p>
      )}
      <section className="settings-panel widget-controls">
        <h2>
          <Monitor size={20} />
          {t('widgetPlus.placement')}
        </h2>
        <label>
          {t('widgetPlus.placementLabel')}
          <select
            disabled={!state || !!pending || busy || !native}
            value={state?.placement || 'desktop'}
            onChange={(event) =>
              run('placement', () => api.saveWidgets({ placement: event.target.value }))
            }
          >
            <option value="desktop">{t('widgetPlus.desktopMode')}</option>
            <option value="floating">{t('widgetPlus.floatingMode')}</option>
          </select>
        </label>
        <p className="muted">{t(native ? 'widgetPlus.nativeHint' : 'widgetPlus.previewHint')}</p>
        <button
          className="btn secondary"
          disabled={!!pending || busy || !native}
          onClick={() => run('reset', () => api.saveWidgets({ resetPositions: true }))}
        >
          <RotateCcw size={15} />
          {t('widgetPlus.resetPositions')}
        </button>
      </section>
      <div className="widget-module-grid">
        {[
          ['system', Cpu],
          ['note', StickyNote],
          ['todos', ListTodo],
        ].map(([id, Icon]) => (
          <section className="settings-panel widget-module-card" key={id}>
            <span className="widget-module-icon">
              <Icon size={24} />
            </span>
            <h2>{t('widgetPlus.' + id)}</h2>
            <p className="muted">{t('widgetPlus.description.' + id)}</p>
            <span className="widget-placement-note">
              {state?.widgets[id].enabled
                ? t(
                    state.placements?.[id]?.mode === 'desktop'
                      ? 'widgetPlus.attached'
                      : 'widgetPlus.floating',
                  )
                : t('widgetPlus.off')}
            </span>
            <button
              className={'btn ' + (state?.widgets[id].enabled ? 'secondary' : 'primary')}
              disabled={!state || !!pending || busy}
              onClick={() =>
                run(id, () => (state.widgets[id].enabled ? api.hideWidget(id) : api.showWidget(id)))
              }
            >
              {t(
                state?.widgets[id].enabled
                  ? 'widgetPlus.hideButton'
                  : native
                    ? 'widgetPlus.showButton'
                    : 'widgetPlus.previewButton',
              )}
            </button>
            {state?.placements?.[id]?.supported === false &&
              native &&
              state.placement === 'desktop' && (
                <small className="muted">{t('widgetPlus.fallback')}</small>
              )}
          </section>
        ))}
      </div>
      {!native && state && (
        <div className="widget-preview-grid">
          {['system', 'note', 'todos']
            .filter((id) => state.widgets[id].enabled)
            .map((id) => (
              <WidgetContent key={id} id={id} embedded />
            ))}
        </div>
      )}
    </>
  );
}
