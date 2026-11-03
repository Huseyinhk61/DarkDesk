const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  appKnowledge,
  findKnownApp,
  appInsight,
  normalizeAppName,
} = require('../shared/app-insights.js');
const { classify, defaultCategory, enrichItem, defaultSettings } = require('../shared/domain.js');
const settings = () => structuredClone(defaultSettings);

test('common Windows executable names and renamed shortcuts identify useful app purposes', () => {
  for (const [name, appId, group] of [
    ['msedge.exe', 'edge', 'systemnetwork'],
    ['winword.exe', 'word', 'office'],
    ['powerpnt.exe', 'powerpoint', 'office'],
    ['EpicGamesLauncher.exe', 'epic', 'games'],
    ['RiotClientServices.exe', 'riot', 'games'],
    ['EADesktop.exe', 'ea', 'games'],
    ['devenv.exe', 'visualstudio', 'softwareide'],
    ['Docker Desktop.exe', 'docker', 'softwaredevops'],
    ['AfterFX.exe', 'aftereffects', 'design'],
    ['resolve.exe', 'davinci', 'design'],
    ['obs64.exe', 'obs', 'media'],
    ['7zFM.exe', '7zip', 'systemcompression'],
    ['SnippingTool.exe', 'snipping', 'systemutilities'],
    ['notepad.exe', 'notepad', 'office'],
  ]) {
    const item = { name, id: name };
    const enriched = enrichItem(item);
    assert.equal(enriched.insight.appId, appId, name);
    assert.equal(enriched.category, group, name);
    assert.ok(enriched.insight.description.tr.length > 35);
    assert.ok(enriched.insight.description.en.length > 35);
    assert.equal(enriched.insight.source, 'local-catalog');
    assert.equal(enriched.suggestion, null);
  }
  const renamed = enrichItem({
    id: 'Web.lnk',
    name: 'Web.lnk',
    target: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  assert.equal(renamed.insight.appId, 'chrome');
  assert.equal(renamed.category, 'systemnetwork');
});
test('matching normalizes shortcut suffixes, copies, Turkish letters and quoted executable paths', () => {
  assert.equal(findKnownApp({ name: 'Visual Studio Code - Kısayol (2).lnk' }).id, 'vscode');
  assert.equal(findKnownApp({ name: 'EKRAN ALINTISI ARACI.lnk' }).id, 'snipping');
  assert.equal(
    findKnownApp({
      name: 'Browser.lnk',
      target:
        '"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" --profile-directory=Default',
    }).id,
    'edge',
  );
  assert.equal(normalizeAppName('Microsoft Edge.exe.lnk'), 'microsoft edge');
});
test('documents and incidental installation folders cannot impersonate catalog applications', () => {
  for (const name of ['Chrome plan.pdf', 'Steam notes.txt', 'Word.png', 'Photoshop invoice.docx']) {
    assert.equal(findKnownApp({ name }), null, name);
    assert.equal(appInsight({ name }, 'office').appId, null, name);
  }
  assert.equal(classify({ name: 'Chrome plan.pdf' }), 'office');
  assert.equal(classify({ name: 'Photoshop invoice.docx' }), 'office');
  assert.equal(classify({ name: 'Word.png' }), 'design');
  assert.equal(
    findKnownApp({ name: 'worker.exe', target: 'D:\\SteamLibrary\\steamapps\\worker.exe' }),
    null,
  );
  assert.equal(
    classify({ name: 'worker.exe', target: 'D:\\SteamLibrary\\steamapps\\worker.exe' }),
    'system',
  );
  assert.equal(
    findKnownApp({
      name: 'Chrome.lnk',
      target: 'C:\\Chrome\\Update\\updater.exe',
      productName: 'Google Chrome',
    }),
    null,
  );
});
test('trusted target names take precedence over conflicting shortcut labels', () => {
  assert.equal(findKnownApp({ name: 'Word.lnk', target: 'C:\\Office\\EXCEL.EXE' }).id, 'excel');
  assert.equal(
    findKnownApp({
      name: 'Launch.lnk',
      target: 'C:\\Unknown\\launcher.exe',
      productName: 'Adobe Photoshop',
    }).id,
    'photoshop',
  );
});
test('launch hosts cannot replace the purpose of their shortcut or claim an unknown app', () => {
  assert.equal(
    findKnownApp({ name: 'Minecraft.lnk', target: 'C:\\Steam\\steam.exe' }).id,
    'minecraft',
  );
  assert.equal(
    findKnownApp({ name: 'Spotify.lnk', target: 'C:\\Windows\\explorer.exe' }).id,
    'spotify',
  );
  assert.equal(findKnownApp({ name: 'Unknown Game.lnk', target: 'C:\\Steam\\steam.exe' }), null);
  assert.equal(
    findKnownApp({ name: 'Unknown Utility.lnk', target: 'C:\\Windows\\System32\\cmd.exe' }),
    null,
  );
  assert.equal(
    findKnownApp({ name: 'Unknown App.lnk', target: 'C:\\Windows\\explorer.exe' }),
    null,
  );
  assert.equal(
    findKnownApp({ name: 'PowerShell.lnk', target: 'C:\\Windows\\System32\\powershell.exe' }).id,
    'powershell',
  );
  assert.equal(findKnownApp({ name: 'Steam.exe' }).id, 'steam');
  const unknown = enrichItem({
    id: 'game',
    name: 'Unknown Game.lnk',
    target: 'C:\\Steam\\steam.exe',
  });
  assert.equal(unknown.category, 'games');
  assert.equal(unknown.insight.confidence, 'inferred');
});
test('manual assignments and ordered user rules retain priority over known-app categories', () => {
  const value = settings(),
    item = { id: 'code', name: 'Code.exe' };
  value.rules = [
    { id: 'r', pattern: '.exe', match: 'extension', categoryId: 'archive', enabled: true },
  ];
  assert.equal(classify(item, value), 'archive');
  value.overrides.code = 'office';
  const result = enrichItem(item, value);
  assert.equal(result.category, 'office');
  assert.equal(result.insight.appId, 'vscode');
  assert.equal(result.insight.confidence, 'known');
  const withoutSubgroups = settings();
  withoutSubgroups.categories = withoutSubgroups.categories.filter((c) => !c.parentId);
  assert.equal(classify(item, withoutSubgroups), 'software');
  assert.equal(defaultCategory(item.name), 'software');
});
test('unknown purposes are transparent estimates and do not claim app-specific information', () => {
  const unknown = appInsight({ name: 'UnknownTool.exe' }, 'system');
  assert.equal(unknown.appId, null);
  assert.equal(unknown.confidence, 'inferred');
  assert.equal(unknown.source, 'category');
  assert.match(unknown.description.tr, /belirlenemedi/);
  const file = enrichItem({ id: 'report', name: 'report.pdf' });
  assert.equal(file.insight.source, 'file-type');
  assert.match(file.insight.description.tr, /PDF/);
  const generic = enrichItem({ id: 'custom', name: 'migration_cluster.blob' });
  assert.equal(generic.insight.appId, null);
  assert.equal(generic.insight.confidence, 'inferred');
  assert.ok(generic.suggestion);
});
test('catalog ids are unique and all entries use existing groups with both local descriptions', () => {
  assert.equal(new Set(appKnowledge.map((app) => app.id)).size, appKnowledge.length);
  const categories = new Set(defaultSettings.categories.map((c) => c.id));
  for (const app of appKnowledge) {
    assert.ok(categories.has(app.categoryId), app.id);
    assert.ok(app.aliases.length > 0, app.id);
    assert.equal(typeof app.description.tr, 'string');
    assert.equal(typeof app.description.en, 'string');
  }
});
