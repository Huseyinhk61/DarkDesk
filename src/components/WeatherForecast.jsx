import { useMemo, useState } from 'react';
import {
  Sun,
  Moon,
  CloudSun,
  Cloud,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Wind,
  Droplets,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { dailyWeatherForecast } from '../../shared/weather';
import { usePreferences } from '../preferences';
export function WeatherIcon({ category, isDay, size = 24, ...props }) {
  const Icon =
    {
      clear: isDay === false ? Moon : Sun,
      partly: isDay === false ? CloudMoon : CloudSun,
      rain: CloudRain,
      snow: CloudSnow,
      thunder: CloudLightning,
      fog: CloudFog,
      cloudy: Cloud,
    }[category] || Cloud;
  return <Icon size={size} aria-hidden="true" {...props} />;
}
export function temperature(value, unit) {
  return Number.isFinite(value)
    ? Math.round(unit === 'fahrenheit' ? value * 1.8 + 32 : value)
    : null;
}
export default function WeatherForecast({ view, result, unit, timeZone, now }) {
  const { t, locale } = usePreferences(),
    [requested, setRequested] = useState(0);
  const number = (value) =>
    Number.isFinite(value)
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
      : '—';
  const temp = (value) =>
    temperature(value, unit) === null ? '—' : temperature(value, unit) + '°';
  const hour = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [locale, timeZone],
  );
  const rows = useMemo(
    () =>
      (result?.forecast || [])
        .filter(
          (row) => Date.parse(row.date) >= now - 3600000 && Date.parse(row.date) <= now + 86400000,
        )
        .slice(0, 24),
    [result, Math.floor(now / 60000)],
  );
  const days = useMemo(
    () => dailyWeatherForecast(result?.forecast, timeZone, now),
    [result, timeZone, Math.floor(now / 60000)],
  );
  const pages = Math.max(1, Math.ceil(rows.length / 4)),
    page = Math.min(requested, pages - 1);
  if (view === 'hourly')
    return rows.length ? (
      <div className="weather-hourly-view">
        <div className="weather-hourly-grid">
          {rows.slice(page * 4, page * 4 + 4).map((row) => (
            <article
              className="weather-hour"
              key={row.date}
              title={new Date(row.date).toLocaleString(locale, { timeZone, timeZoneName: 'short' })}
            >
              <time dateTime={row.date}>{hour.format(new Date(row.date))}</time>
              <WeatherIcon category={row.category} isDay={row.isDay} size={20} />
              <strong>{temp(row.temperature)}</strong>
              <small title={t('weather313.rainPeriod', { hours: row.precipitationHours || '—' })}>
                <Droplets size={10} />
                {number(row.precipitation)} mm
              </small>
            </article>
          ))}
        </div>
        <div className="widget-page-controls">
          <button
            type="button"
            aria-label={t('ux311.previous')}
            disabled={!page}
            onClick={() => setRequested(page - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          <small>
            {page + 1} / {pages}
          </small>
          <button
            type="button"
            aria-label={t('ux311.next')}
            disabled={page >= pages - 1}
            onClick={() => setRequested(page + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    ) : (
      <p className="weather-view-empty">{t('weather313.noForecast')}</p>
    );
  if (view === 'daily')
    return days.length ? (
      <div className="weather-days" aria-label={t('weather313.rangeHelp')}>
        {days.map((day) => (
          <article className="weather-day" key={day.day} title={t('weather313.rangeHelp')}>
            <time dateTime={day.day}>
              {day.partial
                ? t('weather313.today') + '*'
                : new Date(day.date).toLocaleDateString(locale, { timeZone, weekday: 'short' })}
            </time>
            <WeatherIcon category={day.category} size={16} />
            <span>{temp(day.minimum)}</span>
            <strong>{temp(day.maximum)}</strong>
          </article>
        ))}
      </div>
    ) : (
      <p className="weather-view-empty">{t('weather313.noForecast')}</p>
    );
  if (view === 'details')
    return (
      <dl className="weather-details">
        {[
          ['humidity', number(result?.humidity) + '%'],
          ['pressure', number(result?.pressure) + ' hPa'],
          [
            'gust',
            number(
              result?.gust === null || !Number.isFinite(result?.gust) ? null : result.gust * 3.6,
            ) + ' km/h',
          ],
          [
            'direction',
            Number.isFinite(result?.windDirection)
              ? t(
                  'weather313.compass.' +
                    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][
                      Math.round(result.windDirection / 45) % 8
                    ],
                )
              : '—',
          ],
          ['clouds', number(result?.cloudCover) + '%'],
          ['probability', number(result?.precipitationProbability) + '%'],
        ].map(([id, value]) => (
          <div key={id}>
            <dt>{t('weather313.' + id)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <div className="weather-current-view">
      <div className="weather-hero">
        <div className="weather-temperature">
          <WeatherIcon category={result?.category} isDay={result?.isDay} size={38} />
          <strong>
            {temp(result?.temperature)}
            <small>{unit === 'fahrenheit' ? 'F' : 'C'}</small>
          </strong>
        </div>
        <span className="weather-condition">
          {result ? t('ux312.weather.' + result.category) : t('weather.loading')}
        </span>
        {Number.isFinite(result?.feelsLike) && (
          <small className="weather-feels" title={t('weather313.feelsHelp')}>
            {t('weather313.feels')}: {temp(result.feelsLike)}
          </small>
        )}
      </div>
      <div className="weather-summary-metrics">
        <span>
          <Wind size={13} />
          {number(Number.isFinite(result?.wind) ? result.wind * 3.6 : null)} km/h
        </span>
        <span title={t('weather313.rainPeriod', { hours: result?.precipitationHours || '—' })}>
          <Droplets size={13} />
          {number(result?.precipitation)} mm
        </span>
      </div>
    </div>
  );
}
