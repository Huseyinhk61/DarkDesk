import { version as appVersion } from '../../package.json';
import {
  Layers3,
  LayoutGrid,
  ScanLine,
  Settings2,
  ArrowUpRight,
  HardDrive,
  MemoryStick,
  Sparkles,
  FolderTree,
  Focus,
  Workflow,
  Search,
  CircleHelp,
  PanelsTopLeft,
  Cpu,
  ChartNoAxesCombined,
  Download,
  Coins,
} from 'lucide-react';
import { usePreferences } from '../preferences';
import { formatBytes } from '../utils';
export default function Sidebar({ view, setView, stats, native, update }) {
  const { t, locale } = usePreferences();
  const used = stats ? 100 * (1 - stats.free / stats.total) : 0;
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setView('groups');
        }}
      >
        <span className="logo">
          <Layers3 size={23} />
        </span>
        <span>
          DarkDesk<small>{t('brand.tagline')}</small>
        </span>
      </a>
      <div className="workspace-label">{t('nav.workspace')}</div>
      <nav>
        {[
          ['groups', LayoutGrid],
          ['profiles', Focus],
          ['launcher', Search],
          ['currency', Coins],
          ['scan', ScanLine],
          ['categories', FolderTree],
          ['automation', Workflow],
          ['widgets', PanelsTopLeft],
          ['systemTools', Cpu],
          ['analytics', ChartNoAxesCombined],
          ['settings', Settings2],
          ['help', CircleHelp],
        ].map(([id, Icon]) => (
          <button
            key={id}
            title={t('nav.' + id)}
            aria-label={t('nav.' + id)}
            aria-current={view === id ? 'page' : undefined}
            className={view === id ? 'active' : ''}
            onClick={() => setView(id)}
          >
            <Icon size={19} />
            {t('nav.' + id)}
            {id === 'settings' &&
            ['available', 'downloading', 'downloaded'].includes(update?.state) ? (
              <span
                className="sidebar-update-badge"
                title={t('update.noticeAvailable', { version: update.version })}
              >
                <Download size={13} aria-hidden="true" />
              </span>
            ) : (
              view === id && <span className="nav-dot" />
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="tip">
          <span className="tip-icon">
            <Sparkles size={18} />
          </span>
          <h4>{t('sidebar.tipTitle')}</h4>
          <p>{t('sidebar.tipBody')}</p>
          <span>
            {t('sidebar.tipFooter')}
            <ArrowUpRight size={14} />
          </span>
        </div>
        <div className="system">
          <div>
            <span className="online" />
            {t('sidebar.status')}
            <small>{t(native ? 'common.live' : 'common.demo')}</small>
          </div>
          <label>
            <MemoryStick size={14} />
            {t('sidebar.memory')}
            <span>{formatBytes(stats ? stats.total - stats.free : 0, locale)}</span>
          </label>
          <div className="meter">
            <i style={{ width: `${used}%` }} />
          </div>
          <label>
            <HardDrive size={14} />
            {t('sidebar.storage')}
            <span>
              {stats?.storage
                ? t('sidebar.free', { size: formatBytes(stats.storage.free, locale) })
                : '—'}
            </span>
          </label>
        </div>
        <footer>
          <span className="avatar">DD</span>
          <div>
            {t('sidebar.local')}
            <small>
              v{appVersion} · {t(native ? 'sidebar.desktop' : 'sidebar.web')}
            </small>
          </div>
          <span className="online" />
        </footer>
      </div>
    </aside>
  );
}
