const { readIdentity } = require('./scripts/store-config.cjs');
const identity = readIdentity();
module.exports = {
  ...require('./package.json').build,
  directories: { output: 'release/store' },
  win: { target: [{ target: 'appx', arch: ['x64'] }], icon: 'build/icon.ico' },
  publish: null,
  appx: {
    ...identity,
    applicationId: 'DarkDesk',
    artifactName: 'DarkDesk-Store-${version}-${arch}.${ext}',
    minVersion: '10.0.19041.0',
    languages: ['tr-TR', 'en-US', 'de-DE', 'fr-FR', 'es-ES'],
    backgroundColor: '#0f1117',
    capabilities: ['internetClient'],
    addAutoLaunchExtension: false,
  },
};
