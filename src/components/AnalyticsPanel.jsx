import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock3,
  Focus,
  ShieldCheck,
  Trash2,
  RefreshCw,
  CirclePause,
} from 'lucide-react';
import { api } from '../service';
import { usePreferences } from '../preferences';
import Modal from './Modal';
import '../analytics.css';
const localKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export default function AnalyticsPanel() {
  const { t, settings, locale, label, errorMessage } = usePreferences();
  const [state, setState] = useState(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false),
    [range, setRange] = useState(7),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let alive = true;
    const receive = (value) => {
      if (alive) setState(value);
    };
    const off = api.onAnalyticsChanged?.(receive);
    api
      .analyticsStatus()
      .then(receive)
      .catch((reason) => {
        if (alive) setError(errorMessage(reason));
      });
    return () => {
      alive = false;
      off?.();
    };
  }, []);
  const run = async (action) => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      setState(await action());
      setConfirm(false);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  };
  const days = useMemo(() => {
    const indexed = new Map((state?.days || []).map((day) => [day.date, day]));
    return Array.from({ length: range }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (range - 1 - index));
      return {
        date: localKey(date),
        activeSeconds: 0,
        apps: [],
        profiles: [],
        ...indexed.get(localKey(date)),
      };
    });
  }, [state, range]);
  const { apps, profiles, total, activeDays } = useMemo(() => {
    const apps = new Map(),
      profiles = new Map();
    let total = 0,
      activeDays = 0;
    for (const day of days) {
      total += day.activeSeconds;
      if (day.activeSeconds > 0) activeDays++;
      for (const item of day.apps) {
        const value = apps.get(item.id) || {
          id: item.id,
          name: item.name,
          seconds: 0,
          runningSeconds: 0,
        };
        value.seconds += item.seconds;
        value.runningSeconds += item.runningSeconds || 0;
        apps.set(item.id, value);
      }
      for (const item of day.profiles)
        profiles.set(item.id, (profiles.get(item.id) || 0) + item.seconds);
    }
    return {
      apps: [...apps.values()].sort(
        (a, b) => b.seconds - a.seconds || b.runningSeconds - a.runningSeconds,
      ),
      profiles: [...profiles.entries()].sort((a, b) => b[1] - a[1]),
      total,
      activeDays,
    };
  }, [days]);
  const duration = (seconds) => {
    if (seconds < 60) return t('analyticsPlus.seconds', { count: Math.round(seconds) });
    if (seconds < 3600) return t('analyticsPlus.minutes', { count: Math.floor(seconds / 60) });
    return t('analyticsPlus.hoursMinutes', {
      hours: Math.floor(seconds / 3600),
      minutes: Math.floor((seconds % 3600) / 60),
    });
  };
  const dayLabel = (key) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
      new Date(key + 'T12:00:00'),
    );
  const max = Math.max(1, ...days.map((day) => day.activeSeconds));
  const profileName = (id) =>
    id === 'normal'
      ? t('profiles.normal')
      : label(settings.profiles.find((profile) => profile.id === id)) ||
        t('analyticsPlus.previousProfile');
  return (
    <>
      <div className="eyebrow">{t('nav.analytics')}</div>
      <h1 className="settings-title">{t('analyticsPlus.title')}</h1>
      <p className="muted">{t('analyticsPlus.body')}</p>
      {error && (
        <p className="notice warning" role="alert">
          {error}
        </p>
      )}
      <section className="settings-panel analytics-consent">
        <div className="analytics-consent-heading">
          <span className="analytics-emblem">
            <ShieldCheck size={23} />
          </span>
          <div>
            <h2>{t('analyticsPlus.private')}</h2>
            <p className="muted">{t('analyticsPlus.privacy')}</p>
          </div>
        </div>
        <label className="toggle-setting">
          <span>
            <b>{t('analyticsPlus.enable')}</b>
            <small>{t('analyticsPlus.enableBody')}</small>
          </span>
          <input
            type="checkbox"
            aria-label={t('analyticsPlus.enable')}
            checked={!!state?.enabled}
            disabled={!state || (!state.supported && !state.enabled) || pending}
            onChange={(event) => run(() => api.setAnalyticsEnabled(event.target.checked))}
          />
          <span className="switch" />
        </label>
        {state && !state.supported && <p className="notice">{t('analyticsPlus.unsupported')}</p>}
        {state?.enabled && (
          <p className="analytics-live-status">
            <span className={state.paused || !state.samplingAvailable ? 'paused' : 'live'} />
            {t(
              !state.samplingAvailable
                ? 'analyticsPlus.sampleFailed'
                : state.paused
                  ? 'analyticsPlus.paused'
                  : 'analyticsPlus.recording',
            )}
            {state.lastError && <span className="muted"> · {errorMessage(state.lastError)}</span>}
          </p>
        )}
        {state?.enabled && !state.samplingAvailable && (
          <button
            className="btn secondary"
            disabled={pending}
            onClick={() => run(() => api.setAnalyticsEnabled(true))}
          >
            <RefreshCw size={15} />
            {t('analyticsPlus.retry')}
          </button>
        )}
        <p className="analytics-scope">
          <Clock3 size={15} />
          {t('analyticsPlus.scope', {
            seconds: state?.sampleIntervalSeconds || 15,
            days: state?.retentionDays || 90,
          })}
        </p>
      </section>
      <div className="analytics-toolbar">
        <div className="analytics-period" role="group" aria-label={t('analyticsPlus.period')}>
          {[7, 30].map((count) => (
            <button
              key={count}
              className={range === count ? 'active' : ''}
              aria-pressed={range === count}
              onClick={() => setRange(count)}
            >
              {t('analyticsPlus.days', { count })}
            </button>
          ))}
        </div>
        <button className="btn secondary" disabled={pending} onClick={() => setConfirm(true)}>
          <Trash2 size={15} />
          {t('analyticsPlus.clear')}
        </button>
      </div>
      <div className="analytics-summary">
        <section className="settings-panel">
          <Focus size={21} />
          <small>{t('analyticsPlus.activeTime')}</small>
          <strong>{duration(total)}</strong>
          <span>{t('analyticsPlus.activeTimeHint')}</span>
        </section>
        <section className="settings-panel">
          <Activity size={21} />
          <small>{t('analyticsPlus.activeDays')}</small>
          <strong>
            {activeDays}
            <em> / {range}</em>
          </strong>
          <span>{t('analyticsPlus.activeDaysHint')}</span>
        </section>
        <section className="settings-panel">
          <BarChart3 size={21} />
          <small>{t('analyticsPlus.measuredApps')}</small>
          <strong>{apps.length}</strong>
          <span>{t('analyticsPlus.measuredAppsHint')}</span>
        </section>
      </div>
      <section className="settings-panel analytics-chart-panel">
        <h2>
          <BarChart3 size={20} />
          {t('analyticsPlus.daily')}
        </h2>
        <p className="muted">{t('analyticsPlus.dailyHint')}</p>
        <div
          className="analytics-chart"
          role="img"
          aria-label={t('analyticsPlus.chartLabel', { days: range, time: duration(total) })}
        >
          {days.map((day, index) => (
            <div
              className="analytics-chart-column"
              key={day.date}
              title={`${dayLabel(day.date)} · ${duration(day.activeSeconds)}`}
            >
              <div className="analytics-chart-track">
                <span
                  style={{
                    height: day.activeSeconds
                      ? `${Math.max(2, (day.activeSeconds / max) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
              <small>
                {range === 7 || index % 5 === 0 || index === range - 1 ? dayLabel(day.date) : ''}
              </small>
            </div>
          ))}
        </div>
        <details className="analytics-data-details">
          <summary>{t('analyticsPlus.showData')}</summary>
          <div className="analytics-data-table">
            <table>
              <thead>
                <tr>
                  <th>{t('analyticsPlus.date')}</th>
                  <th>{t('analyticsPlus.activeTime')}</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.date}>
                    <td>{dayLabel(day.date)}</td>
                    <td>{duration(day.activeSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <div className="analytics-detail-grid">
        <section className="settings-panel analytics-apps">
          <h2>
            <Activity size={20} />
            {t('analyticsPlus.appTimes')}
          </h2>
          <p className="muted">{t('analyticsPlus.appTimesHint')}</p>
          {apps.length ? (
            <div className="analytics-data-table">
              <table>
                <thead>
                  <tr>
                    <th>{t('analyticsPlus.application')}</th>
                    <th>{t('analyticsPlus.focused')}</th>
                    <th>{t('analyticsPlus.open')}</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.slice(0, 30).map((app) => (
                    <tr key={app.id}>
                      <th scope="row">{app.name || t('analyticsPlus.other')}</th>
                      <td>{duration(app.seconds)}</td>
                      <td>{state?.runningAvailable ? duration(app.runningSeconds) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="analytics-empty">
              <CirclePause size={27} />
              <b>{t('analyticsPlus.noApps')}</b>
              <p>{t(state?.enabled ? 'analyticsPlus.waiting' : 'analyticsPlus.emptyBody')}</p>
            </div>
          )}
          <p className="analytics-footnote">{t('analyticsPlus.openHint')}</p>
        </section>
        <section className="settings-panel analytics-profiles">
          <h2>
            <Focus size={20} />
            {t('analyticsPlus.profileTimes')}
          </h2>
          <p className="muted">{t('analyticsPlus.profileHint')}</p>
          {profiles.length ? (
            <div className="analytics-profile-list">
              {profiles.map(([id, seconds]) => (
                <div key={id}>
                  <div>
                    <b>{profileName(id)}</b>
                    <span>{duration(seconds)}</span>
                  </div>
                  <div className="analytics-profile-track">
                    <span
                      style={{ width: `${Math.min(100, (seconds / Math.max(total, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="analytics-empty">
              <Focus size={27} />
              <b>{t('analyticsPlus.noProfiles')}</b>
              <p>{t('analyticsPlus.profileEmpty')}</p>
            </div>
          )}
        </section>
      </div>
      {confirm && (
        <Modal
          title={t('analyticsPlus.clearTitle')}
          onClose={() => {
            if (!pending) setConfirm(false);
          }}
          labelledBy="analytics-clear-title"
        >
          <p className="muted">{t('analyticsPlus.clearBody')}</p>
          <div className="modal-actions">
            <button className="btn secondary" disabled={pending} onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn primary"
              disabled={pending}
              onClick={() => run(() => api.clearAnalytics())}
            >
              <Trash2 size={15} />
              {t('analyticsPlus.clearConfirm')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
