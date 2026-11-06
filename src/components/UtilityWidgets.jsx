import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { focusSeconds } from '../../shared/widget-model';
import { api } from '../service';
import { usePreferences } from '../preferences';
export function ClockWidget() {
  const { locale, t } = usePreferences();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="clock-widget">
      <strong>
        {now.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })}
      </strong>
      <p>{now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <small>
        {t('widgetMore.localTime')} · {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </small>
    </div>
  );
}
export function FocusWidget({ value, accept }) {
  const { t } = usePreferences();
  const [now, setNow] = useState(Date.now),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const finishing = useRef(false);
  const remaining = focusSeconds(value, now);
  const save = async (focus) => {
    setBusy(true);
    try {
      accept(await api.saveWidgets({ focus }));
      setError('');
    } catch {
      setError(t('widgetMore.saveError'));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (value.endsAt !== null && remaining === 0 && !finishing.current) {
      finishing.current = true;
      save({ ...value, remaining: 0, endsAt: null }).finally(() => {
        finishing.current = false;
      });
    }
  }, [remaining, value.endsAt]);
  return (
    <div className="focus-widget">
      <strong role="timer">
        {String(Math.floor(remaining / 60)).padStart(2, '0')}:
        {String(remaining % 60).padStart(2, '0')}
      </strong>
      <p>
        {t(
          remaining === 0
            ? 'widgetMore.focusDone'
            : value.endsAt !== null
              ? 'widgetMore.focusRunning'
              : 'widgetMore.focusReady',
        )}
      </p>
      <label>
        {t('widgetMore.minutes')}
        <input
          type="number"
          min="1"
          max="180"
          aria-label={t('widgetMore.minutes')}
          value={value.duration}
          disabled={busy || value.endsAt !== null}
          onChange={(e) => {
            const duration = Number(e.target.value);
            if (Number.isInteger(duration) && duration >= 1 && duration <= 180)
              save({ duration, remaining: duration * 60, endsAt: null });
          }}
        />
      </label>
      <div className="currency-actions">
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => {
            const seconds = remaining || value.duration * 60;
            save({
              ...value,
              remaining: seconds,
              endsAt: value.endsAt === null ? Date.now() + seconds * 1000 : null,
            });
          }}
        >
          {value.endsAt === null ? <Play size={14} /> : <Pause size={14} />}{' '}
          {t(value.endsAt === null ? 'widgetMore.start' : 'widgetMore.pause')}
        </button>
        <button
          type="button"
          className="tool-btn"
          disabled={busy}
          aria-label={t('widgetMore.reset')}
          onClick={() => save({ ...value, remaining: value.duration * 60, endsAt: null })}
        >
          <RotateCcw size={15} />
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
