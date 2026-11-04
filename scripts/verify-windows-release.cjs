const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { parse } = require('yaml');
const { version } = require('../package.json');

(async () => {
  const directory = path.resolve(process.argv[2] || 'release');
  const metadata = parse(await fs.readFile(path.join(directory, 'latest.yml'), 'utf8'));
  if (metadata.version !== version || !Array.isArray(metadata.files) || !metadata.files.length)
    throw Error('Release version/metadata does not match package.json');
  const feed = parse(
    await fs.readFile(path.join(directory, 'win-unpacked/resources/app-update.yml'), 'utf8'),
  );
  if (
    feed.provider !== 'github' ||
    feed.owner !== 'Huseyinhk61' ||
    feed.repo !== 'DarkDesk' ||
    feed.private !== true ||
    'token' in feed
  )
    throw Error('Private update source configuration is invalid or contains a credential');
  const installer = `DarkDesk-Setup-${version}.exe`;
  if (metadata.path !== installer || !metadata.files.some((file) => file.url === installer))
    throw Error('Updater metadata must point to the NSIS setup installer');
  for (const file of metadata.files) {
    if (
      typeof file.url !== 'string' ||
      path.basename(file.url) !== file.url ||
      file.url !== installer
    )
      throw Error('Unexpected update artifact');
    const bytes = await fs.readFile(path.join(directory, file.url));
    if (
      bytes.toString('ascii', 0, 2) !== 'MZ' ||
      bytes.length !== file.size ||
      crypto.createHash('sha512').update(bytes).digest('base64') !== file.sha512
    )
      throw Error('Installer header, size or SHA-512 does not match update metadata');
  }
  for (const name of [`${installer}.blockmap`, `DarkDesk-Portable-${version}.exe`])
    if (!(await fs.stat(path.join(directory, name))).size)
      throw Error('Missing release artifact: ' + name);
  console.log(
    `Verified Windows ${version}: NSIS installer, portable, blockmap and update SHA-512.`,
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
