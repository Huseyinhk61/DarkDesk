import { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu, StickyNote, ListTodo, X, Plus, Trash2, GripHorizontal, Check } from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';
import { formatBytes } from '../utils';
import '../widgets.css';
export function WidgetContent({ id, embedded = false }) {
  const { t, setSettings, locale, errorMessage } = usePreferences();
  const [state, setState] = useState(null),
    [error, setError] = useState(''),
    [note, setNote] = useState(''),
    [newTask, setNewTask] = useState(''),
    [busy, setBusy] = useState(false),
    [metrics, setMetrics] = useState(null),
    [points, setPoints] = useState([]);
  const message = useRef(errorMessage);
  message.current = errorMessage;
  const draft = useRef(''),
    dirty = useRef(false),
    revision = useRef(0),
    timer = useRef(null),
    tail = useRef(Promise.resolve()),
    alive = useRef(true),
    action = useRef(false);
  const accept = useCallback((value) => {
    setState(value);
    if (!dirty.current) {
      draft.current = value.note;
      setNote(value.note);
    }
  }, []);
  const commit = useCallback(() => {
    clearTimeout(timer.current);
    if (!dirty.current) return tail.current;
    const text = draft.current,
      version = revision.current;
    const work = tail.current.catch(() => {}).then(() => api.saveWidgets({ note: text }));
    tail.current = work;
    return work
      .then((value) => {
        if (alive.current) {
          if (version === revision.current) dirty.current = false;
          accept(value);
          setError('');
        }
        return value;
      })
      .catch((reason) => {
        if (alive.current) setError(message.current(reason));
        throw reason;
      });
  }, [accept]);
  useEffect(() => {
    alive.current = true;
    let request = 0;
    const receive = (value) => {
      if (alive.current) accept(value);
    };
    const appearance = () => {
      const current = ++request;
      api
        .getSettings()
        .then((value) => {
          if (alive.current && request === current) setSettings(value);
        })
        .catch(() => {});
    };
    const off = api.onWidgetsChanged?.((value) => {
      receive(value);
      appearance();
    });
    api
      .widgetState()
      .then(receive)
      .catch((reason) => {
        if (alive.current) setError(message.current(reason));
      });
    appearance();
    if (!embedded && id === 'note') window.__darkdeskWidgetFlush = commit;
    return () => {
      if (dirty.current) commit().catch(() => {});
      alive.current = false;
      off?.();
      clearTimeout(timer.current);
      if (window.__darkdeskWidgetFlush === commit) delete window.__darkdeskWidgetFlush;
    };
  }, [accept, commit, embedded, id, setSettings]);
  useEffect(() => {
    if (id !== 'system') return;
    let active = true;
    const poll = () => {
      if (document.hidden) return;
      api
        .systemToolsSnapshot()
        .then((value) => {
          if (!active) return;
          setMetrics(value);
          if (Number.isFinite(value.cpuPercent))
            setPoints((previous) => [...previous.slice(-39), value.cpuPercent]);
        })
        .catch(() => {});
    };
    poll();
    const clock = setInterval(poll, 2000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      active = false;
      clearInterval(clock);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [id]);
  const updateTodos = async (todos) => {
    if (action.current) return false;
    action.current = true;
    setBusy(true);
    setError('');
    try {
      const value = await api.saveWidgets({ todos });
      if (alive.current) accept(value);
      return true;
    } catch (reason) {
      if (alive.current) setError(message.current(reason));
      return false;
    } finally {
      action.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const title = t('widgetPlus.' + id);
  const Icon = id === 'system' ? Cpu : id === 'note' ? StickyNote : ListTodo;
  return (
    <section className={'desktop-widget ' + (embedded ? 'widget-embedded' : '')} aria-label={title}>
      <header className="widget-drag">
        <Icon size={16} />
        <b>{title}</b>
        <GripHorizontal size={15} />
        <button
          className="widget-no-drag"
          type="button"
          aria-label={t('widgetPlus.hide', { name: title })}
          onClick={() => api.hideWidget(id).catch((reason) => setError(message.current(reason)))}
        >
          <X size={15} />
        </button>
      </header>
      <div className="widget-content">
        {id === 'system' ? (
          <>
            <div className="widget-metric-row">
              <span>
                CPU
                <strong>
                  {Number.isFinite(metrics?.cpuPercent)
                    ? Math.round(metrics.cpuPercent) + '%'
                    : '—'}
                </strong>
              </span>
              <span>
                {t('widgetPlus.memory')}
                <strong>{metrics?.memory ? Math.round(metrics.memory.percent) + '%' : '—'}</strong>
              </span>
            </div>
            <svg
              className="widget-chart"
              viewBox="0 0 280 72"
              role="img"
              aria-label={t('widgetPlus.cpuChart')}
            >
              <path d="M0 24H280M0 48H280" className="widget-gridline" />
              {points.length > 1 && (
                <polyline
                  fill="none"
                  points={points
                    .map(
                      (value, index) =>
                        `${(index * 280) / Math.max(1, points.length - 1)},${70 - value * 0.66}`,
                    )
                    .join(' ')}
                />
              )}
            </svg>
            <small>
              {metrics?.memory
                ? formatBytes(metrics.memory.used, locale) +
                  ' / ' +
                  formatBytes(metrics.memory.total, locale)
                : t(native ? 'widgetPlus.warming' : 'widgetPlus.metricsDesktop')}
            </small>
          </>
        ) : id === 'note' ? (
          <>
            <label className="sr-only" htmlFor={'widget-note-' + (embedded ? 'preview' : 'native')}>
              {t('widgetPlus.noteLabel')}
            </label>
            <textarea
              id={'widget-note-' + (embedded ? 'preview' : 'native')}
              value={note}
              disabled={!state}
              maxLength={20000}
              placeholder={t('widgetPlus.notePlaceholder')}
              onChange={(event) => {
                const value = event.target.value;
                draft.current = value;
                dirty.current = true;
                revision.current++;
                setNote(value);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => commit().catch(() => {}), 400);
              }}
            />
            <small className="widget-autosave">{t('widgetPlus.autosave')}</small>
            {error && (
              <button type="button" onClick={() => commit().catch(() => {})}>
                {t('widgetPlus.retrySave')}
              </button>
            )}
          </>
        ) : (
          <>
            <form
              className="widget-todo-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!newTask.trim() || !state || state.todos.length >= 100 || busy) return;
                const text = newTask.trim();
                if (
                  await updateTodos([
                    ...state.todos,
                    { id: crypto.randomUUID(), text, done: false },
                  ])
                )
                  setNewTask((current) => (current.trim() === text ? '' : current));
              }}
            >
              <input
                aria-label={t('widgetPlus.taskLabel')}
                placeholder={t('widgetPlus.taskPlaceholder')}
                value={newTask}
                maxLength={500}
                onChange={(event) => setNewTask(event.target.value)}
              />
              <button
                disabled={busy || !newTask.trim() || !state || state.todos.length >= 100}
                aria-label={t('widgetPlus.addTask')}
              >
                <Plus size={17} />
              </button>
            </form>
            <ul className="widget-todos">
              {state?.todos.map((todo) => (
                <li key={todo.id} className={todo.done ? 'done' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={todo.done}
                      disabled={busy}
                      onChange={() =>
                        updateTodos(
                          state.todos.map((item) =>
                            item.id === todo.id ? { ...item, done: !item.done } : item,
                          ),
                        )
                      }
                    />
                    <span>{todo.text}</span>
                  </label>
                  <button
                    disabled={busy}
                    aria-label={t('widgetPlus.removeTask', { name: todo.text })}
                    onClick={() => updateTodos(state.todos.filter((item) => item.id !== todo.id))}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
            {!state?.todos.length && (
              <p className="widget-empty">
                <Check size={22} />
                {t('widgetPlus.emptyTodos')}
              </p>
            )}
            <small>
              {t('widgetPlus.taskCount', {
                done: state?.todos.filter((todo) => todo.done).length || 0,
                total: state?.todos.length || 0,
              })}
            </small>
          </>
        )}
        {error && (
          <p className="widget-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
export default function WidgetWindow() {
  const id = new URLSearchParams(window.location.hash.slice(1)).get('widget');
  return ['system', 'note', 'todos'].includes(id) ? <WidgetContent id={id} /> : null;
}
