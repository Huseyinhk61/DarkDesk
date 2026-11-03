export function matchesAccelerator(accelerator, event, mac = false) {
  const parts = accelerator.toLowerCase().split('+'),
    key = parts.pop();
  const expected = { ctrl: false, alt: false, shift: false, meta: false };
  for (const part of parts) {
    if (part === 'commandorcontrol') expected[mac ? 'meta' : 'ctrl'] = true;
    else if (['control', 'ctrl'].includes(part)) expected.ctrl = true;
    else if (part === 'alt') expected.alt = true;
    else if (part === 'shift') expected.shift = true;
    else expected.meta = true;
  }
  const actual =
    event.code === 'Space'
      ? 'space'
      : /^Digit\d$/.test(event.code)
        ? event.code.at(-1)
        : event.key.toLowerCase();
  return (
    key === actual &&
    !!event.ctrlKey === expected.ctrl &&
    !!event.altKey === expected.alt &&
    !!event.shiftKey === expected.shift &&
    !!event.metaKey === expected.meta
  );
}

// KeyboardEvent.code keeps letters/digits stable across keyboard layouts.
export function acceleratorFromEvent(event, mac = false) {
  if (event.isComposing || event.repeat || event.getModifierState?.('AltGraph')) return null;
  const key =
    event.code === 'Space'
      ? 'Space'
      : /^(Key[A-Z]|Digit[0-9])$/.test(event.code)
        ? event.code.replace(/^(Key|Digit)/, '')
        : /^F([1-9]|1[0-9]|2[0-4])$/.test(event.key)
          ? event.key
          : null;
  if (!key || !(event.ctrlKey || event.altKey || event.metaKey)) return null;
  const modifiers = [];
  if (mac ? event.metaKey : event.ctrlKey) modifiers.push('CommandOrControl');
  if (mac && event.ctrlKey) modifiers.push('Control');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  if (!mac && event.metaKey) modifiers.push('Super');
  return [...modifiers, key].join('+');
}
export function displayAccelerator(value, mac = false) {
  return value
    .replace(/CommandOrControl/g, mac ? '⌘' : 'Ctrl')
    .replace(/Super/g, mac ? '⌘' : 'Win');
}
export function shortcutConflict(value, assignments, currentId) {
  const normalized = (shortcut) =>
    shortcut
      .toLowerCase()
      .split('+')
      .map((part) => (['control', 'ctrl'].includes(part) ? 'commandorcontrol' : part))
      .sort()
      .join('+');
  return assignments.find(
    (entry) => entry.id !== currentId && normalized(entry.accelerator) === normalized(value),
  );
}
