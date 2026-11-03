// Test-only entry point. Never included in distributed builds.
const { app } = require('electron');
const path = require('node:path');
if (!process.env.DARKDESK_TEST_ROOT) throw Error('Missing isolated test directory.');
app.setPath('desktop', path.join(process.env.DARKDESK_TEST_ROOT, 'Desktop'));
app.setPath('userData', path.join(process.env.DARKDESK_TEST_ROOT, 'data'));
process.argv.push('--production');
require('../../electron/main.cjs');
