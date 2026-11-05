export const widgetIds = ['system', 'note', 'todos'];
export const widgetSizes = {
  system: { width: 320, height: 236 },
  note: { width: 340, height: 340 },
  todos: { width: 340, height: 380 },
};
export const defaultWidgetState = {
  version: 1,
  note: '',
  todos: [],
  placement: 'desktop',
  widgets: Object.fromEntries(widgetIds.map((id) => [id, { enabled: false, bounds: null }])),
};
const plain = (value) => value && typeof value === 'object' && !Array.isArray(value);
const invalid = () => {
  throw Error('WIDGETS_INVALID');
};
export function validWidgetBounds(value) {
  return (
    plain(value) &&
    ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(value[key])) &&
    Math.abs(value.x) <= 100000 &&
    Math.abs(value.y) <= 100000 &&
    value.width >= 100 &&
    value.width <= 1200 &&
    value.height >= 100 &&
    value.height <= 1200
  );
}
export function normalizeWidgetState(input = defaultWidgetState) {
  if (
    !plain(input) ||
    typeof input.note !== 'string' ||
    input.note.length > 20000 ||
    !Array.isArray(input.todos) ||
    input.todos.length > 100 ||
    !['desktop', 'floating'].includes(input.placement)
  )
    invalid();
  const ids = new Set();
  const todos = input.todos.map((todo) => {
    if (
      !plain(todo) ||
      typeof todo.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(todo.id) ||
      ids.has(todo.id) ||
      typeof todo.text !== 'string' ||
      !todo.text.trim() ||
      todo.text.length > 500 ||
      typeof todo.done !== 'boolean'
    )
      invalid();
    ids.add(todo.id);
    return { id: todo.id, text: todo.text.trim(), done: todo.done };
  });
  return {
    version: 1,
    note: input.note,
    todos,
    placement: input.placement,
    widgets: Object.fromEntries(
      widgetIds.map((id) => {
        const value = input.widgets?.[id];
        return [
          id,
          {
            enabled: value?.enabled === true,
            bounds: validWidgetBounds(value?.bounds)
              ? Object.fromEntries(
                  ['x', 'y', 'width', 'height'].map((key) => [key, Math.round(value.bounds[key])]),
                )
              : null,
          },
        ];
      }),
    ),
  };
}
export function validateWidgetPatch(current, patch) {
  if (
    !plain(patch) ||
    Object.keys(patch).some(
      (key) => !['note', 'todos', 'placement', 'resetPositions'].includes(key),
    ) ||
    ('resetPositions' in patch && patch.resetPositions !== true)
  )
    invalid();
  const next = normalizeWidgetState({ ...current, ...patch });
  if (patch.resetPositions)
    widgetIds.forEach((id) => {
      next.widgets[id].bounds = null;
    });
  return next;
}
function area(value) {
  return (
    plain(value) &&
    ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(value[key])) &&
    value.width > 0 &&
    value.height > 0
  );
}
function overlap(a, b) {
  return (
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  );
}
export function restoreWidgetBounds(id, saved, displays = []) {
  if (!widgetIds.includes(id)) invalid();
  const available = displays.map((display) => display.workArea || display).filter(area);
  const primary = available[0] || { x: 0, y: 0, width: 1280, height: 800 };
  const previous = validWidgetBounds(saved) ? saved : null;
  const screen = previous
    ? available.reduce(
        (best, candidate) =>
          overlap(previous, candidate) > overlap(previous, best) ? candidate : best,
        primary,
      )
    : primary;
  const size = widgetSizes[id],
    index = widgetIds.indexOf(id);
  const width = Math.round(
    Math.min(screen.width, Math.max(Math.min(240, screen.width), previous?.width || size.width)),
  );
  const height = Math.round(
    Math.min(
      screen.height,
      Math.max(Math.min(180, screen.height), previous?.height || size.height),
    ),
  );
  const x = Math.round(
    Math.max(
      screen.x,
      Math.min(
        screen.x + screen.width - width,
        previous?.x ?? screen.x + screen.width - width - 24 - index * 22,
      ),
    ),
  );
  const y = Math.round(
    Math.max(
      screen.y,
      Math.min(screen.y + screen.height - height, previous?.y ?? screen.y + 32 + index * 38),
    ),
  );
  return { x, y, width, height };
}
