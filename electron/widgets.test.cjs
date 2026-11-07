const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { WidgetManager } = require('./runtime/widgets.cjs');
const {
  defaultWidgetState,
  validateWidgetPatch,
  normalizeWidgetState,
  restoreWidgetBounds,
} = require('../shared/widget-model.js');

class FakeWindow extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.bounds = Object.fromEntries(
      ['x', 'y', 'width', 'height'].map((key) => [key, options[key]]),
    );
    this.destroyed = false;
    this.visible = false;
    this.flush = async () => {};
    this.webContents = {
      executeJavaScript: async (script) => {
        assert.equal(script, 'window.__darkdeskWidgetFlush?.()');
        return this.flush();
      },
    };
  }
  isDestroyed() {
    return this.destroyed;
  }
  setAlwaysOnTop(value) {
    this.top = value;
  }
  setVisibleOnAllWorkspaces() {}
  showInactive() {
    this.visible = true;
  }
  hide() {
    this.visible = false;
  }
  getBounds() {
    return { ...this.bounds };
  }
  setBounds(bounds) {
    this.bounds = { ...bounds };
    this.emit('move');
  }
  destroy() {
    if (!this.destroyed) {
      this.destroyed = true;
      this.emit('closed');
    }
  }
}
async function fixture(t, options = {}) {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'darkdesk-widgets-'));
  t.after(() => fs.rm(data, { recursive: true, force: true }));
  const created = [],
    events = [];
  const manager = new WidgetManager({
    data,
    platform: 'test',
    createWindow: (options) => {
      const win = new FakeWindow(options);
      created.push(win);
      return win;
    },
    loadWindow: async () => {},
    getDisplays: () => [{ workArea: { x: 0, y: 0, width: 1280, height: 800 } }],
    emit: (name, value) => events.push({ name, value }),
    attachDesktop: async () => ({ mode: 'floating', supported: false, reason: 'platform' }),
    ...options,
  });
  t.after(async () => {
    for (const window of manager.windows()) window.flush = async () => {};
    await manager.stop();
  });
  return { data, manager, created, events };
}
test('widget model validates editable content and preserves independent modules', () => {
  const state = structuredClone(defaultWidgetState);
  state.widgets.note.enabled = true;
  const next = validateWidgetPatch(state, {
    note: 'private local note',
    todos: [{ id: 'todo_1', text: ' Finish work ', done: false }],
  });
  assert.equal(next.note, 'private local note');
  assert.equal(next.todos[0].text, 'Finish work');
  assert.equal(next.widgets.note.enabled, true);
  assert.equal(state.note, '');
  for (const bad of [
    { widgets: {} },
    { note: 1 },
    { note: 'x'.repeat(20001) },
    {
      todos: [
        { id: 'same', text: 'one', done: false },
        { id: 'same', text: 'two', done: false },
      ],
    },
    { todos: [{ id: 'ok', text: '', done: false }] },
    { placement: 'above-all-apps' },
    { resetPositions: false },
  ])
    assert.throws(() => validateWidgetPatch(state, bad), /WIDGETS_INVALID/);
  assert.throws(
    () =>
      normalizeWidgetState({
        ...state,
        todos: new Array(101).fill({ id: 'x', text: 'x', done: false }),
      }),
    /WIDGETS_INVALID/,
  );
});
test('restored widget bounds remain visible after removing a monitor or on a negative-coordinate display', () => {
  assert.deepEqual(
    restoreWidgetBounds('note', { x: 5000, y: 2000, width: 340, height: 340 }, [
      { x: 0, y: 0, width: 1024, height: 768 },
    ]),
    { x: 684, y: 428, width: 340, height: 340 },
  );
  assert.deepEqual(
    restoreWidgetBounds('note', { x: -1800, y: 100, width: 292, height: 236 }, [
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: -1920, y: 0, width: 1920, height: 1080 },
    ]),
    { x: -1800, y: 100, width: 292, height: 236 },
  );
  const tiny = restoreWidgetBounds('todos', null, [{ x: 10, y: 20, width: 200, height: 150 }]);
  assert.equal(tiny.width, 200);
  assert.equal(tiny.height, 150);
  assert.equal(tiny.x, 10);
  assert.equal(tiny.y, 20);
});
test('widget windows use isolated native settings and persist content, visibility and positions across relaunch', async (t) => {
  const { manager, created, data } = await fixture(t);
  await manager.save({ note: 'persist me', todos: [{ id: 'a', text: 'task', done: true }] });
  await manager.show('note');
  assert.equal(created.length, 1);
  const win = created[0];
  assert.equal(win.options.transparent, true);
  assert.equal(win.options.frame, false);
  assert.equal(win.options.skipTaskbar, true);
  assert.equal(win.options.webPreferences.contextIsolation, true);
  assert.equal(win.options.webPreferences.nodeIntegration, false);
  assert.equal(win.options.webPreferences.sandbox, true);
  assert.equal(win.top, false);
  await manager.show('note');
  assert.equal(created.length, 1);
  win.bounds = { x: 40, y: 60, width: 340, height: 340 };
  await manager.saveBounds('note', win);
  await manager.stop();
  assert.equal(win.destroyed, true);
  const next = new WidgetManager({
    data,
    createWindow: (options) => new FakeWindow(options),
    loadWindow: async () => {},
    attachDesktop: async () => ({ mode: 'floating', supported: false }),
    getDisplays: () => [{ x: 0, y: 0, width: 1280, height: 800 }],
  });
  t.after(() => next.stop());
  await next.initialize();
  const state = await next.state();
  assert.equal(state.note, 'persist me');
  assert.equal(state.todos[0].done, true);
  assert.equal(state.widgets.note.enabled, true);
  assert.equal(next.windows()[0].getBounds().x, 40);
  await next.hide('note');
  assert.equal((await next.state()).widgets.note.enabled, false);
  assert.equal(next.windows()[0].visible, false);
});
test('placement changes flush pending renderer notes before recreating windows without IPC lock deadlock', async (t) => {
  const { manager, created } = await fixture(t);
  await manager.show('note');
  const previous = created[0];
  previous.flush = () => manager.save({ note: 'last draft before reparent' });
  await manager.save({ placement: 'floating' });
  assert.equal(previous.destroyed, true);
  assert.equal(created.length, 2);
  assert.equal((await manager.state()).note, 'last draft before reparent');
  assert.equal((await manager.state()).placement, 'floating');
});
test('failed note flush cancels hide and quit, preserving the visible window and retrying successfully', async (t) => {
  const { manager, created } = await fixture(t);
  await manager.show('note');
  const win = created[0];
  win.flush = async () => {
    throw Error('disk-full');
  };
  await assert.rejects(manager.hide('note'), /disk-full/);
  assert.equal(win.visible, true);
  assert.equal((await manager.state()).widgets.note.enabled, true);
  await assert.rejects(manager.stop(), /disk-full/);
  assert.equal(manager.stopping, false);
  assert.equal(win.destroyed, false);
  win.flush = () => manager.save({ note: 'recovered' });
  await manager.stop();
  assert.equal(win.destroyed, true);
  assert.equal((await manager.state()).note, 'recovered');
});
test('reset positions preserves content and moves visible windows inside the current work area', async (t) => {
  const { manager, created } = await fixture(t);
  await manager.show('todos');
  created[0].bounds = { x: 9000, y: 9000, width: 340, height: 380 };
  await manager.saveBounds('todos', created[0]);
  await manager.save({ note: 'keep this', resetPositions: true });
  const bounds = created[0].getBounds();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 1280);
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 800);
  assert.equal((await manager.state()).note, 'keep this');
  await assert.rejects(manager.show('arbitrary-window'), /WIDGETS_INVALID/);
});

