const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ShortcutManager } = require('./runtime/shortcuts.cjs');
const { acceleratorFromEvent, shortcutConflict } = require('../shared/hotkeys.js');
function fixture(options = {}) {
  const held = new Map(),
    blocked = new Set(),
    calls = [],
    events = [];
  const adapter = {
    register(key, callback) {
      calls.push(['register', key]);
      if (blocked.has(key) || held.has(key)) return false;
      held.set(key, callback);
      return true;
    },
    unregister(key) {
      calls.push(['unregister', key]);
      held.delete(key);
    },
  };
  const manager = new ShortcutManager(adapter, {
    launcher: () => events.push('launcher'),
    profile: (id) => events.push(id),
    ...options,
  });
  const settings = {
    launcherShortcut: 'Alt+Space',
    profiles: [{ id: 'coding', shortcut: 'CommandOrControl+Alt+1' }],
  };
  return { manager, held, blocked, calls, events, settings };
}
test('unavailable replacement keeps every old shortcut and callback working', () => {
  const { manager, held, blocked, events, settings } = fixture();
  manager.configure(settings);
  blocked.add('Alt+X');
  assert.throws(
    () => manager.configure({ ...settings, launcherShortcut: 'Alt+X' }, { strict: true }),
    /SHORTCUT_UNAVAILABLE/,
  );
  assert.equal(held.size, 2);
  held.get('Alt+Space')();
  held.get('CommandOrControl+Alt+1')();
  assert.deepEqual(events, ['launcher', 'coding']);
  assert.ok(manager.status().every((entry) => entry.registered));
  manager.dispose();
});
test('partial reservation is rolled back when a later key is unavailable', () => {
  const { manager, held, blocked, settings } = fixture();
  manager.configure(settings);
  blocked.add('Alt+Z');
  assert.throws(
    () =>
      manager.configure(
        { launcherShortcut: 'Alt+X', profiles: [{ id: 'coding', shortcut: 'Alt+Z' }] },
        { strict: true },
      ),
    /SHORTCUT_UNAVAILABLE/,
  );
  assert.deepEqual([...held.keys()], ['Alt+Space', 'CommandOrControl+Alt+1']);
  manager.dispose();
});
test('unrelated preference saves do not unregister working keys or reject an existing OS conflict', () => {
  const { manager, blocked, calls, settings } = fixture();
  blocked.add('Alt+Space');
  manager.configure(settings);
  const callsBefore = calls.filter(([action, key]) => key === 'CommandOrControl+Alt+1').length;
  manager.configure({ ...settings, theme: 'slate' }, { strict: true });
  assert.equal(
    calls.filter(([action, key]) => key === 'CommandOrControl+Alt+1').length,
    callsBefore,
  );
  assert.equal(manager.status()[0].reason, 'occupied');
  manager.dispose();
});
test('swapping owned keys changes actions without releasing registrations', () => {
  const { manager, held, calls, events, settings } = fixture();
  manager.configure(settings);
  calls.length = 0;
  manager.configure(
    {
      launcherShortcut: settings.profiles[0].shortcut,
      profiles: [{ id: 'coding', shortcut: settings.launcherShortcut }],
    },
    { strict: true },
  );
  assert.equal(calls.length, 0);
  held.get('Alt+Space')();
  held.get('CommandOrControl+Alt+1')();
  assert.deepEqual(events, ['coding', 'launcher']);
  manager.dispose();
});
test('recording suspends keys, obsolete cleanup tokens cannot end a newer recorder, and resume restores actions', () => {
  const { manager, held, settings } = fixture();
  manager.configure(settings);
  const oldToken = manager.suspend();
  const token = manager.suspend();
  assert.equal(held.size, 0);
  manager.resume(oldToken);
  assert.equal(held.size, 0);
  manager.resume(token);
  assert.equal(held.size, 2);
  assert.ok(manager.status().every((entry) => entry.registered));
  manager.dispose();
});
test('abandoned key recorder automatically restores registrations', async () => {
  const { manager, held, settings } = fixture({ captureTimeout: 10 });
  manager.configure(settings);
  manager.suspend();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(held.size, 2);
  manager.dispose();
});
test('a key claimed by another app during capture is reported after resume', () => {
  const { manager, blocked, settings } = fixture();
  manager.configure(settings);
  const token = manager.suspend();
  blocked.add('Alt+Space');
  manager.resume(token);
  assert.equal(manager.status()[0].registered, false);
  assert.equal(manager.status()[0].reason, 'occupied');
  manager.dispose();
});
test('key binder captures physical letters and rejects unmodified or composing events', () => {
  assert.equal(
    acceleratorFromEvent({ code: 'KeyI', key: 'ı', ctrlKey: true, altKey: true }),
    'CommandOrControl+Alt+I',
  );
  assert.equal(
    acceleratorFromEvent({ code: 'Space', key: ' ', ctrlKey: true, shiftKey: true }),
    'CommandOrControl+Shift+Space',
  );
  assert.equal(acceleratorFromEvent({ code: 'KeyI', key: 'i' }), null);
  assert.equal(
    acceleratorFromEvent({ code: 'KeyI', key: 'i', ctrlKey: true, isComposing: true }),
    null,
  );
  assert.equal(
    acceleratorFromEvent({
      code: 'KeyI',
      key: 'i',
      ctrlKey: true,
      getModifierState: (key) => key === 'AltGraph',
    }),
    null,
  );
});
test('local conflict check normalizes aliases and reordered modifiers without rewriting canonical names', () => {
  const entries = [{ id: 'launcher', accelerator: 'CommandOrControl+Alt+I' }];
  assert.equal(shortcutConflict('Alt+Ctrl+I', entries, 'coding')?.id, 'launcher');
  assert.equal(shortcutConflict('Alt+CommandOrControl+I', entries, 'coding')?.id, 'launcher');
  assert.equal(shortcutConflict('Alt+Ctrl+I', entries, 'launcher'), undefined);
});
