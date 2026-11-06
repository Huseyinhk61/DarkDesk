const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  appKnowledge,
  findKnownApp,
  appInsight,
  normalizeAppName,
  gameLaunchCategory,
  resolveAppPurpose,
} = require('../shared/app-insights.js');
const { classify, defaultCategory, enrichItem, defaultSettings } = require('../shared/domain.js');
const settings = () => structuredClone(defaultSettings);

test('common Windows executable names and renamed shortcuts identify useful app purposes', () => {
  for (const [name, appId, group] of [
    ['msedge.exe', 'edge', 'internetbrowsers'],
    ['winword.exe', 'word', 'office'],
    ['powerpnt.exe', 'powerpoint', 'office'],
    ['EpicGamesLauncher.exe', 'epic', 'games'],
    ['RiotClientServices.exe', 'riot', 'games'],
    ['EADesktop.exe', 'ea', 'games'],
    ['devenv.exe', 'visualstudio', 'softwareide'],
    ['Docker Desktop.exe', 'docker', 'softwaredevops'],
    ['AfterFX.exe', 'aftereffects', 'design'],
    ['resolve.exe', 'davinci', 'design'],
    ['obs64.exe', 'obs', 'design'],
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
  assert.equal(renamed.category, 'internetbrowsers');
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
test('Explorer copy and shortcut suffix ordering does not send browsers to system tools', () => {
  for (const name of [
    'Google Chrome (2) - Shortcut.lnk',
    'Google Chrome - Shortcut (2).lnk',
    'Google Chrome (2) - Kısayol (3) (64-bit).lnk',
    'Mozilla Firefox (2) - Kısayol.lnk',
  ]) {
    const item = enrichItem({ id: name, name });
    assert.equal(item.category, 'internetbrowsers', name);
    assert.equal(item.insight.source, 'local-catalog', name);
  }
  assert.equal(normalizeAppName('Half-Life 2.url'), 'half life 2');
  assert.equal(normalizeAppName('Google Chrome 132.0.lnk'), 'google chrome 132 0');
  assert.equal(findKnownApp({ name: 'Chrome notes (2) - Shortcut.txt' }), null);
});
test('game InternetShortcut protocols suggest games without claiming a launcher identity', () => {
  for (const launchUrl of [
    'steam://rungameid/220',
    'steam://run/730//',
    'uplay://launch/54/0',
    'com.epicgames.launcher://apps/namespace%3Aproduct%3Aapp?action=launch&silent=true',
    'origin://launchgame/OFB-EAST:12345',
    'link2ea://launchgame/12345?platform=steam',
  ]) {
    const item = enrichItem({ id: 'game.url', name: 'Driver Update.url', launchUrl });
    assert.equal(item.category, 'games', launchUrl);
    assert.equal(item.insight.confidence, 'inferred');
    assert.equal(item.insight.source, 'shortcut-protocol');
    assert.equal(item.insight.appId, null);
    assert.equal(item.suggestion, null);
    assert.equal(defaultCategory(item.name, '', launchUrl), 'games');
  }
  const steam = { id: 'steam.url', name: 'Steam.url', launchUrl: 'steam://rungameid/220' };
  assert.equal(findKnownApp(steam), null);
  assert.notEqual(
    enrichItem(steam).insight.description.en,
    appInsight({ name: 'Steam.exe' }, 'games').description.en,
  );
});
test('game launch hints retain manual and rule priority and reject unrelated or malformed links', () => {
  const item = { id: 'game.url', name: 'Half-Life 2.url', launchUrl: 'steam://rungameid/220' };
  let value = settings();
  value.overrides[item.id] = 'office';
  assert.equal(classify(item, value), 'office');
  value = settings();
  value.rules = [
    { id: 'urls', pattern: '.url', match: 'extension', categoryId: 'archive', enabled: true },
  ];
  assert.equal(classify(item, value), 'archive');
  value = settings();
  value.categories = value.categories.filter((c) => c.id !== 'games');
  assert.equal(classify(item, value), value.categories[0].id);
  for (const launchUrl of [
    'https://store.steampowered.com/app/220',
    'steam://open/friends',
    'steam://rungameid/not-a-number',
    'steam://rungameid/220\n',
    'com.epicgames.launcher://apps/game?action=download',
    'unknown://run/220',
    'not a URL',
  ])
    assert.equal(gameLaunchCategory(launchUrl), null, launchUrl);
});
test('documents and incidental installation folders cannot impersonate catalog applications', () => {
  for (const name of ['Chrome plan.pdf', 'Steam notes.txt', 'Word.png', 'Photoshop invoice.docx']) {
    assert.equal(findKnownApp({ name }), null, name);
    assert.equal(appInsight({ name }, 'office').appId, null, name);
  }
  assert.equal(classify({ name: 'Chrome plan.pdf' }), 'office');
  assert.equal(classify({ name: 'Photoshop invoice.docx' }), 'financeaccounting');
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
  assert.equal(unknown.source, 'filename-hint');
  assert.match(unknown.description.tr, /yardımcı araç/);
  assert.doesNotMatch(unknown.description.tr, /belirlenemedi/);
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

// Descriptions use independent evidence; a category assignment never proves a
// product identity, and Windows launch hosts do not describe their payload.
test('requested offline tools identify their real purpose without network access', () => {
  for (const [name, id, term] of [
    ['advanced_ip_scanner.exe', 'advancedipscanner', /network scanner/i],
    ['BCUninstaller.lnk', 'bcuninstaller', /uninstaller/i],
    ['Any Command.exe', 'anycommand', /commands/i],
  ]) {
    const insight = appInsight({ name }, 'system');
    assert.equal(insight.appId, id);
    assert.match(insight.description.en, term);
    assert.equal(insight.source, 'local-catalog');
  }
});
test('purpose resolution prioritizes manual descriptions, Windows properties and offline fallback', () => {
  const item = { id: 'editor', name: 'Code.exe', category: 'softwareide' };
  const metadata = {
    description: 'Code editing and debugging',
    metadataSource: 'windows-version-info',
    company: 'Publisher',
  };
  assert.equal(
    resolveAppPurpose(item, '  My code workspace  ', metadata).description.en,
    'My code workspace',
  );
  const native = resolveAppPurpose(item, '', metadata);
  assert.equal(native.source, 'windows-version-info');
  assert.equal(native.description.en, metadata.description);
  assert.equal(native.company, 'Publisher');
  assert.equal(
    resolveAppPurpose(item, '', { description: '', metadataSource: 'windows-version-info' }).source,
    'local-catalog',
  );
  assert.equal(
    resolveAppPurpose(item, '', { description: 'untrusted', metadataSource: 'file-system' }).source,
    'local-catalog',
  );
  // Removing a saved description also removes an already-enriched manual insight.
  assert.equal(
    resolveAppPurpose({ ...item, insight: appInsight(item, item.category, 'old text') }, '').source,
    'local-catalog',
  );
});
test('launch-host metadata is excluded while shortcut-specific descriptions are preserved', () => {
  const item = {
    name: 'Custom Server.lnk',
    target: 'C:\\Windows\\explorer.exe',
    category: 'system',
  };
  const host = { description: 'Windows Explorer', metadataSource: 'windows-version-info' };
  assert.equal(resolveAppPurpose(item, '', host).source, 'filename-hint');
  const shortcut = resolveAppPurpose(item, '', {
    ...host,
    purposeDescription: 'Starts the local development server',
    purposeSource: 'windows-shortcut',
  });
  assert.equal(shortcut.source, 'windows-shortcut');
  assert.match(shortcut.description.en, /development server/);
});
test('filename estimates help explain unknown utilities and otherwise invite a manual description', () => {
  for (const [name, text] of [
    ['CustomScanner.exe', /scanning/],
    ['LocalServer.exe', /server/],
    ['InternalTool.exe', /utility/],
  ]) {
    const purpose = appInsight({ name }, 'system');
    assert.equal(purpose.source, 'filename-hint');
    assert.match(purpose.description.en, text);
    assert.equal(purpose.confidence, 'inferred');
  }
  const unknown = appInsight({ name: 'Foobar.exe' }, 'system');
  assert.match(unknown.description.en, /Custom software/);
  assert.match(unknown.description.tr, /manuel açıklama/);
  // File type wins over misleading words in a document's label.
  assert.equal(appInsight({ name: 'server tool.pdf' }, 'system').source, 'file-type');
});

test('bare product titles and Electron boilerplate use useful offline purpose text', () => {
  const { resolveAppPurpose } = require('../shared/app-insights.js');
  for (const description of ['Cursor', 'Electron', 'Application']) {
    const value = resolveAppPurpose({ name: 'Cursor.exe', category: 'aicode' }, null, {
      description,
      metadataSource: 'windows-version-info',
    });
    assert.equal(value.source, 'local-catalog');
    assert.match(value.description.en, /code editor/);
  }
  const meaningful = resolveAppPurpose({ name: 'Custom.exe', category: 'system' }, null, {
    description: 'Manages inventory and warehouse receipts',
    metadataSource: 'windows-version-info',
  });
  assert.equal(meaningful.source, 'windows-version-info');
});
