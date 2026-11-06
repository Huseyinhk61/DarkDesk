const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  folderSvg,
  folderPalette,
  normalizeFolderColor,
  resolveFolderTheme,
  folderAppearanceVersion,
} = require('../shared/folder-appearance.js');
const { defaultSettings, categorySegments } = require('../shared/domain.js');
const { validateSettings } = require('./settings.cjs');
const { FolderIcons } = require('./folder-icons.cjs');
const { DesktopService } = require('./service.cjs');
const { applyFolderAppearance } = require('./folder-appearance.cjs');
const { renderFolderIco, pngToIco } = require('./folder-raster.cjs');

const artwork = (color = 'blue') =>
  fs.readFile(path.join(__dirname, '../build/folder-icons/themes/gradient', color, 'code.ico'));

test('per-category styles survive validation and use a shared synchronization signature', () => {
  const input = structuredClone(defaultSettings);
  const before = folderAppearanceVersion(input);
  input.categories[0].folderTheme = 'outline';
  const settings = validateSettings(input);
  assert.equal(settings.categories[0].folderTheme, 'outline');
  assert.equal(resolveFolderTheme(settings.categories[0], 'solid'), 'outline');
  assert.equal(resolveFolderTheme(settings.categories[1], 'solid'), 'solid');
  assert.notEqual(folderAppearanceVersion(settings), before);
  assert.deepEqual(validateSettings(settings), settings);
  settings.categories[0].folderTheme = 'invalid';
  assert.throws(() => validateSettings(settings), /CATEGORY_INVALID/);
});

test('native folder artwork honors an individual style before the global style', async (t) => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-category-style-'));
  t.after(() => fs.rm(data, { recursive: true, force: true }));
  const icons = new FolderIcons(data, 'win32');
  const category = { color: 'blue', icon: 'code', folderTheme: 'outline' };
  const settings = { folderTheme: 'solid' };
  const contents = await icons.folderContents(category, settings);
  assert.deepEqual(
    contents['.darkdesk.ico'],
    await fs.readFile(await icons.folderIconFile('code', 'blue', 'outline')),
  );
  assert.match(contents['desktop.ini'].toString('utf16le'), /DarkDesk=outline\/blue\/code/);
  category.customColor = { from: '#112233', to: '#445566' };
  let theme;
  icons.renderFolderIco = async (input, style) => {
    theme = style;
    return contents['.darkdesk.ico'];
  };
  await icons.folderContents(category, settings);
  assert.equal(theme, 'outline');
});

test('applying category styles rewrites owned folder files and preserves a global change override', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-style-sync-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop'),
    data = path.join(root, 'data');
  await fs.mkdir(desktop);
  const folderIcons = new FolderIcons(data, 'win32', { run: async () => {} });
  const service = new DesktopService(desktop, data, { platform: 'win32', folderIcons });
  const settings = structuredClone(defaultSettings),
    category = settings.categories[0];
  const directory = path.join(desktop, ...categorySegments(category.id, settings.categories));
  await fs.mkdir(directory);
  const metadata = await folderIcons.decorate(directory, category, settings);
  await service.save([{ status: 'completed', directories: [directory], metadata, entries: [] }]);
  category.folderTheme = 'outline';
  assert.equal((await applyFolderAppearance(service, settings)).updated, 1);
  const outline = await fs.readFile(path.join(directory, '.darkdesk.ico'));
  assert.deepEqual(
    outline,
    await fs.readFile(await folderIcons.folderIconFile(category.icon, category.color, 'outline')),
  );
  settings.folderTheme = 'solid';
  assert.equal((await applyFolderAppearance(service, settings)).unchanged, 1);
  assert.deepEqual(await fs.readFile(path.join(directory, '.darkdesk.ico')), outline);
  delete category.folderTheme;
  assert.equal((await applyFolderAppearance(service, settings)).updated, 1);
  assert.notDeepEqual(await fs.readFile(path.join(directory, '.darkdesk.ico')), outline);
  assert.match(await fs.readFile(path.join(directory, 'desktop.ini'), 'utf16le'), /DarkDesk=solid/);
});

