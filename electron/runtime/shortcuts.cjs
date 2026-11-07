const { randomUUID } = require('node:crypto');

// Own only this application's registrations. New combinations are reserved before
// old ones are released, so an unavailable replacement never destroys a working key.
class ShortcutManager {
  constructor(
    adapter,
    { launcher, profile, restore, onStatus = () => {}, captureTimeout = 30000 } = {},
  ) {
    this.adapter = adapter;
    this.actions = { launcher, profile, restore };
    this.onStatus = onStatus;
    this.captureTimeout = captureTimeout;
    this.entries = new Map();
    this.capture = null;
  }
  status() {
    return [...this.entries.values()].map(({ id, accelerator, registered, reason }) => ({
      id,
      accelerator,
      registered,
      reason,
    }));
  }
  publish() {
    const status = this.status();
    this.onStatus(status);
    return status;
  }
  register(accelerator) {
    try {
      return (
        this.adapter.register(accelerator, () => {
          const entry = this.entries.get(accelerator);
          if (!this.capture && entry?.registered) entry.action?.();
        }) === true
      );
    } catch {
      return false;
    }
  }
  configure(settings, { strict = false } = {}) {
    if (this.capture) this.resume(this.capture.token);
    const list = [
      { id: 'launcher', accelerator: settings.launcherShortcut, action: this.actions.launcher },
      ...(settings.restoreShortcut
        ? [{ id: 'restore', accelerator: settings.restoreShortcut, action: this.actions.restore }]
        : []),
      ...settings.profiles.map((p) => ({
        id: 'profile:' + p.id,
        accelerator: p.shortcut,
        action: () => this.actions.profile?.(p.id),
      })),
    ];
    if (new Set(list.map((e) => e.accelerator.toLowerCase())).size !== list.length)
      throw Error('SHORTCUT_DUPLICATE');
    const acquired = [];
    for (const entry of list) {
      entry.registered = this.entries.get(entry.accelerator)?.registered || false;
      if (!entry.registered) {
        entry.registered = this.register(entry.accelerator);
        if (entry.registered) acquired.push(entry.accelerator);
      }
      entry.reason = entry.registered ? null : 'occupied';
      if (strict && !entry.registered && this.entries.get(entry.accelerator)?.id !== entry.id) {
        for (const accelerator of acquired) this.adapter.unregister(accelerator);
        throw Error('SHORTCUT_UNAVAILABLE: ' + entry.accelerator);
      }
    }
    const next = new Map(list.map((entry) => [entry.accelerator, entry]));
    for (const old of this.entries.values())
      if (old.registered && !next.has(old.accelerator)) this.adapter.unregister(old.accelerator);
    this.entries = next;
    return this.publish();
  }
  suspend() {
    // A new recorder replaces any stale recorder. The token prevents an old
    // component cleanup from ending a newer recording session.
    if (this.capture) clearTimeout(this.capture.timer);
    else
      for (const entry of this.entries.values()) {
        if (entry.registered) this.adapter.unregister(entry.accelerator);
        entry.registered = false;
        entry.reason = 'recording';
      }
    const token = randomUUID();
    const timer = setTimeout(() => this.resume(token), this.captureTimeout);
    timer.unref?.();
    this.capture = { token, timer };
    this.publish();
    return token;
  }
  resume(token) {
    if (!this.capture || (token !== undefined && this.capture.token !== token))
      return this.status();
    clearTimeout(this.capture.timer);
    this.capture = null;
    for (const entry of this.entries.values()) {
      entry.registered = this.register(entry.accelerator);
      entry.reason = entry.registered ? null : 'occupied';
    }
    return this.publish();
  }
  dispose() {
    if (this.capture) clearTimeout(this.capture.timer);
    this.capture = null;
    for (const entry of this.entries.values())
      if (entry.registered) this.adapter.unregister(entry.accelerator);
    this.entries.clear();
  }
}
module.exports = { ShortcutManager };
