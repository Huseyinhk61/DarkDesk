const { test } = require('node:test');
const assert = require('node:assert/strict');
const { launcherTool } = require('../shared/launcher-tools.js');
test('explicit calc uses the bounded arithmetic parser without changing implicit tools', () => {
  for (const [query, value] of [
    ['calc 120 * 45', 5400],
    ['CALC (2+3)^2', 25],
    ['calc = 1,5 × 4', 6],
  ]) {
    const result = launcherTool(query, 'tr-TR');
    assert.equal(result.status, 'success');
    assert.equal(result.value, value);
    assert.equal(result.explicitPrefix, 'calc');
  }
  assert.equal(launcherTool('calc').status, 'incomplete');
  assert.equal(launcherTool('calc 2 +').status, 'incomplete');
  assert.equal(launcherTool('calc globalThis.process.exit()').error, 'INVALID_EXPRESSION');
  assert.equal(launcherTool('calc 1/0').error, 'DIVISION_BY_ZERO');
  assert.equal(launcherTool('calc ' + '1'.repeat(513)).error, 'INPUT_TOO_LONG');
  assert.equal(launcherTool('120 * 45').value, 5400);
  assert.equal(launcherTool('10 km to m').value, 10000);
  assert.equal(launcherTool('Calculator.exe'), null);
});
test('sys aliases produce intentions only and partial commands remain non-executable', () => {
  for (const [query, id] of [
    ['sys lock', 'lock'],
    ['sys ekranı kilitle', 'lock'],
    ['SYS kilitle', 'lock'],
    ['sys kapat', 'shutdown'],
    ['sys shut down', 'shutdown'],
    ['sys çöpü boşalt', 'empty-trash'],
    ['sys cop kutusunu bosalt', 'empty-trash'],
    ['sys sessiz', 'mute'],
    ['sys sesi aç', 'unmute'],
  ]) {
    const result = launcherTool(query);
    assert.equal(result.type, 'system');
    assert.equal(result.system, id);
    assert.equal(result.status, 'success');
    assert.equal(result.command, undefined);
  }
  assert.equal(launcherTool('sys').matches.length, 12);
  assert.ok(launcherTool('sys').matches.includes('screenshot'));
  assert.equal(launcherTool('sys').status, 'incomplete');
  assert.ok(launcherTool('sys s').matches.includes('shutdown'));
  assert.ok(launcherTool('sys s').matches.includes('volume-down'));
  assert.equal(launcherTool('sys s').system, undefined);
  assert.equal(launcherTool('sys arbitrary.exe').error, 'UNKNOWN_SYSTEM_COMMAND');
  assert.equal(launcherTool('sys lock; shutdown').error, 'UNKNOWN_SYSTEM_COMMAND');
  assert.equal(launcherTool('sys ' + 'a'.repeat(513)).error, 'INPUT_TOO_LONG');
  assert.equal(launcherTool('system.exe'), null);
});
