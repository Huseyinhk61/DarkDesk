// Test-only entry point. Never included in distributed builds.
const { app } = require('electron');
const path = require('node:path');
if (!process.env.DARKDESK_TEST_ROOT) throw Error('Missing isolated test directory.');
app.setPath('desktop', path.join(process.env.DARKDESK_TEST_ROOT, 'Desktop'));
app.setPath('userData', path.join(process.env.DARKDESK_TEST_ROOT, 'data'));
process.argv.push('--production');
const base = process.env.DARKDESK_TEST_PACKAGE || path.resolve(__dirname, '../..');
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
require(path.join(base, 'electron/main.cjs'));
