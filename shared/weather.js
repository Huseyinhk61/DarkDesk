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
].map(([name, latitude, longitude]) => ({ name, latitude, longitude }));
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
  }
  return { location, unit: value.unit };
}
export function weatherCategory(symbol = '') {
  if (/thunder/.test(symbol)) return 'thunder';
  if (/snow|sleet/.test(symbol)) return 'snow';
  if (/rain/.test(symbol)) return 'rain';
  if (/fog/.test(symbol)) return 'fog';
  if (/clearsky/.test(symbol)) return 'clear';
  return 'cloudy';
}
export function validateWeatherResponse(data, now = Date.now()) {
  const entry = data?.properties?.timeseries?.find((row) => {
    const time = Date.parse(row?.time);
    return Number.isFinite(time) && time >= now - 3 * 3600000 && time <= now + 3600000;
  });
  const d = entry?.data?.instant?.details,
    date = entry?.time;
  if (
    !d ||
    !Number.isFinite(d.air_temperature) ||
    Math.abs(d.air_temperature) > 100 ||
    !Number.isFinite(d.relative_humidity) ||
    d.relative_humidity < 0 ||
    d.relative_humidity > 100 ||
    !Number.isFinite(d.wind_speed) ||
    d.wind_speed < 0 ||
    d.wind_speed > 200
  )
    throw Error('WEATHER_UNAVAILABLE');
  return {
    temperature: d.air_temperature,
    humidity: d.relative_humidity,
    wind: d.wind_speed,
    date,
    category: weatherCategory(
      entry.data.next_1_hours?.summary?.symbol_code ||
        entry.data.next_6_hours?.summary?.symbol_code,
    ),
    provider: 'MET Norway',
  };
}
