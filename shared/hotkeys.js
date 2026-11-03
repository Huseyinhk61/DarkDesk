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
