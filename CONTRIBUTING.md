# Contributing to DarkDesk

Thanks for helping make desktop organization more useful and predictable.

## Before you start

Search [existing issues](https://github.com/Huseyinhk61/DarkDesk/issues) before opening a report. For a larger feature or native behavior change, describe the proposed workflow in an issue first. The [documentation](README.md#documentation) covers installation, file recovery, and platform limits.

The repository does not currently include a license. Public access lets you inspect the project; it does not grant a general open-source license. Resolve licensing with the owner before redistributing the app or contributing work that needs a specific license.

## Development

Use Node.js 24 LTS, npm, and a graphical desktop session:

```sh
git clone https://github.com/Huseyinhk61/DarkDesk.git
cd DarkDesk
npm ci
npm run desktop
```

Run commands in the directory containing `package.json`. `npm run dev` starts the browser preview with sample data; native operations require Electron.

Keep React components focused, put native behavior behind the restricted IPC bridge, and validate input in the main process. Interface strings belong in both `src/locales/en.json` and `src/locales/tr.json`. Reuse CSS theme variables and respect text scaling, reduced motion, keyboard focus, and light themes.

Changes to file organization must preserve conflict detection, content verification, persistent history, and safe undo. Test new scenarios with temporary fixtures.

## Checks

Run checks appropriate to the change:

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For native changes, run `npm run test:desktop` in a desktop session (`xvfb-run -a npm run test:desktop` on headless Linux). State which platform you tested; a Linux result does not establish that Windows-specific behavior works. Use `npx prettier --check <changed-files>` for supported source and documentation files.

## Pull requests

Explain the concrete problem, resulting behavior, and validation. Include screenshots for interface changes and describe settings migrations or compatibility effects. Keep unrelated refactors separate. Never include personal file contents, local operation history, credentials, or generated EXEs in a pull request.

For possible vulnerabilities, read [SECURITY.md](SECURITY.md) before sharing details.
