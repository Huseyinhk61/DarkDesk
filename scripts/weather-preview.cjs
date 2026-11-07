const { WeatherService } = require('../electron/runtime/weather.cjs');
const { weatherFetch } = require('./weather-network.cjs');
// Development/preview only. The native app uses the same service through IPC.
// This endpoint is fixed to weather data; it is never an arbitrary URL proxy.
function weatherMiddleware(service = new WeatherService({ fetch: weatherFetch })) {
  return async (request, response, next) => {
    if (request.url?.split('?')[0] !== '/__darkdesk/weather') return next();
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    const send = (status, value) => {
      response.statusCode = status;
      response.end(JSON.stringify(value));
    };
    if (request.method !== 'POST') return send(405, { error: 'WEATHER_INVALID' });
    const origin = request.headers.origin;
    if (origin)
      try {
        if (new URL(origin).host !== request.headers.host)
          return send(403, { error: 'WEATHER_INVALID' });
      } catch {
        return send(403, { error: 'WEATHER_INVALID' });
      }
    if (Number(request.headers['content-length'] || 0) > 1024) {
      request.resume();
      return send(413, { error: 'WEATHER_INVALID' });
    }
    let bytes = 0;
    const chunks = [];
    try {
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 1024) return send(413, { error: 'WEATHER_INVALID' });
        chunks.push(chunk);
      }
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw Error('WEATHER_INVALID');
      const result = await service.quote(input.location, 'options' in input ? input.options : {});
      send(200, result);
    } catch (error) {
      const invalid = error instanceof SyntaxError || error.message === 'WEATHER_INVALID';
      send(invalid ? 400 : 503, { error: invalid ? 'WEATHER_INVALID' : 'WEATHER_UNAVAILABLE' });
    }
  };
}
function weatherPreview() {
  const middleware = weatherMiddleware();
  return {
    name: 'local-weather-preview',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
module.exports = { weatherMiddleware, weatherPreview };
