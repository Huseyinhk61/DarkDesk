import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { usePreferences } from '../preferences';
import { useDialog } from '../useDialog';
import { subscribeNotices } from '../notifications';
export default function Modal({ title, onClose, children, labelledBy = 'dialog-title' }) {
  const { t } = usePreferences();
  const ref = useRef(null);
  const layer = useRef(null);
  const [feedback, setFeedback] = useState('');
  useEffect(
    () =>
      subscribeNotices(({ message, kind }) => {
        if (kind === 'error' && ref.current && !ref.current.closest('[inert]'))
          setFeedback(message);
      }),
    [],
  );
  useDialog({ layer, panel: ref, onClose });
  return createPortal(
    <div
      ref={layer}
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <section
        ref={ref}
        className="modal preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onChangeCapture={() => setFeedback('')}
      >
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <X size={18} />
        </button>
        <h2 id={labelledBy}>{title}</h2>
        {feedback && (
          <p className="notice warning" role="alert">
            {feedback}
          </p>
        )}
        {children}
      </section>
    </div>,
    document.body,
  );
}
