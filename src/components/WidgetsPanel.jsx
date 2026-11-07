import { weatherCities } from '../../shared/weather';
import { useEffect, useRef, useState } from 'react';
import {
  Cpu,
  StickyNote,
  ListTodo,
  Monitor,
  RotateCcw,
  Coins,
  Clock3,
  Timer,
  CloudSun,
} from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';
import { WidgetContent } from './WidgetWindow';
import '../widgets.css';
import { widgetIds } from '../../shared/widget-model';
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
        {state?.crowded && (
          <p className="notice warning" role="status">
            {t('widgetMore.crowded')}
          </p>
        )}
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
          ['currency', Coins],
          ['clock', Clock3],
          ['focus', Timer],
          ['weather', CloudSun],
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
            {id === 'weather' ? (
              <WeatherQuickSetup
                state={state}
                disabled={!state || !!pending || busy}
                onToggle={(location) =>
                  run(id, async () => {
                    if (state.widgets.weather.enabled) return api.hideWidget('weather');
                    await api.saveWidgets({ weather: { ...state.weather, location } });
                    return api.showWidget('weather');
                  })
                }
              />
            ) : (
              <button
                className={'btn ' + (state?.widgets[id].enabled ? 'secondary' : 'primary')}
                disabled={!state || !!pending || busy}
                onClick={() =>
                  run(id, () =>
                    state.widgets[id].enabled ? api.hideWidget(id) : api.showWidget(id),
                  )
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
            )}

            {state && (
              <WidgetAppearanceControl
                id={id}
                value={state.appearance[id]}
                disabled={!!pending || busy}
                onSave={(patch) =>
                  api.saveWidgets({ appearance: { [id]: patch } }).catch((reason) => {
                    setError(errorMessage(reason));
                    throw reason;
                  })
                }
              />
            )}
            {state?.placements?.[id]?.supported === false &&
              native &&
              state.placement === 'desktop' && (
                <small className="muted">
                  {t(
                    state.placements[id].reason === 'editable'
                      ? 'widgetMore.editableHint'
                      : 'widgetPlus.fallback',
                  )}
                </small>
              )}
          </section>
        ))}
      </div>
      {state && (
        <section className="settings-panel widget-system-options">
          <h2>{t('widgetMore.systemOptions')}</h2>
          <p className="muted">{t('ux311.monitorHelp')}</p>
          <div className="widget-system-toggles">
            {['cores', 'chart', 'details', 'disk'].map((key) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={state.system[key]}
                  disabled={!!pending || busy}
                  onChange={(e) =>
                    run('system', () => api.saveWidgets({ system: { [key]: e.target.checked } }))
                  }
                />
                {t('widgetMore.show.' + key)}
              </label>
            ))}
          </div>
          <label>
            {t('widgetMore.refreshInterval')}
            <select
              aria-label={t('widgetMore.refreshInterval')}
              value={state.system.interval}
              disabled={!!pending || busy}
              onChange={(e) =>
                run('system', () =>
                  api.saveWidgets({ system: { interval: Number(e.target.value) } }),
                )
              }
            >
              {[1, 2, 5, 10].map((value) => (
                <option key={value} value={value}>
                  {value} s
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {!native && state && (
        <div className="widget-preview-grid">
          {widgetIds
            .filter((id) => state.widgets[id].enabled)
            .map((id) => (
              <WidgetContent key={id} id={id} embedded />
            ))}
        </div>
      )}
    </>
  );
}

function WidgetAppearanceControl({ id, value, disabled, onSave }) {
  const { t } = usePreferences();
  const [opacity, setOpacity] = useState(value.opacity);
  const liveTimer = useRef(null);
  const draft = useRef(value.opacity),
    dirty = useRef(false),
    revision = useRef(0),
    queued = useRef(-1),
    tail = useRef(Promise.resolve()),
    save = useRef(onSave);
  save.current = onSave;
  useEffect(() => {
    if (!dirty.current) {
      draft.current = value.opacity;
      setOpacity(value.opacity);
    }
  }, [value.opacity]);
  const commit = () => {
    if (!dirty.current || queued.current === revision.current) return tail.current;
    const version = revision.current,
      amount = draft.current;
    queued.current = version;
    const work = tail.current.catch(() => {}).then(() => save.current({ opacity: amount }));
    tail.current = work;
    return work
      .then(() => {
        if (version === revision.current) dirty.current = false;
      })
      .catch(() => {
        if (version === revision.current) queued.current = -1;
      });
  };
  useEffect(
    () => () => {
      clearTimeout(liveTimer.current);
      if (dirty.current) commit();
    },
    [],
  );
  return (
    <div className="widget-appearance-control">
      <label>
        {t('widgetMore.opacity')} <output>{opacity}%</output>
        <input
          type="range"
          disabled={disabled}
          step="1"
          min="25"
          max="100"
          value={opacity}
          aria-label={t('widgetMore.opacityFor', { name: t('widgetPlus.' + id) })}
          onChange={(e) => {
            draft.current = Number(e.target.value);
            dirty.current = true;
            revision.current++;
            setOpacity(draft.current);
            clearTimeout(liveTimer.current);
            liveTimer.current = setTimeout(commit, 80);
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
      </label>
      <label>
        {t('widgetMore.size')}
        <select
          disabled={disabled}
          aria-label={t('widgetMore.sizeFor', { name: t('widgetPlus.' + id) })}
          value={value.size}
          onChange={(e) => onSave({ size: e.target.value }).catch(() => {})}
        >
          {['compact', 'regular', 'large'].map((size) => (
            <option key={size} value={size}>
              {t('widgetMore.size.' + size)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function WeatherQuickSetup({ state, disabled, onToggle }) {
  const { t } = usePreferences();
  const location = state?.weather?.location;
  const [selected, setSelected] = useState('0');
  useEffect(() => {
    if (!location) return;
    const index = weatherCities.findIndex(
      (city) => city.latitude === location.latitude && city.longitude === location.longitude,
    );
    setSelected(index < 0 ? 'custom' : String(index));
  }, [location?.latitude, location?.longitude]);
  const enabled = state?.widgets?.weather?.enabled;
  return (
    <div className="weather-quick-setup">
      <label>
        {t('weather.city')}
        <select
          aria-label={t('weather.city')}
          disabled={disabled || enabled}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {location && <option value="custom">{location.name}</option>}
          {weatherCities.map((city, index) => (
            <option value={index} key={city.name}>
              {city.name}
            </option>
          ))}
        </select>
      </label>
      <small className="muted">{t('weather.activateHelp')}</small>
      <button
        className={'btn ' + (enabled ? 'secondary' : 'primary')}
        disabled={disabled}
        onClick={() => onToggle(selected === 'custom' ? location : weatherCities[Number(selected)])}
      >
        {t(
          enabled
            ? 'widgetPlus.hideButton'
            : native
              ? 'widgetPlus.showButton'
              : 'widgetPlus.previewButton',
        )}
      </button>
    </div>
  );
}
