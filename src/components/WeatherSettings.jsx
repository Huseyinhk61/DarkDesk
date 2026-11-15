import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { weatherCities, weatherTimeZone } from '../../shared/weather';
import { usePreferences } from '../preferences';
export default function WeatherSettings({ value, busy, error, onSave, onClose }) {
  const { t } = usePreferences();
  const [page, setPage] = useState('city');
  const [draft, setDraft] = useState(() => ({
    ...(value.location || weatherCities[0]),
    timeZone: weatherTimeZone(value.location || weatherCities[0]),
  }));
  const [unit, setUnit] = useState(value.unit);
  const zones = [
    ...new Set([
      draft.timeZone,
      'UTC',
      ...(Intl.supportedValuesOf?.('timeZone') || weatherCities.map((city) => city.timeZone)),
    ]),
  ];
  const index = weatherCities.findIndex(
    (city) =>
      Math.abs(city.latitude - Number(draft.latitude)) < 0.00001 &&
      Math.abs(city.longitude - Number(draft.longitude)) < 0.00001,
  );
  return (
    <form
      className="weather-settings"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          location: {
            ...draft,
            latitude: Number(draft.latitude),
            longitude: Number(draft.longitude),
          },
          unit,
        });
      }}
    >
      <div className="weather-heading">
        <b>{t('weather.settings')}</b>
        {onClose && (
          <button type="button" aria-label={t('common.cancel')} onClick={onClose}>
            <ArrowLeft size={15} />
          </button>
        )}
      </div>
      <div
        className="weather-setting-pages"
        role="group"
        aria-label={t('weather313.locationViews')}
      >
        {['city', 'coordinates'].map((id) => (
          <button key={id} type="button" aria-pressed={page === id} onClick={() => setPage(id)}>
            {t('weather313.' + id)}
          </button>
        ))}
      </div>
      {page === 'city' ? (
        <div className="weather-city-settings">
          <label>
            {t('ux312.weatherCity')}
            <select
              aria-label={t('ux312.weatherCity')}
              value={index}
              onChange={(event) => {
                const city = weatherCities[Number(event.target.value)];
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
          </label>
          <p className="weather-settings-hint">{t('weather313.cityHelp')}</p>
          <small className="weather-zone-label">{draft.timeZone}</small>
        </div>
      ) : (
        <div className="weather-coordinate-settings">
          <input
            required
            maxLength={80}
            aria-label={t('ux312.locationName')}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
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
                  onChange={(event) => setDraft({ ...draft, [axis]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <select
            aria-label={t('weather313.timeZone')}
            value={draft.timeZone}
            onChange={(event) => setDraft({ ...draft, timeZone: event.target.value })}
          >
            {zones.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p className="widget-error" role="alert">
          {error}
        </p>
      )}
      <div className="weather-heading weather-settings-actions">
        <select
          aria-label={t('ux312.temperatureUnit')}
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
        >
          <option value="celsius">°C</option>
          <option value="fahrenheit">°F</option>
        </select>
        <button className="btn primary" disabled={busy}>
          {t('common.save')}
        </button>
      </div>
    </form>
  );
}
