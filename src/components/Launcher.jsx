import { useEffect, useRef, useState, useMemo } from 'react';
import { Search, Command, CornerDownLeft, LoaderCircle, ArrowUpRight } from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';
import { searchEntries } from '../../shared/launcher';
import AppIcon from './AppIcon';
import NativeItemIcon from './NativeItemIcon';
export default function Launcher({ onClose, onCommand }) {
  const { settings, setSettings, t, label, errorMessage } = usePreferences();
  const [items, setItems] = useState([]),
    [query, setQuery] = useState(''),
    [active, setActive] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const input = useRef(null),
    panel = useRef(null);
  const refresh = async () => {
    try {
      const value = await api.launcherEntries();
      setSettings(value.settings);
      setItems(value.items);
      input.current?.focus();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    refresh();
    const off = api.onLauncherShown(() => {
      setQuery('');
      setActive(0);
      refresh();
      input.current?.focus();
    });
    return () => off();
  }, []);
  const commands = [
    { id: 'command:show', name: t('launcher.show'), command: { type: 'show' }, icon: 'folder' },
    {
      id: 'command:organize',
      name: t('launcher.organize'),
      command: { type: 'organize' },
      icon: 'archive',
    },
    {
      id: 'command:restore',
      name: t('launcher.restore'),
      command: { type: 'restore' },
      icon: 'star',
    },
    ...settings.profiles.map((p) => ({
      id: 'command:' + p.id,
      name: t('launcher.profile', { name: p.labelKey ? t(p.labelKey) : p.name }),
      command: { type: 'profile', id: p.id },
      icon: p.icon,
    })),
  ];
  const entries = useMemo(
    () =>
      searchEntries(query, [
        ...commands,
        ...items.map((item) => ({
          ...item,
          icon:
            settings.itemIcons[item.id] ||
            settings.categories.find((c) => c.id === item.category)?.icon ||
            'file',
          name: item.name.replace(/\.(lnk|exe|desktop)$/i, ''),
          searchText: item.name + ' ' + (item.target || ''),
        })),
      ]),
    [query, items, settings, t],
  );
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (entries[active])
      document.getElementById('result-' + entries[active].id)?.scrollIntoView({ block: 'nearest' });
  }, [active, query]);
  const close = () => (onClose ? onClose() : api.hideLauncher());
  const execute = async (entry) => {
    if (!entry || busy) return;
    setBusy(true);
    setError('');
    try {
      if (entry.command) {
        if (onCommand) await onCommand(entry.command);
        else await api.runCommand(entry.command);
      } else await api.launch(entry.id);
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      ref={panel}
      className="launcher-panel"
      role="dialog"
      aria-modal="true"
      aria-label={t('launcher.title')}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          const list = [...panel.current.querySelectorAll('input,button:not(:disabled)')],
            first = list[0],
            last = list.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActive((n) => (n + 1) % Math.max(1, entries.length));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActive((n) => (n - 1 + entries.length) % Math.max(1, entries.length));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          execute(entries[active]);
        }
      }}
    >
      <div className="launcher-search">
        <Search size={23} />
        <input
          ref={input}
          autoFocus
          aria-label={t('launcher.search')}
          placeholder={t('launcher.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-controls="launcher-results"
          aria-activedescendant={entries[active] ? 'result-' + entries[active].id : undefined}
        />
        {busy ? <LoaderCircle className="spin" size={18} /> : <kbd>esc</kbd>}
      </div>
      <div className="launcher-results" id="launcher-results" role="listbox">
        {entries.map((entry, index) => (
          <button
            role="option"
            aria-selected={active === index}
            id={'result-' + entry.id}
            className={`launcher-result ${active === index ? 'selected' : ''}`}
            key={entry.id}
            onMouseEnter={() => setActive(index)}
            onClick={() => execute(entry)}
            disabled={busy}
          >
            <span className="launcher-result-icon">
              {entry.command ? (
                <AppIcon name={entry.icon} />
              ) : (
                <NativeItemIcon item={entry} fallback={entry.icon} size={28} eager />
              )}
            </span>
            <span>
              <b>{entry.name}</b>
              <small>{entry.command ? t('launcher.command') : entry.source}</small>
            </span>
            {active === index ? <CornerDownLeft size={16} /> : <ArrowUpRight size={14} />}
          </button>
        ))}
        {!entries.length && (
          <div className="launcher-empty">
            <Search size={28} />
            <p>{t('launcher.empty')}</p>
          </div>
        )}
      </div>
      {error && (
        <div className="launcher-error" role="alert">
          {error}
        </div>
      )}
      <footer>
        <span className="launcher-brand">
          <Command size={13} />
          DarkDesk
        </span>
        <span>{t('launcher.hint')}</span>
        {!native && <small>{t('common.demo')}</small>}
      </footer>
    </div>
  );
}
