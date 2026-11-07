import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { armFocusAudio, playFocusBell } from '../focus-alarm';
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
  const [settingsOpen, setSettingsOpen] = useState(false),
    [settingsTab, setSettingsTab] = useState('timer');
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
      api
        .completeFocus(value.endsAt)
        .then(async (result) => {
          accept(result.state);
          if (result.completed && value.alarm) await playFocusBell(value.volume);
        })
        .catch(() => setError(t('focusPlus.soundError')))
        .finally(() => {
          finishing.current = false;
        });
    }
  }, [remaining, value.endsAt]);
  return (
    <div
      className={'focus-widget ' + (settingsOpen ? 'focus-settings-open' : '')}
      style={{
        '--focus-accent': {
          violet: '#b9a4ff',
          mint: '#79dfb4',
          blue: '#8ebcff',
          amber: '#ffd181',
          rose: '#f4a5c4',
        }[value.color || 'violet'],
      }}
    >
      <small>
        {t(value.phase === 'break' ? 'focusPlus.rest' : 'focusPlus.work')} · {t('focusPlus.cycle')}{' '}
        {(value.completed || 0) + (value.phase === 'break' ? 0 : 1)}/{value.cycles || 4}
      </small>
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
              save({
                duration,
                remaining: duration * 60,
                endsAt: null,
                phase: 'work',
                completed: 0,
              });
          }}
        />
      </label>
      <div className="currency-actions">
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => {
            if (value.alarm) armFocusAudio().catch(() => setError(t('focusPlus.soundError')));
            const seconds =
              remaining || (value.phase === 'break' ? value.breakDuration : value.duration) * 60;
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
          onClick={() =>
            save({
              ...value,
              remaining: value.duration * 60,
              endsAt: null,
              phase: 'work',
              completed: 0,
            })
          }
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <details open={settingsOpen} onToggle={(event) => setSettingsOpen(event.currentTarget.open)}>
        <summary>{t('focusPlus.settings')}</summary>
        <div className="focus-settings-tabs">
          <button
            type="button"
            aria-pressed={settingsTab === 'timer'}
            onClick={() => setSettingsTab('timer')}
          >
            {t('widgetMore.minutes')}
          </button>
          <button
            type="button"
            aria-pressed={settingsTab === 'sound'}
            onClick={() => setSettingsTab('sound')}
          >
            {t('focusPlus.alarm')}
          </button>
        </div>
        <div className={'focus-options focus-options-' + settingsTab}>
          {[
            ['breakDuration', 'break', 60, 5],
            ['cycles', 'cycles', 12, 4],
          ].map(([key, label, max, fallback]) => (
            <label className="focus-timer-option" key={key}>
              {t('focusPlus.' + label)}
              <input
                type="number"
                min="1"
                max={max}
                disabled={busy || value.endsAt !== null}
                value={value[key] ?? fallback}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= max)
                    save({
                      ...value,
                      [key]: n,
                      phase: 'work',
                      completed: 0,
                      remaining: value.duration * 60,
                      endsAt: null,
                    });
                }}
              />
            </label>
          ))}
          <label className="focus-timer-option">
            {t('focusPlus.color')}
            <select
              aria-label={t('focusPlus.color')}
              value={value.color || 'violet'}
              disabled={busy}
              onChange={(e) => save({ color: e.target.value })}
            >
              {['violet', 'mint', 'blue', 'amber', 'rose'].map((color) => (
                <option key={color} value={color}>
                  {t('focusPlus.color.' + color)}
                </option>
              ))}
            </select>
          </label>
          <label className="focus-sound-option">
            <input
              type="checkbox"
              checked={value.alarm ?? true}
              disabled={busy}
              onChange={(e) => save({ alarm: e.target.checked })}
            />
            {t('focusPlus.alarm')}
          </label>
          <FocusVolume value={value.volume ?? 65} busy={busy} save={save} />
          <button
            type="button"
            className="btn secondary focus-sound-option"
            onClick={() =>
              playFocusBell(value.volume)
                .then(() => setError(''))
                .catch(() => setError(t('focusPlus.soundError')))
            }
          >
            {t('focusPlus.test')}
          </button>
        </div>
      </details>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function FocusVolume({ value, busy, save }) {
  const { t } = usePreferences();
  const [draft, setDraft] = useState(value);
  const pending = useRef(null);
  useEffect(() => setDraft(value), [value]);
  const commit = (e) => {
    const volume = Number(e.currentTarget.value);
    if (volume === value || pending.current === volume) return;
    pending.current = volume;
    save({ volume }).finally(() => {
      pending.current = null;
    });
  };
  return (
    <label className="focus-sound-option">
      {t('focusPlus.volume')} <output>{draft}%</output>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        aria-label={t('focusPlus.volume')}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </label>
  );
}
