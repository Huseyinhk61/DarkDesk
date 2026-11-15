# Developing DarkDesk

These instructions are for developers. For a normal installation, use the [download page](https://github.com/Huseyinhk61/DarkDesk/releases/latest).

## Set up a checkout

Use **Node.js 24 LTS** (Node.js 22.12+ is supported), npm, and a graphical desktop session.

```sh
git clone https://github.com/Huseyinhk61/DarkDesk.git
cd DarkDesk
npm ci
npm run desktop
```

Run these commands **inside the folder containing `package.json`**. Running npm from your user home folder causes an `ENOENT` / missing `package.json` error.

Without Git, [download the source ZIP](https://github.com/Huseyinhk61/DarkDesk/archive/refs/heads/main.zip), extract it, and open a terminal inside `DarkDesk-main`. On Windows, `DarkDesk-Baslat.cmd` can install dependencies and start the app from that folder.

To preview the interface in a browser:

```sh
npm run dev
```

Open the address printed by Vite. **Browser mode uses sample data and cannot organize real desktop files.** Use `npm run desktop` for native operations.

### Managed proxies

With Node.js 24, enable environment-proxy support **before** installing dependencies. Electron's own dependency install runs before the project's postinstall hook:

```sh
NODE_USE_ENV_PROXY=1 npm ci
```

PowerShell:

```powershell
$env:NODE_USE_ENV_PROXY = '1'
npm ci
```

Keep your administrator-provided `HTTPS_PROXY`, `NO_PROXY` and CA settings. This does not grant access to blocked hosts; the effective network policy must allow the required downloads. If dependencies are already installed but Electron's binary is missing, `npm run postinstall` retries its download with the configured proxy.

### Build and test

| Command                                | Purpose                                                                                                   |
| :------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| `npm run build`                        | Build the production interface.                                                                           |
| `npm test`                             | Run service, model, and settings tests with temporary files.                                              |
| `npm run test:e2e`                     | Run Chromium interface scenarios with Playwright.                                                         |
| `npm run test:desktop`                 | Exercise real Electron IPC against an isolated desktop.                                                   |
| `node scripts/widget-native-smoke.cjs` | Check real widget windows, their restricted IPC, persistence, and native bindings in an isolated fixture. |
| `npm run check`                        | Run service tests, production build, and browser tests.                                                   |
| `npm run dist:win`                     | Build Setup and Portable EXEs into `release/`.                                                            |
| `npm run dist:linux`                   | Build a Linux AppImage into `release/`.                                                                   |

Install Chromium once with `npx playwright install chromium` before browser tests. Headless Linux requires `xvfb-run -a npm run test:desktop` for native tests. The [validation report](VALIDATION.md) records test results and platform-specific limits; cross-built EXEs have been checked for integrity, but a live Windows install/upgrade has not been verified in the Linux development environment.

## Store publishing

See [MICROSOFT_STORE.md](MICROSOFT_STORE.md) for the separate publisher-only AppX build, identity and package validation. Store submission files are not the normal end-user installer.