test('custom folder gradients validate and persist normalized colors without changing legacy groups', () => {
  const legacy = validateSettings({});
  assert.equal(legacy.categories[0].customColor, undefined);
  const input = structuredClone(defaultSettings);
  input.categories[0].customColor = { from: '#Aa22FF', to: '#1100BB' };
  const result = validateSettings(input);
  assert.deepEqual(result.categories[0].customColor, { from: '#aa22ff', to: '#1100bb' });
  assert.equal(result.categories[0].color, input.categories[0].color);
  assert.deepEqual(validateSettings(result), result);
  for (const customColor of [
    '#123456',
    [],
    {},
    { from: '#123', to: '#123456' },
    { from: '#123456', to: 'url(injected)' },
  ]) {
    input.categories[0].customColor = customColor;
    assert.throws(() => validateSettings(input), /FOLDER_APPEARANCE_INVALID/);
  }
  assert.equal(normalizeFolderColor(null), undefined);
});

test('custom vectors contain only validated colors and choose a contrasting glyph', () => {
  const light = { from: '#ffffff', to: '#eeeeee' },
    dark = { from: '#111111', to: '#222222' };
  assert.deepEqual(folderPalette({ customColor: light }), {
    fill: '#ffffff',
    shade: '#eeeeee',
    stroke: '#ffffff',
  });
  assert.match(folderSvg({ customColor: light }), /stroke="#000000"/);
  assert.match(folderSvg({ customColor: dark }), /stroke="#ffffff"/);
  assert.match(folderSvg({ customColor: dark }), /dd-gradient-111111-222222-folder/);
  assert.notEqual(folderSvg({ customColor: light }), folderSvg({ customColor: dark }));
  for (const value of ['#fff" onload="alert(1)', 'javascript:alert(1)', '#123456;fill:red'])
    assert.throws(
      () => folderSvg({ customColor: { from: value, to: '#ffffff' } }),
      /FOLDER_APPEARANCE_INVALID/,
    );
});

test('runtime PNG-backed ICO conversion is bounded and preserves 256-pixel artwork', async () => {
  const source = await artwork(),
    png = source.subarray(22);
  assert.deepEqual(pngToIco(png), source);
  for (const invalid of [Buffer.alloc(0), Buffer.from('<svg>'), Buffer.alloc(2 * 1024 * 1024 + 1)])
    assert.throws(() => pngToIco(invalid), /FOLDER_RENDER_FAILED/);
  const wrongSize = Buffer.from(png);
  wrongSize.writeUInt32BE(128, 16);
  assert.throws(() => pngToIco(wrongSize), /FOLDER_RENDER_FAILED/);
});

test('custom native rasterization receives the preview vector and serializes renderer work', async () => {
  const png = (await artwork()).subarray(22);
  const calls = [];
  let active = 0;
  const renderer = async (svg) => {
    assert.equal(++active, 1);
    calls.push(svg);
    await new Promise((resolve) => setImmediate(resolve));
    active--;
    return png;
  };
  const category = { color: 'blue', icon: 'code', customColor: { from: '#2255ee', to: '#dd3388' } };
  const [first, second] = await Promise.all([
    renderFolderIco(category, 'gradient', renderer),
    renderFolderIco(category, 'solid', renderer),
  ]);
  assert.deepEqual(first, await artwork());
  assert.deepEqual(second, first);
  assert.equal(calls[0], folderSvg({ ...category, theme: 'gradient' }));
  assert.equal(calls[1], folderSvg({ ...category, theme: 'solid' }));
  assert.notEqual(calls[0], calls[1]);
});

