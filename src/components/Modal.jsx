import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Modal({ title, onClose, children, labelledBy = 'dialog-title' }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () => [
      ...ref.current.querySelectorAll('button:not(:disabled), input, select, [tabindex="0"]'),
    ];
    focusable()[0]?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const list = focusable();
        const first = list[0];
        const last = list.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="modal preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <button className="modal-close" onClick={onClose} aria-label="Pencereyi kapat">
          <X size={18} />
        </button>
        <h2 id={labelledBy}>{title}</h2>
        {children}
      </section>
    </div>
  );
}
