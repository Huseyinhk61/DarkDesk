const path = require('node:path');
const { JsonStore } = require('./json-store.cjs');

function validBounds(value) {
  return (
    value &&
    ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(value[key])) &&
    value.width >= 320 &&
    value.height >= 240 &&
    value.width <= 20000 &&
    value.height <= 20000 &&
    Math.abs(value.x) <= 100000 &&
    Math.abs(value.y) <= 100000
  );
}
function overlap(a, b) {
  return (
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  );
}
function restoreWindowState(saved, displays, primaryId) {
  const available = displays.filter((display) => validBounds(display.workArea));
  const primary = available.find((display) => display.id === primaryId) ||
    available[0] || { workArea: { x: 0, y: 0, width: 1280, height: 800 } };
  const previous = validBounds(saved?.bounds) ? saved.bounds : null;
  const display = previous
    ? available.reduce(
        (best, candidate) =>
          overlap(previous, candidate.workArea) > overlap(previous, best.workArea)
            ? candidate
            : best,
        primary,
      )
    : primary;
  const area = display.workArea;
  const minWidth = Math.min(900, area.width),
    minHeight = Math.min(650, area.height);
  const width = Math.round(
    Math.min(area.width, Math.max(minWidth, previous?.width || Math.min(1440, area.width * 0.9))),
  );
  const height = Math.round(
    Math.min(
      area.height,
      Math.max(minHeight, previous?.height || Math.min(960, area.height * 0.9)),
    ),
  );
  const x = Math.round(
    Math.max(
      area.x,
      Math.min(area.x + area.width - width, previous?.x ?? area.x + (area.width - width) / 2),
    ),
  );
  const y = Math.round(
    Math.max(
      area.y,
      Math.min(area.y + area.height - height, previous?.y ?? area.y + (area.height - height) / 2),
    ),
  );
  return {
    bounds: { x, y, width, height },
    minWidth,
    minHeight,
    maximized: saved?.maximized === true,
  };
}
class WindowStateStore {
  constructor(directory) {
    this.store = new JsonStore(path.join(directory, 'window-state.json'), {});
    this.pending = Promise.resolve();
  }
  async read() {
    // A damaged presentation preference must never prevent the app from opening.
    try {
      return await this.store.read();
    } catch {
      return {};
    }
  }
  save(bounds, maximized) {
    if (!validBounds(bounds)) return Promise.resolve();
    const value = {
      bounds: Object.fromEntries(
        Object.entries(bounds).filter(([key]) => ['x', 'y', 'width', 'height'].includes(key)),
      ),
      maximized: maximized === true,
    };
    this.pending = this.pending.catch(() => {}).then(() => this.store.write(value));
    return this.pending;
  }
  flush() {
    return this.pending;
  }
}
module.exports = { restoreWindowState, WindowStateStore };
