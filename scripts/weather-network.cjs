// Respect the developer machine's existing proxy/NO_PROXY settings. A proxy
// requirement is never silently replaced with a direct outbound connection.
let configured = false;
async function weatherFetch(url, options) {
  if (
    !configured &&
    (process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy)
  ) {
    const configure = require('node:http').setGlobalProxyFromEnv;
    if (typeof configure !== 'function')
      throw Error('WEATHER_PROXY_UNSUPPORTED: use current Node 24 for proxied preview tests');
    configure(process.env);
    configured = true;
  }
  return globalThis.fetch(url, options);
}
module.exports = { weatherFetch };
