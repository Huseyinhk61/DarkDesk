// Keep errors readable inside the active dialog while its background is inert.
const listeners = new Set();
export function publishNotice(message, kind) {
  for (const listener of listeners) listener({ message, kind });
}
export function subscribeNotices(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
