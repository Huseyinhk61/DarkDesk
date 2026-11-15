import { useEffect, useState, useRef } from 'react';
import { CloudSun, Settings2, RefreshCw, ExternalLink } from 'lucide-react';
import { weatherTimeZone } from '../../shared/weather';
import { api } from '../service';
import { usePreferences } from '../preferences';
import WeatherSettings from './WeatherSettings';
import WeatherForecast from './WeatherForecast';
export default function WeatherWidget({ value, accept }) {
  const { t, locale, errorMessage } = usePreferences();
  const [editing, setEditing] = useState(!value.location),
    [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(false),
    [retryAt, setRetryAt] = useState(0),
    [now, setNow] = useState(Date.now),
    [saveError, setSaveError] = useState(''),
    [linkError, setLinkError] = useState(''),
    [view, setView] = useState('current');
  const force = useRef(false),
    tabList = useRef(null);
  const key = value.location ? `${value.location.latitude},${value.location.longitude}` : '';
  const timeZone = weatherTimeZone(value.location),
    views = ['current', 'hourly', 'daily', 'details'];
  useEffect(() => {
    setResult(null);
    setError('');
  }, [key]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true,
      timer;
    if (!value.location) return;
    const requested = force.current;
    force.current = false;
    setLoading(true);
    setError('');
    setRetryAt(Date.now() + 5000);
    const schedule = (delay) => {
      timer = setTimeout(() => {
        if (document.hidden) schedule(60000);
        else setRefresh((n) => n + 1);
      }, delay);
    };
    api
      .weatherQuote(value.location, { refresh: requested })
      .then((data) => {
        if (!active) return;
        setResult(data);
        schedule(data.cached ? 60000 : 900000);
      })
      .catch(() => {
        if (!active) return;
        setResult((previous) =>
          previous && Date.now() - Date.parse(previous.updatedAt || previous.date) < 3600000
            ? { ...previous, cached: true }
            : null,
        );
        setError(t('ux312.weatherUnavailable'));
        schedule(60000);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const update = () => {
      if (!document.hidden) setRefresh((n) => n + 1);
    };
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update);
    };
  }, [key, refresh, t]);
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const expired = result && now - Date.parse(result.updatedAt || result.date) >= 3600000;
  const display = expired ? null : result,
    problem = expired ? t('weather313.expired') : error;
  const save = async (weather) => {
    setSaving(true);
    setSaveError('');
    try {
      accept(await api.saveWidgets({ weather }));
      setEditing(false);
      setError('');
    } catch (reason) {
      setSaveError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };
  const onTabKey = (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = views.indexOf(view),
      next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? 3
            : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
    setView(views[next]);
    tabList.current?.querySelectorAll('[role=tab]')[next]?.focus();
  };
  return (
    <div
      className={'weather-widget weather-detailed ' + (editing ? 'weather-editing' : '')}
      aria-busy={loading}
    >
      {editing ? (
        <WeatherSettings
          value={value}
          busy={saving}
          error={saveError}
          onSave={save}
          onClose={value.location ? () => setEditing(false) : undefined}
        />
      ) : (
        <>
          <div className="weather-heading weather-location-heading">
            <div>
              <b title={value.location?.name}>{value.location?.name}</b>
              <small title={timeZone}>
                {new Date(now).toLocaleTimeString(locale, {
                  timeZone,
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}{' '}
                · {timeZone}
              </small>
            </div>
            <button
              type="button"
              aria-label={t('weather.settings')}
              onClick={() => {
                setSaveError('');
                setEditing(true);
              }}
            >
              <Settings2 size={16} />
            </button>
          </div>
          <div
            className="weather-tabs"
            role="tablist"
            ref={tabList}
            aria-label={t('weather313.views')}
            onKeyDown={onTabKey}
          >
            {views.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={'weather-tab-' + id}
                aria-controls="weather-view-panel"
                aria-selected={view === id}
                tabIndex={view === id ? 0 : -1}
                onClick={() => setView(id)}
              >
                {t('weather313.' + id)}
              </button>
            ))}
          </div>
          <div
            className="weather-view-panel"
            id="weather-view-panel"
            role="tabpanel"
            aria-labelledby={'weather-tab-' + view}
          >
            {problem && !display ? (
              <div className="weather-offline">
                <CloudSun size={28} />
                <p role="alert">{problem}</p>
              </div>
            ) : (
              <WeatherForecast
                key={key}
                view={view}
                result={display}
                unit={value.unit}
                timeZone={timeZone}
                now={now}
              />
            )}
          </div>
          <div
            className={'weather-data-status ' + (display?.cached ? 'is-cached' : '')}
            role={linkError ? 'alert' : 'status'}
            title={linkError || undefined}
          >
            {linkError ? (
              linkError
            ) : loading ? (
              t('weather.loading')
            ) : display ? (
              <>
                <i />
                {t(display.cached ? 'weather313.cached' : 'weather313.updated', {
                  time: new Date(display.updatedAt || display.date).toLocaleTimeString(locale, {
                    timeZone,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }),
                })}
              </>
            ) : (
              t('weather313.disconnected')
            )}
          </div>
          <button
            className="weather-refresh"
            type="button"
            disabled={loading || retrySeconds > 0}
            onClick={() => {
              force.current = true;
              setRefresh((n) => n + 1);
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            {loading
              ? t('weather.loading')
              : retrySeconds > 0
                ? t('weather.countdown', { seconds: retrySeconds })
                : t(problem ? 'weather.retry' : 'weather.refresh')}
          </button>
        </>
      )}
      <button
        type="button"
        className="weather-credit"
        aria-label={t('support.provider')}
        onClick={() => {
          setLinkError('');
          api.openHelpLink('weather').catch((reason) => {
            if (editing) setSaveError(errorMessage(reason));
            else setLinkError(errorMessage(reason));
          });
        }}
      >
        MET Norway · CC BY 4.0 <ExternalLink size={10} aria-hidden="true" />
      </button>
    </div>
  );
}