test('custom folder appearance updates owned metadata and preserves independent user icon choices', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-custom-colors-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop'),
    data = path.join(root, 'data');
  await fs.mkdir(desktop);
  const customArtwork = await artwork('pink');
  let rendered = 0;
  const folderIcons = new FolderIcons(data, 'win32', {
    run: async () => {},
    renderFolderIco: async (category) => {
      rendered++;
      assert.deepEqual(category.customColor, { from: '#2255ee', to: '#dd3388' });
      return customArtwork;
    },
  });
  const service = new DesktopService(desktop, data, { platform: 'win32', folderIcons });
  const settings = structuredClone(defaultSettings),
    group = settings.categories.find((category) => category.id === 'software');
  const directory = path.join(desktop, ...categorySegments(group.id, settings.categories));
  await fs.mkdir(directory);
  const metadata = await folderIcons.decorate(directory, group, settings);
  assert.equal(rendered, 0, 'Named palettes continue to use bundled icons');
  await service.save([{ status: 'completed', directories: [directory], metadata, entries: [] }]);
  group.customColor = { from: '#2255ee', to: '#dd3388' };
  let result = await applyFolderAppearance(service, settings);
  assert.equal(result.updated, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(await fs.readFile(path.join(directory, '.darkdesk.ico')), customArtwork);
  assert.match(
    await fs.readFile(path.join(directory, 'desktop.ini'), 'utf16le'),
    /custom-2255ee-dd3388/,
  );
  assert.equal((await applyFolderAppearance(service, settings)).unchanged, 1);
  await fs.writeFile(path.join(directory, 'desktop.ini'), 'manually chosen icon');
  group.customColor = { from: '#000000', to: '#111111' };
  result = await applyFolderAppearance(service, settings);
  assert.equal(
    result.details.find((entry) => entry.categoryId === group.id).code,
    'FOLDER_CUSTOMIZED',
  );
  assert.equal(
    await fs.readFile(path.join(directory, 'desktop.ini'), 'utf8'),
    'manually chosen icon',
  );
});

test('glyph size persists and changes both the preview vector and native rendering path', async (t) => {
  const settings = structuredClone(defaultSettings);
  settings.categories[0].folderGlyphSize = 'large';
  assert.equal(validateSettings(settings).categories[0].folderGlyphSize, 'large');
  const large = folderSvg({ ...settings.categories[0], folderGlyphSize: 'large' });
  assert.match(large, /scale\(4.2\)/);
  assert.notEqual(large, folderSvg({ ...settings.categories[0], folderGlyphSize: 'small' }));
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-glyph-'));
  t.after(() => fs.rm(data, { recursive: true, force: true }));
  let rendered;
  const icons = new FolderIcons(data, 'win32', {
    renderFolderIco: async (category) => {
      rendered = category.folderGlyphSize;
      return artwork();
    },
  });
  await icons.folderContents(settings.categories[0], settings);
  assert.equal(rendered, 'large');
});

test('explicit folder preparation creates only the chosen category and applies its saved appearance', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-prepare-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop');
  await fs.mkdir(desktop);
  await fs.writeFile(path.join(desktop, 'untouched.txt'), 'keep');
  const { DesktopRuntime } = require('./runtime/controller.cjs');
  const runtime = new DesktopRuntime({ desktop, data: path.join(root, 'data'), platform: 'win32' });
  runtime.service.folderIcons.run = async () => {};
  const result = await runtime.prepareCategoryFolder('software');
  assert.equal(result.updated, 1);
  const settings = await runtime.settings.read();
  const folder = path.join(desktop, ...categorySegments('software', settings.categories));
  assert.equal((await fs.stat(path.join(folder, '.darkdesk.ico'))).isFile(), true);
  assert.equal(await fs.readFile(path.join(desktop, 'untouched.txt'), 'utf8'), 'keep');
  assert.equal((await fs.readdir(desktop)).length, 2);
  await assert.rejects(runtime.prepareCategoryFolder('../escape'), /CATEGORY_INVALID/);
});
