const path = require('node:path');
const { spawnSync } = require('node:child_process');
function installEnvironment(source = process.env) {
  const env = { ...source };
  // Node 24's fetch must explicitly honor configured HTTP(S) proxies. Keep the
  // original proxy, CA and NO_PROXY values; never fall back to a direct route.
  if (source.HTTPS_PROXY || source.https_proxy || source.HTTP_PROXY || source.http_proxy)
    env.NODE_USE_ENV_PROXY = '1';
  return env;
}
if (require.main === module) {
  const result = spawnSync(
    process.execPath,
    [path.resolve(__dirname, '../node_modules/electron/install.js')],
    { stdio: 'inherit', env: installEnvironment() },
  );
  if (result.error) {
    console.error('Electron installation failed:', result.error.message);
    process.exitCode = 1;
  } else process.exitCode = result.status ?? 1;
}
module.exports = { installEnvironment };
