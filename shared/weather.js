export const weatherCities = [
  ['İstanbul', 41.01, 28.98],
  ['Ankara', 39.93, 32.86],
  ['İzmir', 38.42, 27.14],
  ['Bursa', 40.19, 29.06],
  ['Antalya', 36.9, 30.7],
  ['Trabzon', 41.0, 39.72],
  ['Adana', 37.0, 35.32],
  ['Konya', 37.87, 32.49],
  ['Gaziantep', 37.07, 37.38],
  ['Kayseri', 38.72, 35.48],
  ['Eskişehir', 39.77, 30.52],
  ['Samsun', 41.29, 36.33],
  ['Diyarbakır', 37.91, 40.24],
  ['Erzurum', 39.9, 41.27],
  ['London', 51.51, -0.13],
  ['Berlin', 52.52, 13.41],
  ['Paris', 48.86, 2.35],
  ['Madrid', 40.42, -3.7],
  ['Rome', 41.9, 12.5],
  ['Amsterdam', 52.37, 4.9],
  ['Oslo', 59.91, 10.75],
  ['New York', 40.71, -74.01],
  ['Los Angeles', 34.05, -118.24],
  ['Toronto', 43.65, -79.38],
  ['Tokyo', 35.68, 139.69],
  ['Seoul', 37.57, 126.98],
  ['Singapore', 1.35, 103.82],
  ['Sydney', -33.87, 151.21],
  ['Dubai', 25.2, 55.27],
  ['São Paulo', -23.55, -46.63],
  ['Cairo', 30.04, 31.24],
  ['Mumbai', 19.08, 72.88],
  ['Cape Town', -33.92, 18.42],
].map(([name, latitude, longitude], index) => ({
  name,
  latitude,
  longitude,
  timeZone:
    index < 14
      ? 'Europe/Istanbul'
      : [
          'Europe/London',
          'Europe/Berlin',
          'Europe/Paris',
          'Europe/Madrid',
          'Europe/Rome',
          'Europe/Amsterdam',
          'Europe/Oslo',
          'America/New_York',
          'America/Los_Angeles',
          'America/Toronto',
          'Asia/Tokyo',
          'Asia/Seoul',
          'Asia/Singapore',
          'Australia/Sydney',
          'Asia/Dubai',
          'America/Sao_Paulo',
          'Africa/Cairo',
          'Asia/Kolkata',
          'Africa/Johannesburg',
        ][index - 14],
}));
export function validWeatherTimeZone(value) {
  if (typeof value !== 'string' || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function weatherTimeZone(location) {
  if (validWeatherTimeZone(location?.timeZone)) return location.timeZone;
  const city = weatherCities.find(
    (city) =>
      Math.abs(city.latitude - location?.latitude) < 0.001 &&
      Math.abs(city.longitude - location?.longitude) < 0.001,
  );
  return city?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
export function normalizeWeather(value = { location: null, unit: 'celsius' }) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !['celsius', 'fahrenheit'].includes(value.unit)
  )
    throw Error('WEATHER_INVALID');
  let location = null;
  if (value.location !== null) {
    const l = value.location;
    if (
      !l ||
      typeof l.name !== 'string' ||
      !l.name.trim() ||
      l.name.length > 80 ||
      /[\x00-\x1f]/.test(l.name) ||
      !Number.isFinite(l.latitude) ||
      Math.abs(l.latitude) > 90 ||
      !Number.isFinite(l.longitude) ||
      Math.abs(l.longitude) > 180
    )
      throw Error('WEATHER_INVALID');
    location = {
      name: l.name.trim(),
      latitude: Number(l.latitude.toFixed(3)),
      longitude: Number(l.longitude.toFixed(3)),
    };
    if (l.timeZone !== undefined) {
      if (!validWeatherTimeZone(l.timeZone)) throw Error('WEATHER_INVALID');
      location.timeZone = l.timeZone;
    }
  }
  return { location, unit: value.unit };
}
export function weatherCategory(symbol = '') {
  if (/thunder/.test(symbol)) return 'thunder';
  if (/snow|sleet/.test(symbol)) return 'snow';
  if (/rain/.test(symbol)) return 'rain';
  if (/fog/.test(symbol)) return 'fog';
  if (/clearsky/.test(symbol)) return 'clear';
  if (/fair|partlycloudy/.test(symbol)) return 'partly';
  return /cloudy/.test(symbol) ? 'cloudy' : 'unknown';
}
const metric = (value, min, max) =>
  Number.isFinite(value) && value >= min && value <= max ? value : null;
export function feelsLikeEstimate(temperature, humidity, wind) {
  if (!Number.isFinite(temperature) || !Number.isFinite(humidity) || !Number.isFinite(wind))
    return null;
  let value = temperature;
  const speed = wind * 3.6;
  if (temperature <= 10 && speed > 4.8)
    value =
      13.12 + 0.6215 * temperature - 11.37 * speed ** 0.16 + 0.3965 * temperature * speed ** 0.16;
  else if (temperature >= 27 && humidity >= 40) {
    const f = temperature * 1.8 + 32,
      h = humidity;
    value =
      (-42.379 +
        2.04901523 * f +
        10.14333127 * h -
        0.22475541 * f * h -
        0.00683783 * f * f -
        0.05481717 * h * h +
        0.00122874 * f * f * h +
        0.00085282 * f * h * h -
        0.00000199 * f * f * h * h -
        32) /
      1.8;
  }
  return metric(value, -120, 100);
}
function weatherSample(row) {
  const date = Date.parse(row?.time),
    d = row?.data?.instant?.details;
  if (!Number.isFinite(date) || !d || metric(d.air_temperature, -100, 100) === null) return null;
  const windows = [
    [1, row.data.next_1_hours],
    [6, row.data.next_6_hours],
    [12, row.data.next_12_hours],
  ];
  const [precipitationHours, period] = windows.find(([, value]) => value) || [null, null];
  const symbol = typeof period?.summary?.symbol_code === 'string' ? period.summary.symbol_code : '';
  return {
    date: new Date(date).toISOString(),
    temperature: d.air_temperature,
    humidity: metric(d.relative_humidity, 0, 100),
    wind: metric(d.wind_speed, 0, 200),
    gust: metric(d.wind_speed_of_gust, 0, 200),
    windDirection: metric(d.wind_from_direction, 0, 360),
    pressure: metric(d.air_pressure_at_sea_level, 500, 1200),
    cloudCover: metric(d.cloud_area_fraction, 0, 100),
    precipitation: metric(period?.details?.precipitation_amount, 0, 1000),
    precipitationHours,
    precipitationProbability: metric(period?.details?.probability_of_precipitation, 0, 100),
    category: weatherCategory(symbol),
    isDay: symbol.endsWith('_night') ? false : symbol.endsWith('_day') ? true : null,
  };
}
export function validateWeatherResponse(data, now = Date.now()) {
  const rows = data?.properties?.timeseries;
  if (!Array.isArray(rows) || !rows.length || rows.length > 2000)
    throw Error('WEATHER_UNAVAILABLE');
  const samples = [
    ...new Map(
      rows
        .map(weatherSample)
        .filter(Boolean)
        .filter((row) => {
          const time = Date.parse(row.date);
          return time >= now - 3 * 3600000 && time <= now + 6 * 86400000;
        })
        .map((row) => [row.date, row]),
    ).values(),
  ].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const current = samples
    .filter((row) => Date.parse(row.date) <= now + 3600000)
    .sort((a, b) => Math.abs(Date.parse(a.date) - now) - Math.abs(Date.parse(b.date) - now))[0];
  if (!current || current.humidity === null || current.wind === null)
    throw Error('WEATHER_UNAVAILABLE');
  const issuedAt = Date.parse(data.properties.meta?.updated_at);
  return {
    ...current,
    feelsLike: feelsLikeEstimate(current.temperature, current.humidity, current.wind),
    forecast: samples.filter((row) => Date.parse(row.date) >= now - 3600000),
    issuedAt:
      Number.isFinite(issuedAt) && issuedAt <= now + 3600000
        ? new Date(issuedAt).toISOString()
        : null,
    provider: 'MET Norway',
  };
}
function localDay(time, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time));
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type).value)
    .join('-');
}
export function dailyWeatherForecast(forecast, timeZone, now = Date.now()) {
  const zone = validWeatherTimeZone(timeZone) ? timeZone : 'UTC',
    today = localDay(now, zone),
    groups = new Map();
  for (const row of Array.isArray(forecast) ? forecast : []) {
    if (
      !Number.isFinite(Date.parse(row.date)) ||
      !Number.isFinite(row.temperature) ||
      Date.parse(row.date) < now - 3600000 ||
      Date.parse(row.date) > now + 6 * 86400000
    )
      continue;
    const day = localDay(row.date, zone);
    if (day < today) continue;
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(row);
  }
  const hour = new Intl.DateTimeFormat('en', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 5)
    .map(([day, rows]) => {
      const representative = [...rows].sort(
        (a, b) =>
          Math.abs(Number(hour.format(new Date(a.date))) - 12) -
          Math.abs(Number(hour.format(new Date(b.date))) - 12),
      )[0];
      return {
        day,
        date: representative.date,
        minimum: Math.min(...rows.map((row) => row.temperature)),
        maximum: Math.max(...rows.map((row) => row.temperature)),
        category: representative.category,
        samples: rows.length,
        partial: day === today,
      };
    });
}
