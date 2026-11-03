import { useLayoutEffect, useRef } from 'react';

// Portal dialogs share a stack so closing an inner dialog never unlocks the
// underlying application while another dialog still owns focus.
const dialogs = [];
const background = new Map();
function synchronizeBackground() {
  const top = dialogs.at(-1);
  for (const child of document.body.children) {
    if (!background.has(child))
      background.set(child, {
        inert: child.inert,
        ariaHidden: child.getAttribute('aria-hidden'),
      });
  }
  for (const [child, previous] of background) {
    if (top && child !== top.layer) {
      child.inert = true;
      child.setAttribute('aria-hidden', 'true');
    } else {
      child.inert = previous.inert;
      if (previous.ariaHidden === null) child.removeAttribute('aria-hidden');
      else child.setAttribute('aria-hidden', previous.ariaHidden);
    }
  }
  if (!top) background.clear();
}
function focusable(container) {
  return [
    ...container.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex], [contenteditable="true"]',
    ),
  ].filter(
    (node) =>
      node.tabIndex >= 0 &&
      !node.matches(':disabled') &&
      !node.closest('[inert], [hidden]') &&
      node.getClientRects().length > 0 &&
      getComputedStyle(node).visibility !== 'hidden',
  );
}
export function useDialog({ layer, panel, onClose, initialFocus }) {
  const close = useRef(onClose);
  // Capture before React commits autoFocus inputs inside the portal. Reading
  // activeElement in the layout effect would capture the dialog's own input.
  const opener = useRef(document.activeElement);
  close.current = onClose;
  useLayoutEffect(() => {
    const record = { layer: layer.current, panel: panel.current };
    const previous = opener.current;
    dialogs.push(record);
    // Move focus before hiding the application from accessibility APIs.
    (initialFocus?.current || focusable(record.panel)[0] || record.panel).focus();
    synchronizeBackground();
    const onKey = (event) => {
      if (dialogs.at(-1) !== record || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close.current?.();
      }
      if (event.key !== 'Tab') return;
      const items = focusable(record.panel);
      const first = items[0] || record.panel;
      const last = items.at(-1) || record.panel;
      const outside = !record.panel.contains(document.activeElement);
      if (outside || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const containFocus = (event) => {
      if (dialogs.at(-1) === record && !record.panel.contains(event.target))
        (focusable(record.panel)[0] || record.panel).focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', containFocus);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', containFocus);
      const index = dialogs.indexOf(record);
      if (index >= 0) dialogs.splice(index, 1);
      synchronizeBackground();
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus();
    };
    // Re-rendering a form must not move the caret or reinitialize its focus.
  }, [layer, panel, initialFocus]);
}
