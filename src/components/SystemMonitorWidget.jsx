import { useState } from 'react';
import { Cpu, MemoryStick, HardDrive, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePreferences } from '../preferences';
import { formatBytes } from '../utils';
import { native } from '../service';
export default function SystemMonitorWidget({ metrics, points, options = {} }) {
  const { t, locale } = usePreferences();
  const [tab, setTab] = useState('overview');
  const [corePage, setCorePage] = useState(0);
  const percent = (value) => (Number.isFinite(value) ? Math.round(value) + '%' : '—');
  const meter = (name, value) => (
    <progress
      aria-label={name}
      max="100"
      value={Number.isFinite(value) ? value : 0}
      aria-valuetext={percent(value)}
    />
  );
  const tabs = [
    ['overview', Cpu],
    ['cpu', Cpu],
    ['memory', MemoryStick],
    ...(options.disk ? [['disk', HardDrive]] : []),
  ];
  const activeTab = tabs.some(([key]) => key === tab) ? tab : 'overview';
  const cores = metrics?.cores || [];
  const totalPages = Math.max(1, Math.ceil(cores.length / 16));
  const page = Math.min(corePage, totalPages - 1);
  return (
    <div className="system-monitor-widget">
      <div className="system-monitor-tabs" role="group" aria-label={t('ux311.monitorViews')}>
        {tabs.map(([id, Icon]) => (
          <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => setTab(id)}>
            <Icon size={13} />
            {t('ux311.monitor.' + id)}
          </button>
        ))}
      </div>
      {metrics?.unsupported && (
        <small className="monitor-unavailable">
          {t(native ? 'widgetPlus.warming' : 'widgetPlus.metricsDesktop')}
        </small>
      )}
      {activeTab === 'overview' && (
        <div className="monitor-overview">
          <div className="monitor-stat">
            <span>
              <Cpu size={15} />
              CPU
            </span>
            <strong>{percent(metrics?.cpuPercent)}</strong>
            {meter('CPU', metrics?.cpuPercent)}
          </div>
          <div className="monitor-stat">
            <span>
              <MemoryStick size={15} />
              {t('widgetPlus.memory')}
            </span>
            <strong>{percent(metrics?.memory?.percent)}</strong>
            {meter(t('widgetPlus.memory'), metrics?.memory?.percent)}
          </div>
          <small className="monitor-capacity" hidden={!metrics?.memory}>
            {metrics?.memory
              ? `${formatBytes(metrics.memory.used, locale)} / ${formatBytes(metrics.memory.total, locale)}`
              : '—'}
          </small>
        </div>
      )}
      {activeTab === 'cpu' && (
        <div className="monitor-cpu">
          <div className="monitor-heading">
            <b>CPU</b>
            <strong>{percent(metrics?.cpuPercent)}</strong>
          </div>
          {options.details && (
            <small className="monitor-model" title={metrics?.cpuModel}>
              {metrics?.cpuModel || '—'} · {metrics?.coreCount || '—'} {t('ux311.logicalCores')}
            </small>
          )}
          {options.chart && (
            <svg
              className="widget-chart"
              viewBox="0 0 280 46"
              role="img"
              aria-label={t('widgetPlus.cpuChart')}
            >
              <path d="M0 22H280" className="widget-gridline" />
              {points.length > 1 && (
                <polyline
                  fill="none"
                  points={points
                    .map((value, i) => `${(i * 280) / (points.length - 1)},${44 - value * 0.42}`)
                    .join(' ')}
                />
              )}
            </svg>
          )}
          {options.cores && (
            <div className="monitor-core-section">
              <div className="widget-cores" aria-label={t('ux311.logicalCores')}>
                {cores.slice(page * 16, page * 16 + 16).map((value, i) => (
                  <span
                    key={i}
                    title={t('widgetPlus.core', {
                      index: page * 16 + i + 1,
                      value: percent(value),
                    })}
                  >
                    <i style={{ height: (value || 0) + '%' }} />
                  </span>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="monitor-pagination">
                  <button
                    type="button"
                    disabled={!page}
                    onClick={() => setCorePage(page - 1)}
                    aria-label={t('ux311.previous')}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <small>
                    {page + 1}/{totalPages}
                  </small>
                  <button
                    type="button"
                    disabled={page >= totalPages - 1}
                    onClick={() => setCorePage(page + 1)}
                    aria-label={t('ux311.next')}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {activeTab === 'memory' && (
        <div className="monitor-memory">
          <div className="monitor-heading">
            <b>{t('widgetPlus.memory')}</b>
            <strong>{percent(metrics?.memory?.percent)}</strong>
          </div>
          {meter(t('widgetPlus.memory'), metrics?.memory?.percent)}
          <dl className="monitor-detail-list">
            <div>
              <dt>{t('ux311.used')}</dt>
              <dd>{metrics?.memory ? formatBytes(metrics.memory.used, locale) : '—'}</dd>
            </div>
            <div>
              <dt>{t('widgetMore.freeMemory')}</dt>
              <dd>{metrics?.memory ? formatBytes(metrics.memory.free, locale) : '—'}</dd>
            </div>
            {options.details && (
              <div>
                <dt>{t('widgetMore.appMemory')}</dt>
                <dd>{metrics?.process ? formatBytes(metrics.process.rss, locale) : '—'}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
      {activeTab === 'disk' && (
        <div className="monitor-disk">
          <div className="monitor-heading">
            <b>{t('ux311.monitor.disk')}</b>
            <strong>{percent(metrics?.disk?.percent)}</strong>
          </div>
          {meter(t('widgetMore.diskUsed'), metrics?.disk?.percent)}
          <small>{t('widgetMore.diskFree')}</small>
          <b>
            {metrics?.disk
              ? `${formatBytes(metrics.disk.free, locale)} / ${formatBytes(metrics.disk.total, locale)}`
              : '—'}
          </b>
        </div>
      )}
    </div>
  );
}