test('concurrent widget requests wait for renderer loading and serialize independent content patches', async (t) => {
  let loaded;
  const gate = new Promise((resolve) => {
    loaded = resolve;
  });
  const { manager, created } = await fixture(t, { loadWindow: () => gate });
  await manager.read();
  const first = manager.show('note');
  const second = manager.show('note');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(created.length, 1);
  assert.equal(created[0].visible, false);
  assert.equal((await manager.state()).widgets.note.enabled, false);
  loaded();
  await Promise.all([first, second]);
  assert.equal(created.length, 1);
  assert.equal(created[0].visible, true);
  await Promise.all([
    manager.save({ note: 'latest note' }),
    manager.save({ todos: [{ id: 'a', text: 'independent task', done: false }] }),
  ]);
  const state = await manager.state();
  assert.equal(state.note, 'latest note');
  assert.equal(state.todos[0].text, 'independent task');
});

test('quit rejects new or queued layout changes while allowing renderer content flushes', async (t) => {
  const { manager, created } = await fixture(t);
  await manager.show('note');
  let release, started;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const flushing = new Promise((resolve) => {
    started = resolve;
  });
  created[0].flush = async () => {
    started();
    await gate;
    await manager.save({ note: 'final quit draft' });
  };
  const stopping = manager.stop();
  await flushing;
  await assert.rejects(manager.save({ placement: 'floating' }), /WIDGETS_UNAVAILABLE/);
  await assert.rejects(manager.save({ resetPositions: true }), /WIDGETS_UNAVAILABLE/);
  release();
  await stopping;
  assert.equal((await manager.state()).note, 'final quit draft');
  assert.equal((await manager.state()).placement, 'desktop');
  assert.equal(created.length, 1);
});

