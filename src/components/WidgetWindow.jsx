import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Cpu,
  StickyNote,
  ListTodo,
  X,
  Plus,
  Trash2,
  GripHorizontal,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Clock3,
  Timer,
} from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';
import { formatBytes } from '../utils';
import '../widgets.css';
import { widgetIds, widgetPresetSize } from '../../shared/widget-model';
import CurrencyConverter from './CurrencyConverter';
import { ClockWidget, FocusWidget } from './UtilityWidgets';
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
    let request = 0,
      receivedEvent = false;
    const receive = (value) => {
      if (alive.current) accept(value);
    };
    const appearance = () => {
      if (embedded) return;
      const current = ++request;
      api
        .getSettings()
        .then((value) => {
          if (alive.current && request === current) setSettings(value);
        })
        .catch(() => {});
    };
    const off = api.onWidgetsChanged?.((value) => {
      receivedEvent = true;
      receive(value);
    });
    const offSettings = !embedded
      ? api.onSettingsChanged?.((value) => {
          ++request;
          setSettings(value);
        })
      : null;
    api
      .widgetState()
      .then((value) => {
        if (!receivedEvent) receive(value);
      })
      .catch((reason) => {
        if (alive.current) setError(message.current(reason));
      });
    appearance();
    if (!embedded && id === 'note') window.__darkdeskWidgetFlush = commit;
    return () => {
      if (dirty.current) commit().catch(() => {});
      alive.current = false;
      off?.();
      offSettings?.();
      clearTimeout(timer.current);
      if (window.__darkdeskWidgetFlush === commit) delete window.__darkdeskWidgetFlush;
    };
  }, [accept, commit, embedded, id, setSettings]);
  useEffect(() => {
    if (id !== 'system' || state?.collapsed?.[id]) return;
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
    const clock = setInterval(poll, (state?.system?.interval || 2) * 1000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      active = false;
      clearInterval(clock);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [id, state?.collapsed?.[id], state?.system?.interval]);
  useEffect(() => {
    if (embedded || !state || state.collapsed?.[id] || !['note', 'todos'].includes(id)) return;
    const focusEditor = () =>
      document
        .querySelector(id === 'note' ? '.widget-content textarea' : '.widget-todo-form input')
        ?.focus();
    window.addEventListener('focus', focusEditor);
    focusEditor();
    return () => window.removeEventListener('focus', focusEditor);
  }, [embedded, id, !!state, state?.collapsed?.[id]]);
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
  const Icon = {
    system: Cpu,
    note: StickyNote,
    todos: ListTodo,
    currency: Coins,
    clock: Clock3,
    focus: Timer,
  }[id];
  return (
    <section
      className={
        'desktop-widget ' +
        (embedded ? 'widget-embedded ' : '') +
        (state?.collapsed?.[id] ? 'widget-collapsed' : '')
      }
      style={{
        '--widget-opacity': (state?.appearance?.[id]?.opacity ?? 92) + '%',
        '--widget-blur': (state?.appearance?.[id]?.blur ?? 24) + 'px',
        ...(embedded
          ? {
              height: state?.collapsed?.[id]
                ? 44
                : widgetPresetSize(id, state?.appearance?.[id]?.size).height,
            }
          : {}),
      }}
      aria-label={title}
    >
      <header className="widget-drag">
        <Icon size={16} />
        <b>{title}</b>
        <button
          type="button"
          className="widget-no-drag"
          disabled={!state}
          aria-expanded={!state?.collapsed?.[id]}
          aria-label={t(state?.collapsed?.[id] ? 'widgetPlus.expand' : 'widgetPlus.collapse', {
            name: title,
          })}
          onClick={() =>
            api
              .saveWidgets({ collapsed: { [id]: !state.collapsed?.[id] } })
              .then(accept)
              .catch((reason) => setError(message.current(reason)))
          }
        >
          {state?.collapsed?.[id] ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        <button
          className="widget-no-drag"
          type="button"
          aria-label={t('widgetPlus.hide', { name: title })}
          onClick={() => api.hideWidget(id).catch((reason) => setError(message.current(reason)))}
        >
          <X size={15} />
        </button>
      </header>
      <div className="widget-content" hidden={state?.collapsed?.[id]}>
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
            <div
              className="widget-memory-track"
              role="progressbar"
              aria-label={t('widgetPlus.memory')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={metrics?.memory ? Math.round(metrics.memory.percent) : undefined}
            >
              <i style={{ width: (metrics?.memory?.percent || 0) + '%' }} />
            </div>
            {state?.system?.cores && (
              <div className="widget-cores" aria-label={t('widgetPlus.cores')}>
                {metrics?.cores?.map((value, index) => (
                  <span
                    key={index}
                    title={t('widgetPlus.core', {
                      index: index + 1,
                      value: value === null ? '—' : Math.round(value) + '%',
                    })}
                  >
                    <i style={{ height: (value || 0) + '%' }} />
                  </span>
                ))}
              </div>
            )}
            {state?.system?.chart && (
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
            )}
            <small>
              {metrics?.memory
                ? formatBytes(metrics.memory.used, locale) +
                  ' / ' +
                  formatBytes(metrics.memory.total, locale)
                : t(native ? 'widgetPlus.warming' : 'widgetPlus.metricsDesktop')}
            </small>
            {state?.system?.details && metrics && !metrics.unsupported && (
              <dl className="widget-system-details">
                <div>
                  <dt>{t('widgetMore.processor')}</dt>
                  <dd>{metrics.cpuModel || '—'}</dd>
                </div>
                <div>
                  <dt>{t('widgetPlus.cores')}</dt>
                  <dd>
                    {metrics.coreCount} · {metrics.speedMHz || '—'} MHz
                  </dd>
                </div>
                <div>
                  <dt>{t('widgetMore.freeMemory')}</dt>
                  <dd>{metrics.memory ? formatBytes(metrics.memory.free, locale) : '—'}</dd>
                </div>
                <div>
                  <dt>{t('widgetMore.appMemory')}</dt>
                  <dd>{metrics.process ? formatBytes(metrics.process.rss, locale) : '—'}</dd>
                </div>
                <div>
                  <dt>{t('widgetMore.uptime')}</dt>
                  <dd>
                    {Number.isFinite(metrics.uptimeSeconds)
                      ? Math.floor(metrics.uptimeSeconds / 3600) +
                        'h ' +
                        Math.floor((metrics.uptimeSeconds % 3600) / 60) +
                        'm'
                      : '—'}
                  </dd>
                </div>
              </dl>
            )}
            {state?.system?.disk && metrics?.disk && (
              <div className="widget-disk">
                <span>
                  {t('widgetMore.diskFree')}: {formatBytes(metrics.disk.free, locale)} /{' '}
                  {formatBytes(metrics.disk.total, locale)}
                </span>
                <progress
                  aria-label={t('widgetMore.diskUsed')}
                  max="100"
                  value={metrics.disk.percent}
                />
              </div>
            )}
          </>
        ) : id === 'currency' ? (
          <CurrencyConverter compact />
        ) : id === 'clock' ? (
          <ClockWidget />
        ) : id === 'focus' ? (
          state && <FocusWidget value={state.focus} accept={accept} />
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
  return widgetIds.includes(id) ? <WidgetContent id={id} /> : null;
}
