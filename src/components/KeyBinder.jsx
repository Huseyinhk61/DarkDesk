import { useEffect, useRef, useState } from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';
import { acceleratorFromEvent, displayAccelerator, shortcutConflict } from '../../shared/hotkeys';
import './KeyBinder.css';

export default function KeyBinder({
  id,
  label,
  value,
  onChange,
  assignments = [],
  currentId,
  disabled,
}) {
  const { t, errorMessage } = usePreferences();
  const [recording, setRecording] = useState(false),
    [error, setError] = useState('');
  const input = useRef(null),
    session = useRef(null),
    timer = useRef(null),
    mounted = useRef(true);
  const mac = /Mac/i.test(navigator.platform);
  const stop = async () => {
    const pending = session.current;
    clearTimeout(timer.current);
    session.current = null;
    if (mounted.current) setRecording(false);
    if (pending) {
      try {
        const token = await pending;
        if (token) await api.endShortcutCapture?.(token);
      } catch {}
    }
  };
  useEffect(() => {
    mounted.current = true;
    const endOnBlur = () => stop();
    window.addEventListener('blur', endOnBlur);
    return () => {
      mounted.current = false;
      window.removeEventListener('blur', endOnBlur);
      stop();
    };
  }, []);
  const start = async () => {
    if (disabled || session.current || recording) return;
    setError('');
    const pending = native ? api.beginShortcutCapture() : Promise.resolve('web');
    session.current = pending;
    try {
      await pending;
      if (mounted.current && session.current === pending) {
        setRecording(true);
        input.current?.focus();
        timer.current = setTimeout(stop, 25000);
      }
    } catch (e) {
      session.current = null;
      if (mounted.current) setError(errorMessage(e));
    }
  };
  const capture = async (event) => {
    if (!recording) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        start();
      }
      return;
    }
    if (event.key === 'Tab') {
      stop();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      await stop();
      return;
    }
    const candidate = acceleratorFromEvent(event, mac);
    if (!candidate) return;
    if (shortcutConflict(candidate, assignments, currentId)) {
      setError(t('shortcuts.duplicate'));
    } else {
      onChange(candidate);
      setError('');
    }
    await stop();
  };
  return (
    <div className={`key-binder ${recording ? 'recording' : ''}`} data-keybinder>
      <div className="key-binder-control">
        <input
          id={id}
          ref={input}
          aria-label={label}
          aria-describedby={`${id}-help`}
          readOnly
          value={recording ? t('shortcuts.press') : displayAccelerator(value, mac)}
          onKeyDown={capture}
          onBlur={() => stop()}
          onClick={start}
          disabled={disabled}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={recording ? stop : start}
          aria-label={`${t(recording ? 'shortcuts.cancel' : 'shortcuts.record')} ${label}`}
        >
          {recording ? <RotateCcw size={16} /> : <Keyboard size={16} />}
          {t(recording ? 'shortcuts.cancel' : 'shortcuts.record')}
        </button>
      </div>
      <small id={`${id}-help`} aria-live="polite" className={error ? 'warning-text' : 'muted'}>
        {error || t(recording ? 'shortcuts.recordingHelp' : 'shortcuts.help')}
      </small>
    </div>
  );
}