test('a layout change already flushing cannot recreate windows after quit begins', async (t) => {
  const { manager, created } = await fixture(t);
  await manager.show('note');
  let release, started;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const flushing = new Promise((resolve) => {
    started = resolve;
  });
  created[0].flush = async () => {
    started();
    await gate;
  };
  const layout = manager.save({ placement: 'floating' });
  await flushing;
  const stopping = manager.stop();
  release();
  await assert.rejects(layout, /WIDGETS_UNAVAILABLE/);
  await stopping;
  assert.equal((await manager.state()).placement, 'desktop');
  assert.equal(created.length, 1);
});

test('collapse resizes native panels, preserves drafts and survives restart', async (t) => {
  const { manager, created, data } = await fixture(t);
  await manager.show('note');
  await manager.save({ note: 'keep me', collapsed: { note: true } });
  assert.equal(created[0].getBounds().height, 44);
  await manager.saveBounds('note', created[0]);
  assert.ok((await manager.state()).widgets.note.bounds.height >= 180);
  await manager.save({ resetPositions: true });
  assert.equal(created[0].getBounds().height, 44);
  await manager.stop();
  const persisted = new WidgetManager({ data, createWindow: () => {}, loadWindow: async () => {} });
  assert.equal((await persisted.state()).collapsed.note, true);
  assert.equal((await persisted.state()).note, 'keep me');
  await assert.rejects(persisted.save({ collapsed: { note: 'false' } }), /WIDGETS_INVALID/);
});

test('Windows editable widgets retain top-level focus instead of cross-process desktop parenting', async (t) => {
  let attachments = 0;
  const { manager, created } = await fixture(t, {
    platform: 'win32',
    attachDesktop: async () => {
      attachments++;
      return { mode: 'desktop', supported: true };
    },
  });
  await manager.show('note');
  await manager.show('todos');
  assert.equal(attachments, 0);
  assert.equal(created[0].options.focusable, true);
  assert.equal((await manager.state()).placements.note.reason, 'editable');
  await manager.show('system');
  assert.equal(attachments, 1);
});

test('appearance and system preferences persist independently, resizing preserves drafts and new modules migrate', async (t) => {
  const { manager, created, data } = await fixture(t);
  await manager.show('note');
  await manager.save({
    note: 'keep draft',
    appearance: { note: { opacity: 55, size: 'large' } },
    system: { interval: 5, chart: false },
  });
  let state = await manager.state();
  assert.equal(state.appearance.note.opacity, 55);
  assert.equal(created[0].getBounds().width, 438);
  assert.equal(state.note, 'keep draft');
  const persisted = normalizeWidgetState(
    JSON.parse(await fs.readFile(path.join(data, 'widgets.json'), 'utf8')),
  );
  assert.equal(persisted.system.interval, 5);
  assert.equal(persisted.appearance.note.size, 'large');
  const legacy = normalizeWidgetState({
    note: 'legacy',
    todos: [],
    placement: 'desktop',
    widgets: { note: { enabled: true, bounds: null } },
  });
  assert.equal(legacy.note, 'legacy');
  assert.equal(legacy.widgets.currency.enabled, false);
  for (const patch of [
    { appearance: { note: { opacity: 0 } } },
    { appearance: { note: { size: 'giant' } } },
    { appearance: { bad: { opacity: 80 } } },
    { system: { interval: 0 } },
    { focus: { duration: 0 } },
    { focus: { endsAt: NaN } },
  ])
    await assert.rejects(manager.save(patch), /WIDGETS_INVALID/);
});

test('focus timing survives elapsed wall time and clamps completion without interval drift', () => {
  const { focusSeconds } = require('../shared/widget-model.js');
  const timer = { duration: 25, remaining: 1500, endsAt: 100000 };
  assert.equal(focusSeconds(timer, 88000), 12);
  assert.equal(focusSeconds(timer, 101000), 0);
  assert.equal(focusSeconds({ ...timer, endsAt: null, remaining: 60 }, 101000), 60);
  assert.equal(focusSeconds(timer, -10000000), 1500);
});

