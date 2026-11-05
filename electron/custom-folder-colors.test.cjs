const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  folderSvg,
  folderPalette,
  normalizeFolderColor,
} = require('../shared/folder-appearance.js');
const { defaultSettings, categorySegments } = require('../shared/domain.js');
const { validateSettings } = require('./settings.cjs');
const { FolderIcons } = require('./folder-icons.cjs');
const { DesktopService } = require('./service.cjs');
const { applyFolderAppearance } = require('./folder-appearance.cjs');
const { renderFolderIco, pngToIco } = require('./folder-raster.cjs');

const artwork = (color = 'blue') =>
  fs.readFile(path.join(__dirname, '../build/folder-icons/themes/gradient', color, 'code.ico'));

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
