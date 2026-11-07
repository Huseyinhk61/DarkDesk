import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { notePages } from '../../shared/note-pages';
import { usePreferences } from '../preferences';
export default function PagedNoteEditor({ value, onChange, ...props }) {
  const { t } = usePreferences(),
    editor = useRef(null),
    pendingCaret = useRef(null);
  const [capacity, setCapacity] = useState({ columns: 24, rows: 4 }),
    [requested, setRequested] = useState(0);
  const pages = notePages(value, capacity.columns, capacity.rows),
    page = Math.min(requested, pages.length - 1),
    range = pages[page];
  useLayoutEffect(() => {
    const element = editor.current;
    const measure = () => {
      const style = getComputedStyle(element),
        canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = style.font;
      const width =
        element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 4;
      const height =
        element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setCapacity({
        columns: Math.max(2, Math.floor(width / context.measureText('M').width) - 1),
        rows: Math.max(1, Math.floor(height / parseFloat(style.lineHeight)) - 1),
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    const offset = pendingCaret.current;
    const target = pages.findIndex(
      (r, i) => offset >= r.start && (offset < r.end || i === pages.length - 1),
    );
    if (target !== page) {
      setRequested(Math.max(0, target));
      return;
    }
    editor.current.setSelectionRange(offset - range.start, offset - range.start);
    pendingCaret.current = null;
  }, [value, page, capacity]);
  return (
    <div className="paged-note">
      <textarea
        {...props}
        ref={editor}
        value={value.slice(range.start, range.end)}
        onChange={(event) => {
          const local = event.target.value;
          if (value.length - (range.end - range.start) + local.length > 20000) return;
          pendingCaret.current = range.start + event.target.selectionStart;
          onChange(value.slice(0, range.start) + local + value.slice(range.end));
        }}
      />
      <div className="widget-page-controls">
        <button
          type="button"
          disabled={!page}
          aria-label={t('ux311.previous')}
          onClick={() => setRequested(page - 1)}
        >
          <ChevronLeft size={14} />
        </button>
        <small>
          {page + 1} / {pages.length}
        </small>
        <button
          type="button"
          disabled={page >= pages.length - 1}
          aria-label={t('ux311.next')}
          onClick={() => setRequested(page + 1)}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
