import { normalizeWeather } from './weather.js';
export const widgetIds = ['system', 'note', 'todos', 'currency', 'clock', 'focus', 'weather'];
export const widgetSizes = {
  system: { width: 292, height: 230 },
  note: { width: 292, height: 236 },
  todos: { width: 292, height: 276 },
  currency: { width: 320, height: 380 },
  clock: { width: 292, height: 210 },
  focus: { width: 292, height: 250 },
  weather: { width: 292, height: 320 },
};
export const defaultWidgetState = {
  version: 1,
  weather: { location: null, unit: 'celsius' },
  note: '',
  todos: [],
  appearance: Object.fromEntries(
    widgetIds.map((id) => [id, { opacity: 92, size: 'compact', blur: 24 }]),
  ),
  system: { cores: true, chart: true, details: true, disk: true, interval: 2 },
  focus: {
    duration: 25,
    remaining: 1500,
    endsAt: null,
    breakDuration: 5,
    cycles: 4,
    completed: 0,
    phase: 'work',
    alarm: true,
    volume: 65,
    color: 'violet',
  },
  placement: 'desktop',
  collapsed: Object.fromEntries(widgetIds.map((id) => [id, false])),
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
    appearance: Object.fromEntries(
      widgetIds.map((id) => {
        const value = input.appearance?.[id] || { opacity: 92, size: 'compact' };
        if (
          !plain(value) ||
          !Number.isInteger(value.opacity) ||
          value.opacity < 25 ||
          value.opacity > 100 ||
          !['compact', 'regular', 'large'].includes(value.size)
        )
          invalid();
        if (
          !Number.isInteger(value.blur ?? 24) ||
          (value.blur ?? 24) < 0 ||
          (value.blur ?? 24) > 32
        )
          invalid();
        return [id, { opacity: value.opacity, size: value.size, blur: value.blur ?? 24 }];
      }),
    ),
    weather: normalizeWeather(input.weather),
    system: normalizeSystem(input.system),
    focus: normalizeFocus(input.focus),
    collapsed: Object.fromEntries(widgetIds.map((id) => [id, input.collapsed?.[id] === true])),
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
      (key) =>
        ![
          'weather',
          'note',
          'todos',
          'placement',
          'resetPositions',
          'collapsed',
          'appearance',
          'system',
          'focus',
        ].includes(key),
    ) ||
    ('resetPositions' in patch && patch.resetPositions !== true)
  )
    invalid();
  if (
    'collapsed' in patch &&
    (!plain(patch.collapsed) ||
      Object.entries(patch.collapsed).some(
        ([id, value]) => !widgetIds.includes(id) || typeof value !== 'boolean',
      ))
  )
    invalid();
  if (
    'appearance' in patch &&
    (!plain(patch.appearance) ||
      Object.keys(patch.appearance).some((id) => !widgetIds.includes(id)))
  )
    invalid();
  if (
    'system' in patch &&
    (!plain(patch.system) ||
      Object.keys(patch.system).some(
        (key) => !['cores', 'chart', 'details', 'disk', 'interval'].includes(key),
      ))
  )
    invalid();
  if (
    'focus' in patch &&
    (!plain(patch.focus) ||
      Object.keys(patch.focus).some(
        (key) =>
          ![
            'duration',
            'remaining',
            'endsAt',
            'breakDuration',
            'cycles',
            'completed',
            'phase',
            'alarm',
            'volume',
            'color',
          ].includes(key),
      ))
  )
    invalid();
  const appearance = structuredClone(current.appearance);
  for (const [id, value] of Object.entries(patch.appearance || {})) {
    if (
      !plain(value) ||
      Object.keys(value).some((key) => !['opacity', 'size', 'blur'].includes(key))
    )
      invalid();
    appearance[id] = { ...appearance[id], ...value };
  }
  const next = normalizeWidgetState({
    ...current,
    ...patch,
    appearance,
    system: { ...current.system, ...patch.system },
    focus: { ...current.focus, ...patch.focus },
    collapsed: { ...current.collapsed, ...patch.collapsed },
  });
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
function packedDefaults(screen) {
  const count = Math.max(1, Math.min(4, Math.floor((screen.width - 20) / 332))),
    bins = Array.from({ length: count }, () => ({ height: 0, items: [] }));
  const sorted = [...widgetIds].sort((a, b) => widgetSizes[b].height - widgetSizes[a].height);
  const fit = (index) => {
    if (index === sorted.length) return true;
    const id = sorted[index],
      height = widgetSizes[id].height;
    const seen = new Set();
    for (const bin of bins) {
      if (seen.has(bin.height)) continue;
      seen.add(bin.height);
      const before = bin.height,
        next = before + (before ? 12 : 0) + height;
      if (next > screen.height - 32) continue;
      bin.items.push({ id, top: before + (before ? 12 : 0) });
      bin.height = next;
      if (fit(index + 1)) return true;
      bin.items.pop();
      bin.height = before;
    }
    return false;
  };
  if (!fit(0)) return null;
  return Object.fromEntries(
    bins.flatMap((bin, column) =>
      bin.items.map(({ id, top }) => [
        id,
        {
          x: screen.x + screen.width - widgetSizes[id].width - 16 - column * 332,
          y: screen.y + 16 + top,
        },
      ]),
    ),
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
    Math.min(
      screen.width,
      Math.max(Math.min(size.width, screen.width), Math.min(previous?.width || size.width, 700)),
    ),
  );
  const height = Math.round(
    Math.min(
      screen.height,
      Math.max(
        Math.min(size.height, screen.height),
        Math.min(previous?.height || size.height, 900),
      ),
    ),
  );
  const columns = Math.max(1, Math.min(3, Math.floor((screen.width - 20) / 332))),
    row = Math.floor(index / columns),
    column = index % columns;
  let rowOffset = 0;
  for (let previousRow = 0; previousRow < row; previousRow++)
    rowOffset +=
      Math.max(
        ...widgetIds
          .slice(previousRow * columns, (previousRow + 1) * columns)
          .map((key) => widgetSizes[key].height),
      ) + 16;
  const packed = !previous ? packedDefaults(screen)?.[id] : null;
  const x = Math.round(
    Math.max(
      screen.x,
      Math.min(
        screen.x + screen.width - width,
        previous?.x ?? packed?.x ?? screen.x + screen.width - width - 16 - column * 332,
      ),
    ),
  );
  const y = Math.round(
    Math.max(
      screen.y,
      Math.min(
        screen.y + screen.height - height,
        previous?.y ?? packed?.y ?? screen.y + 32 + rowOffset,
      ),
    ),
  );
  return { x, y, width, height };
}

