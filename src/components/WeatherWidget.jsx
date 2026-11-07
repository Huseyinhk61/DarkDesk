import { useEffect, useState } from 'react';
import {
  CloudSun,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Settings2,
  ArrowLeft,
} from 'lucide-react';
import { weatherCities } from '../../shared/weather';
import { api } from '../service';
import { usePreferences } from '../preferences';
export default function WeatherWidget({ value, accept }) {
  const { t, locale } = usePreferences(),
    [editing, setEditing] = useState(!value.location),
    [draft, setDraft] = useState(value.location || weatherCities[0]),
    [unit, setUnit] = useState(value.unit),
    [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [refresh, setRefresh] = useState(0);
  const key = value.location ? `${value.location.latitude},${value.location.longitude}` : '';
  useEffect(() => {
    let active = true;
    setResult(null);
    setError('');
    if (!value.location) return;
    api
      .weatherQuote(value.location)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch(() => {
        if (active) setError(t('ux312.weatherUnavailable'));
      });
    const update = () => {
      if (!document.hidden) setRefresh((n) => n + 1);
    };
    const timer = setInterval(update, 900000);
    document.addEventListener('visibilitychange', update);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [key, refresh, t]);
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
    <div className="weather-widget">
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
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
            } catch {
              setError(t('ux312.weatherInvalid'));
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
              aria-label={t('focusPlus.settings')}
              onClick={() => {
                setDraft(value.location);
                setUnit(value.unit);
                setEditing(true);
              }}
            >
              <Settings2 size={16} />
            </button>
          </div>
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
              {t('ux312.forecast')} ·{' '}
              {new Date(result.date).toLocaleString(locale, { hour: '2-digit', minute: '2-digit' })}
              {result.cached ? ' · ' + t('launcherNext.fxCached') : ''}
            </small>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="widget-error">
          {error}
        </p>
      )}
      <small className="weather-credit">MET Norway · CC BY 4.0</small>
    </div>
  );
}