test('read-only or task frames are not probed for note drafts during shutdown', async (t) => {
  const { manager, created } = await fixture(t);
  await manager.show('clock');
  await manager.show('todos');
  for (const window of created)
    window.flush = async () => {
      throw Error('Render frame was disposed');
    };
  await manager.stop();
  assert.ok(created.every((window) => window.destroyed));
});

test('default widget positions tile without overlap on a standard desktop', () => {
  const { widgetIds } = require('../shared/widget-model.js');
  const bounds = widgetIds.map((id) =>
    restoreWidgetBounds(id, null, [{ x: 0, y: 0, width: 1024, height: 768 }]),
  );
  for (let a = 0; a < bounds.length; a++)
    for (let b = a + 1; b < bounds.length; b++) {
      const x = Math.max(
        0,
        Math.min(bounds[a].x + bounds[a].width, bounds[b].x + bounds[b].width) -
          Math.max(bounds[a].x, bounds[b].x),
      );
      const y = Math.max(
        0,
        Math.min(bounds[a].y + bounds[a].height, bounds[b].y + bounds[b].height) -
          Math.max(bounds[a].y, bounds[b].y),
      );
      assert.equal(x * y, 0, widgetIds[a] + ' overlaps ' + widgetIds[b]);
    }
});

test('Pomodoro completion is claimed once across renderers, advances breaks and ends the requested cycles', async (t) => {
  const { manager } = await fixture(t);
  await manager.save({
    focus: { duration: 1, breakDuration: 2, cycles: 2, remaining: 0, endsAt: 1 },
  });
  const results = await Promise.all([manager.completeFocus(1), manager.completeFocus(1)]);
  assert.equal(results.filter((r) => r.completed).length, 1);
  let focus = (await manager.state()).focus;
  assert.equal(focus.phase, 'break');
  assert.equal(focus.remaining, 120);
  assert.equal(focus.completed, 1);
  await manager.save({ focus: { endsAt: 2 } });
  await manager.completeFocus(2);
  focus = (await manager.state()).focus;
  assert.equal(focus.phase, 'work');
  assert.equal(focus.remaining, 60);
  assert.equal(focus.completed, 1);
  await manager.save({ focus: { endsAt: 3 } });
  await manager.completeFocus(3);
  focus = (await manager.state()).focus;
  assert.equal(focus.completed, 0);
  assert.equal(focus.phase, 'work');
  assert.equal(focus.endsAt, null);
  await manager.save({ focus: { endsAt: Date.now() + 60000 } });
  assert.equal((await manager.completeFocus(3)).completed, false);
  for (const patch of [
    { breakDuration: 0 },
    { cycles: 13 },
    { color: 'url(x)' },
    { volume: 101 },
    { alarm: 'yes' },
  ])
    await assert.rejects(manager.save({ focus: patch }), /WIDGETS_INVALID/);
  await manager.save({ appearance: { focus: { blur: 0 } } });
  assert.equal((await manager.state()).appearance.focus.blur, 0);
  await assert.rejects(manager.save({ appearance: { focus: { blur: 33 } } }), /WIDGETS_INVALID/);
});

test('widget collision resolver uses actual resized rectangles and supports negative monitor origins', () => {
  const { placeWidget } = require('../shared/widget-layout.js');
  const overlaps = (a, b) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const displays = [{ x: -1920, y: 0, width: 1920, height: 1080 }];
  const placed = [];
  for (let i = 0; i < 6; i++) {
    const next = placeWidget({ x: -800, y: 100, width: 438, height: 350 }, placed, displays);
    assert.ok(placed.every((other) => !overlaps(next, other)));
    assert.ok(next.x >= -1920 && next.x + next.width <= 0);
    assert.ok(next.y >= 0 && next.y + next.height <= 1080);
    placed.push(next);
  }
  const full = { x: 0, y: 0, width: 320, height: 240 };
  assert.deepEqual(placeWidget(full, [full], [full]), full);
});

test('native widget moves and enlargement avoid existing visible windows', async (t) => {
  const { manager, created } = await fixture(t);
  await manager.show('note');
  await manager.show('todos');
  const note = created[0],
    todos = created[1];
  todos.setBounds(note.getBounds());
  await manager.saveBounds('todos', todos);
  const a = note.getBounds(),
    b = todos.getBounds();
  assert.ok(
    a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
  );
  await manager.save({ appearance: { todos: { size: 'large' } } });
  const c = todos.getBounds();
  assert.equal(c.width, 438);
  assert.ok(
    a.x + a.width <= c.x || c.x + c.width <= a.x || a.y + a.height <= c.y || c.y + c.height <= a.y,
  );
});
