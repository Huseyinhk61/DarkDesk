import { useEffect, useState, useRef } from 'react';
import {
  CloudSun,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Settings2,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { weatherCities } from '../../shared/weather';
import { api } from '../service';
import { usePreferences } from '../preferences';
export default function WeatherWidget({ value, accept }) {
  const { t, locale, errorMessage } = usePreferences(),
    [editing, setEditing] = useState(!value.location),
    [draft, setDraft] = useState(value.location || weatherCities[0]),
    [unit, setUnit] = useState(value.unit),
    [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(false),
    [retryAt, setRetryAt] = useState(0),
    [now, setNow] = useState(Date.now),
    [saveError, setSaveError] = useState('');
  const force = useRef(false);
  const key = value.location ? `${value.location.latitude},${value.location.longitude}` : '';
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
    api
      .weatherQuote(value.location, { refresh: requested })
      .then((data) => {
        if (!active) return;
        setResult(data);
        timer = setTimeout(() => setRefresh((n) => n + 1), 900000);
      })
      .catch(() => {
        if (!active) return;
        setResult(null);
        setError(t('ux312.weatherUnavailable'));
        timer = setTimeout(() => setRefresh((n) => n + 1), 60000);
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
  const Icon =
    {
      clear: Sun,
      rain: CloudRain,
      snow: CloudSnow,
      thunder: CloudLightning,
      fog: CloudFog,
      cloudy: CloudSun,
    }[result?.category] || CloudSun;
  return (
    <div className="weather-widget" aria-busy={loading}>
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setSaveError('');
            try {
              accept(
                await api.saveWidgets({
                  weather: {
                    location: {
                      name: draft.name,
                      latitude: Number(draft.latitude),
                      longitude: Number(draft.longitude),
                    },
                    unit,
                  },
                }),
              );
              setEditing(false);
              setError('');
            } catch (reason) {
              setSaveError(errorMessage(reason));
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="weather-heading">
            <b>{t('ux312.weatherLocation')}</b>
            {value.location && (
              <button
                type="button"
                aria-label={t('common.cancel')}
                onClick={() => setEditing(false)}
              >
                <ArrowLeft size={15} />
              </button>
            )}
          </div>
          <select
            aria-label={t('ux312.weatherCity')}
            value={weatherCities.findIndex((c) => c.name === draft.name)}
            onChange={(e) => {
              const city = weatherCities[Number(e.target.value)];
              if (city) setDraft(city);
            }}
          >
            <option value="-1">{t('ux312.weatherCustom')}</option>
            {weatherCities.map((city, index) => (
              <option key={city.name} value={index}>
                {city.name}
              </option>
            ))}
          </select>
          <input
            required
            maxLength={80}
            aria-label={t('ux312.locationName')}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <div className="weather-coordinates">
            {['latitude', 'longitude'].map((axis, i) => (
              <label key={axis}>
                {t('ux312.' + axis)}
                <input
                  required
                  type="number"
                  step=".001"
                  min={i ? -180 : -90}
                  max={i ? 180 : 90}
                  value={draft[axis]}
                  onChange={(e) => setDraft({ ...draft, [axis]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="weather-heading">
            <select
              aria-label={t('ux312.temperatureUnit')}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="celsius">°C</option>
              <option value="fahrenheit">°F</option>
            </select>
            <button className="btn primary" disabled={saving}>
              {t('common.save')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="weather-heading">
            <b title={value.location?.name}>{value.location?.name}</b>
            <button
              aria-label={t('weather.settings')}
              onClick={() => {
                setDraft(value.location);
                setUnit(value.unit);
                setSaveError('');
                setEditing(true);
              }}
            >
              <Settings2 size={16} />
            </button>
          </div>
          {!error && (
            <>
              <div className="weather-temperature">
                <Icon size={36} />
                <strong>
                  {result
                    ? Math.round(
                        value.unit === 'fahrenheit'
                          ? result.temperature * 1.8 + 32
                          : result.temperature,
                      )
                    : '—'}
                  <small>°{value.unit === 'fahrenheit' ? 'F' : 'C'}</small>
                </strong>
              </div>
              <b>
                {result
                  ? t('ux312.weather.' + result.category)
                  : error
                    ? '—'
                    : t('launcherNext.fxLoading')}
              </b>
              <div className="weather-heading">
                <small>
                  {t('ux312.humidity')}: {result?.humidity ?? '—'}%
                </small>
                <small>
                  {t('ux312.wind')}: {result ? (result.wind * 3.6).toFixed(1) : '—'} km/h
                </small>
              </div>
              {result && (
                <small>
                  {t('weather.updated')} ·{' '}
                  {new Date(result.updatedAt || result.date).toLocaleString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {result.cached ? ' · ' + t('launcherNext.fxCached') : ''}
                </small>
              )}
            </>
          )}
          {error && (
            <div className="weather-offline">
              <CloudSun size={28} />
              <p role="alert">{error}</p>
            </div>
          )}
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
                : t(error ? 'weather.retry' : 'weather.refresh')}
          </button>
        </>
      )}
      {editing && saveError && (
        <p role="alert" className="widget-error">
          {saveError}
        </p>
      )}
      <small className="weather-credit">MET Norway · CC BY 4.0</small>
    </div>
  );
}