function normalizeSystem(value = defaultWidgetState.system) {
  if (
    !plain(value) ||
    ['cores', 'chart', 'details', 'disk'].some((key) => typeof value[key] !== 'boolean') ||
    ![1, 2, 5, 10].includes(value.interval)
  )
    invalid();
  return Object.fromEntries(
    ['cores', 'chart', 'details', 'disk', 'interval'].map((key) => [key, value[key]]),
  );
}
function normalizeFocus(value = defaultWidgetState.focus) {
  if (!plain(value)) invalid();
  value = { ...defaultWidgetState.focus, ...value };
  if (
    !Number.isInteger(value.breakDuration) ||
    value.breakDuration < 1 ||
    value.breakDuration > 60 ||
    !Number.isInteger(value.cycles) ||
    value.cycles < 1 ||
    value.cycles > 12 ||
    !Number.isInteger(value.completed) ||
    value.completed < 0 ||
    value.completed > value.cycles ||
    !['work', 'break'].includes(value.phase) ||
    typeof value.alarm !== 'boolean' ||
    !Number.isInteger(value.volume) ||
    value.volume < 0 ||
    value.volume > 100 ||
    !['violet', 'mint', 'blue', 'amber', 'rose'].includes(value.color)
  )
    invalid();
  if (
    !plain(value) ||
    !Number.isInteger(value.duration) ||
    value.duration < 1 ||
    value.duration > 180 ||
    !Number.isInteger(value.remaining) ||
    value.remaining < 0 ||
    value.remaining > (value.phase === 'break' ? value.breakDuration : value.duration) * 60 ||
    !(
      value.endsAt === null ||
      (Number.isSafeInteger(value.endsAt) && value.endsAt >= 0 && value.endsAt <= 8640000000000000)
    )
  )
    invalid();
  return Object.fromEntries(Object.keys(defaultWidgetState.focus).map((key) => [key, value[key]]));
}
export function focusSeconds(value, now = Date.now()) {
  return value.endsAt === null
    ? value.remaining
    : Math.max(
        0,
        Math.min(
          (value.phase === 'break' ? value.breakDuration : value.duration) * 60,
          Math.ceil((value.endsAt - now) / 1000),
        ),
      );
}
export function widgetPresetSize(id, size = 'compact') {
  const base = widgetSizes[id],
    scale = size === 'large' ? 1.5 : size === 'regular' ? 1.25 : 1;
  return { width: Math.round(base.width * scale), height: Math.round(base.height * scale) };
}

// Completion is claimed atomically by the native manager, across every renderer.
export function completeFocus(value, deadline, now = Date.now()) {
  if (!Number.isSafeInteger(deadline) || value.endsAt !== deadline || deadline > now) return null;
  const completed = value.phase === 'break' ? value.completed : value.completed + 1;
  const finished = completed >= value.cycles;
  const phase = value.phase === 'work' && !finished ? 'break' : 'work';
  return {
    ...value,
    completed: finished ? 0 : completed,
    phase,
    remaining: (phase === 'break' ? value.breakDuration : value.duration) * 60,
    endsAt: null,
  };
}
