const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const { parse } = require('yaml');
const asar = require('@electron/asar');
const { version } = require('../package.json');
(async () => {
  const root = path.resolve(process.argv[2] || 'release'),
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-linux-verify-'));
  try {
    const appImage = path.join(root, `DarkDesk-${version}-x86_64.AppImage`),
      deb = path.join(root, `DarkDesk-${version}-amd64.deb`);
    const bytes = await fs.readFile(appImage);
    if (bytes.subarray(0, 4).toString('hex') !== '7f454c46') throw Error('Invalid AppImage ELF');
    const manifest = parse(await fs.readFile(path.join(root, 'latest-linux.yml'), 'utf8'));
    const expected = manifest.files.find((file) => file.url === path.basename(appImage));
    if (
      manifest.version !== version ||
      !expected ||
      expected.size !== bytes.length ||
      expected.sha512 !== crypto.createHash('sha512').update(bytes).digest('base64')
    )
      throw Error('Invalid Linux update metadata');
    const info = await exec('dpkg-deb', ['--field', deb, 'Version', 'Architecture'], {
      encoding: 'utf8',
    });
    if (!info.stdout.includes(version) || !info.stdout.includes('amd64'))
      throw Error('Invalid Debian metadata');
    await exec(appImage, ['--appimage-extract'], { cwd: temp, maxBuffer: 4 * 1024 * 1024 });
    await exec('dpkg-deb', ['-x', deb, path.join(temp, 'deb')]);
    const original = await fs.readFile(path.join(root, 'linux-unpacked/resources/app.asar'));
    for (const file of [
      path.join(temp, 'squashfs-root/resources/app.asar'),
      path.join(temp, 'deb/opt/DarkDesk/resources/app.asar'),
    ]) {
      const packed = await fs.readFile(file);
      if (!packed.equals(original)) throw Error('Linux package differs from tested ASAR');
      if (JSON.parse(asar.extractFile(file, 'package.json')).version !== version)
        throw Error('Wrong packaged version');
      for (const module of [
        'electron/runtime/currency.cjs',
        'electron/runtime/linux-apps.cjs',
        'dist/index.html',
      ])
        if (!asar.extractFile(file, module).length) throw Error('Missing module ' + module);
    }
    const sums = [];
    for (const name of [path.basename(appImage), path.basename(deb), 'latest-linux.yml'])
      sums.push(
        crypto
          .createHash('sha256')
          .update(await fs.readFile(path.join(root, name)))
          .digest('hex') +
          '  ' +
          name,
      );
    await fs.writeFile(path.join(root, 'LINUX_SHA256SUMS.txt'), sums.join('\n') + '\n');
    console.log(
      `PASS: Linux ${version} AppImage ELF, DEB metadata, update SHA-512 and identical packaged ASARs`,
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
