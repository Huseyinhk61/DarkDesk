// Test-only entry point. Never included in distributed builds.
const { app } = require('electron');
const path = require('node:path');
if (!process.env.DARKDESK_TEST_ROOT) throw Error('Missing isolated test directory.');
app.setPath('desktop', path.join(process.env.DARKDESK_TEST_ROOT, 'Desktop'));
app.setPath('downloads', path.join(process.env.DARKDESK_TEST_ROOT, 'Downloads'));
app.setPath('userData', path.join(process.env.DARKDESK_TEST_ROOT, 'data'));
process.argv.push('--production');
const base = process.env.DARKDESK_TEST_PACKAGE || path.resolve(__dirname, '../..');
const desktopPaths = require(path.join(base, 'electron/runtime/desktop-paths.cjs'));
desktopPaths.resolveSharedDesktop = async () =>
  path.join(process.env.DARKDESK_TEST_ROOT, 'Public Desktop');
const scanner = require(path.join(base, 'electron/scanner.cjs'));
const Original = scanner.DeepScanner;
scanner.DeepScanner = class extends Original {
  constructor(options) {
    super({
      ...options,
      roots: [
        { path: path.join(process.env.DARKDESK_TEST_ROOT, 'Program Files'), label: 'programFiles' },
      ],
    });
  }
};
const runtimes = require(path.join(base, 'electron/runtime/controller.cjs'));
const OriginalRuntime = runtimes.DesktopRuntime;
runtimes.DesktopRuntime = class extends OriginalRuntime {
  constructor(options) {
    super({
      ...options,
      launch: async (item) => {
        const fs = require('node:fs/promises');
        const gate = path.join(process.env.DARKDESK_TEST_ROOT, 'launch-gate');
        if (require('node:fs').existsSync(gate)) {
          await fs.writeFile(path.join(process.env.DARKDESK_TEST_ROOT, 'launch-started'), item.id);
          const deadline = Date.now() + 15000;
          while (require('node:fs').existsSync(gate)) {
            if (Date.now() > deadline) throw Error('TEST_LAUNCH_GATE_TIMEOUT');
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        }
        await fs.writeFile(
          path.join(process.env.DARKDESK_TEST_ROOT, 'launch-log.json'),
          JSON.stringify({ id: item.id, source: item.source }),
        );
      },
    });
  }
  async initialize() {
    await super.initialize();
    clearInterval(this.timer);
  }
};
require(path.join(base, 'electron/main.cjs'));
