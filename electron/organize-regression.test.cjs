const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DesktopService, folders } = require('./service.cjs');
const { FolderIcons } = require('./folder-icons.cjs');
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-organize-regression-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const desktop = path.join(root, 'Desktop');
  const data = path.join(root, 'data');
  await fs.mkdir(desktop);
  const source = path.join(desktop, 'Report.pdf');
  await fs.writeFile(source, 'important bytes');
  const service = new DesktopService(desktop, data, options);
  return {
    root,
    desktop,
    data,
    source,
    service,
    target: path.join(desktop, folders[3], 'Report.pdf'),
  };
}
async function move(service) {
  const plan = await service.preview(await service.scan(), 'move');
  return service.organize(plan.token);
}
test('folder icon/attribute failures do not stop a verified move and are recorded for review', async (t) => {
  const { service, source, target } = await fixture(t, {
    folderIcons: {
      decorate: async () => {
        throw Object.assign(Error('attrib denied'), { code: 'EPERM' });
      },
      removeAttributes: async () => {
        throw Object.assign(Error('attrib denied'), { code: 'EPERM' });
      },
    },
  });
  const batch = await move(service);
  await assert.rejects(fs.stat(source), { code: 'ENOENT' });
  assert.equal(await fs.readFile(target, 'utf8'), 'important bytes');
  assert.equal(batch.status, 'completed');
  assert.equal(batch.summary.moved, 1);
  assert.equal(batch.warnings[0].code, 'FOLDER_ICON_FAILED');
  assert.deepEqual(batch.outputDirectories, [path.dirname(target)]);
  assert.equal((await service.history())[0].warnings[0].detail, 'EPERM');
  await service.undo();
  assert.equal(await fs.readFile(source, 'utf8'), 'important bytes');
  assert.equal((await service.history())[0].status, 'undone');
});
test('timestamp permission failures cannot prevent moving or restoring verified file content', async (t) => {
  const { service, source, target } = await fixture(t, {
    preserveTimestamp: async () => {
      throw Object.assign(Error('readonly metadata'), { code: 'EPERM' });
    },
  });
  const batch = await move(service);
  assert.equal(await fs.readFile(target, 'utf8'), 'important bytes');
  await assert.rejects(fs.stat(source), { code: 'ENOENT' });
  assert.equal(batch.warnings[0].code, 'TIMESTAMP_NOT_PRESERVED');
  await service.undo();
  assert.equal(await fs.readFile(source, 'utf8'), 'important bytes');
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
});
test('a source-delete failure remains explicit, retains both copies, and can be undone safely', async (t) => {
  const { service, source, target } = await fixture(t, {
    removeSource: async () => {
      throw Object.assign(Error('file locked'), { code: 'EPERM' });
    },
  });
  await assert.rejects(
    move(service),
    /OPERATION_INTERRUPTED: SOURCE_REMOVE_FAILED: Report.pdf: EPERM/,
  );
  assert.equal(await fs.readFile(source, 'utf8'), 'important bytes');
  assert.equal(await fs.readFile(target, 'utf8'), 'important bytes');
  const batch = (await service.history())[0];
  assert.equal(batch.status, 'interrupted');
  assert.equal(batch.entries[0].stage, 'copied');
  assert.deepEqual(batch.summary, {
    moved: 0,
    copied: 1,
    shortcuts: 0,
    skipped: 0,
    failed: 1,
    pending: 0,
  });
  await service.undo();
  assert.equal(await fs.readFile(source, 'utf8'), 'important bytes');
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
});
test('a journal write failure during folder decoration is never treated as a cosmetic warning', async (t) => {
  const { service, source, target } = await fixture(t, {
    folderIcons: {
      decorate: async (directory, group, settings, onCreated) =>
        onCreated({ path: path.join(directory, '.darkdesk.ico'), checksum: 'example' }),
    },
  });
  const save = service.save.bind(service);
  let failed = false;
  service.save = async (log) => {
    if (!failed && log[0].metadata.length) {
      failed = true;
      throw Error('disk full while journaling');
    }
    return save(log);
  };
  await assert.rejects(move(service), /OPERATION_INTERRUPTED: disk full while journaling/);
  assert.equal(await fs.readFile(source, 'utf8'), 'important bytes');
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
  assert.deepEqual((await service.history())[0].warnings, []);
});
test('installed Windows .lnk files keep their original bytes and undo never deletes the source', async (t) => {
  const { root, desktop, data } = await fixture(t);
  const source = path.join(root, 'Original.lnk');
  const contents = Buffer.from([76, 0, 0, 0, 1, 2, 3, 4]);
  await fs.writeFile(source, contents);
  const item = {
    id: 'app:original',
    name: 'Original.lnk',
    source,
    target: path.join(root, 'Original.exe'),
    extension: '.lnk',
    kind: 'installed',
  };
  const service = new DesktopService(desktop, data, {
    scanner: { catalog: new Map([[item.id, item]]) },
    platform: 'win32',
    folderIcons: new FolderIcons(data, 'win32', { run: async () => {} }),
  });
  const plan = await service.preview([{ id: item.id, category: 'games' }], 'move');
  const batch = await service.organize(plan.token);
  assert.deepEqual(await fs.readFile(plan.entries[0].target), contents);
  assert.deepEqual(await fs.readFile(source), contents);
  assert.equal(batch.summary.shortcuts, 1);
  await service.undo();
  assert.deepEqual(await fs.readFile(source), contents);
  await assert.rejects(fs.stat(plan.entries[0].target), { code: 'ENOENT' });
});
test('installed .url launchers remain real URL files instead of a reconstructed shortcut', async (t) => {
  const { root, desktop, data } = await fixture(t);
  const source = path.join(root, 'Steam Game.url');
  const contents =
    '[InternetShortcut]\r\nURL=steam://rungameid/42\r\nIconFile=C:\\Games\\logo.ico\r\nIconIndex=3\r\n';
  await fs.writeFile(source, contents);
  const item = {
    id: 'app:url',
    name: 'Steam Game.url',
    source,
    target: source,
    extension: '.url',
    kind: 'installed',
  };
  const service = new DesktopService(desktop, data, {
    scanner: { catalog: new Map([[item.id, item]]) },
    platform: 'win32',
    folderIcons: new FolderIcons(data, 'win32', { run: async () => {} }),
  });
  const plan = await service.preview([{ id: item.id, category: 'games' }], 'move');
  assert.ok(plan.entries[0].target.endsWith('.url'));
  await service.organize(plan.token);
  assert.equal(await fs.readFile(plan.entries[0].target, 'utf8'), contents);
  assert.equal(await fs.readFile(source, 'utf8'), contents);
});
test('generated executable shortcuts use the original executable icon and preserve launch options', async (t) => {
  const { root, data } = await fixture(t);
  const source = path.join(root, 'Program.exe');
  const destination = path.join(root, 'Program.lnk');
  await fs.writeFile(source, 'program stays in place');
  let options;
  const icons = new FolderIcons(data, 'win32', {
    shell: {
      writeShortcutLink: (target, operation, value) => {
        options = value;
        syncFs.writeFileSync(target, 'native shortcut');
        return true;
      },
    },
  });
  await icons.shortcut(destination, {
    source,
    target: source,
    name: 'Program',
    arguments: '--open project',
    workingDirectory: root,
  });
  assert.equal(options.icon, source);
  assert.equal(options.iconIndex, 0);
  assert.equal(options.args, '--open project');
  assert.equal(options.cwd, root);
  assert.equal(await fs.readFile(source, 'utf8'), 'program stays in place');
});
test('conflict receipts include an actionable reason without replacing existing files', async (t) => {
  const { service, desktop, target } = await fixture(t);
  await fs.mkdir(path.dirname(target));
  await fs.writeFile(target, 'existing document');
  await fs.writeFile(path.join(desktop, 'Second.pdf'), 'second');
  const batch = await move(service);
  assert.equal(batch.summary.skipped, 1);
  assert.equal(batch.skippedDetails[0].id, 'Report.pdf');
  assert.equal(batch.skippedDetails[0].code, 'TARGET_EXISTS');
  assert.equal(await fs.readFile(target, 'utf8'), 'existing document');
});

test('a changed copied target is not reported as a verified success or revealable output', async (t) => {
  const { service, source, target } = await fixture(t);
  const save = service.save.bind(service);
  let altered = false;
  service.save = async (log) => {
    await save(log);
    const entry = log[0].entries[0];
    if (!altered && entry?.stage === 'copied' && entry.verified === false) {
      altered = true;
      await fs.writeFile(entry.target, 'externally changed copy');
    }
  };
  await assert.rejects(move(service), /OPERATION_INTERRUPTED: COPY_VERIFY: Report.pdf/);
  assert.equal(await fs.readFile(source, 'utf8'), 'important bytes');
  assert.equal(await fs.readFile(target, 'utf8'), 'externally changed copy');
  const batch = (await service.history())[0];
  assert.equal(batch.entries[0].verified, false);
  assert.equal(batch.summary.moved, 0);
  assert.equal(batch.summary.copied, 0);
  assert.equal(batch.summary.failed, 1);
  assert.equal(batch.summary.pending, 1);
  assert.deepEqual(batch.outputDirectories, []);
  await assert.rejects(service.undo(), /TARGET_CHANGED/);
});
