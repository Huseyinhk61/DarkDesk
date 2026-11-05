import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '../useDialog';
import {
  Search,
  Command,
  CornerDownLeft,
  LoaderCircle,
  ArrowUpRight,
  X,
  Calculator,
  Globe,
  Star,
  MoreHorizontal,
  FolderOpen,
  Shield,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { api, native } from '../service';
import { usePreferences } from '../preferences';
import { searchEntries } from '../../shared/launcher';
import { launcherTool } from '../../shared/launcher-tools';
import AppIcon from './AppIcon';
import NativeItemIcon from './NativeItemIcon';
import '../launcher-plus.css';

export default function Launcher({ onClose, onCommand }) {
  const { settings, setSettings, t, label, errorMessage, locale } = usePreferences();
  const [items, setItems] = useState([]),
    [query, setQuery] = useState(''),
    [active, setActive] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [actions, setActions] = useState(null),
    [confirmation, setConfirmation] = useState(null),
    [now, setNow] = useState(Date.now()),
    [capabilities, setCapabilities] = useState({
      system: [],
      admin: false,
      reveal: false,
      copy: false,
      web: false,
    });
  const input = useRef(null),
    panel = useRef(null),
    layer = useRef(null),
    menu = useRef(null),
    cancel = useRef(null),
    mounted = useRef(true),
    loadVersion = useRef(0);
  const standalone = window.location.hash === '#launcher';
  const close = () => (onClose ? onClose() : api.hideLauncher());
  useDialog({
    layer,
    panel,
    initialFocus: input,
    onClose: () => {
      if (confirmation) {
        setConfirmation(null);
        input.current?.focus();
      } else if (actions) {
        setActions(null);
        input.current?.focus();
      } else close();
    },
  });
  const refresh = async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const value = await api.launcherEntries();
      if (!mounted.current || version !== loadVersion.current) return;
      setSettings(value.settings);
      setItems(value.items);
      setCapabilities(
        value.capabilities || { system: [], admin: false, reveal: true, copy: false, web: false },
      );
      input.current?.focus();
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    refresh();
    const off = api.onLauncherShown(() => {
      setQuery('');
      setActive(0);
      setError('');
      setNotice('');
      setActions(null);
      setConfirmation(null);
      refresh();
    });
    return () => {
      mounted.current = false;
      ++loadVersion.current;
      off();
    };
  }, []);
  useEffect(() => {
    if (actions) menu.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
  }, [actions]);
  useEffect(() => {
    if (!confirmation) return;
    setNow(Date.now());
    cancel.current?.focus();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [confirmation]);
  useEffect(() => {
    if (!confirmation) input.current?.focus();
  }, [confirmation]);
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
    ...['empty-trash', 'lock', 'shutdown', 'mute'].map((id) => ({
      id: 'system:' + id,
      name: t('launcherPlus.system.' + id),
      system: id,
      command: { type: 'system', id },
      icon:
        id === 'empty-trash'
          ? 'archive'
          : id === 'lock'
            ? 'star'
            : id === 'mute'
              ? 'music'
              : 'tools',
      unsupported: !capabilities.system?.includes(id),
      searchText: t('launcherPlus.system.' + id) + ' ' + id,
    })),
  ];
  const tool = useMemo(() => launcherTool(query, locale), [query, locale]);
  const entries = useMemo(() => {
    if (tool)
      return [
        {
          ...tool,
          tool: true,
          name:
            tool.status !== 'success'
              ? t('launcherTools.error.' + tool.error)
              : tool.type === 'web'
                ? t('launcherPlus.webSearch', {
                    provider: { google: 'Google', youtube: 'YouTube', github: 'GitHub' }[
                      tool.provider
                    ],
                    query: tool.query,
                  })
                : tool.displayValue + (tool.toUnit ? ' ' + tool.toUnit : ''),
        },
      ];
    return searchEntries(query, [
      ...commands,
      ...items.map((item) => ({
        ...item,
        icon:
          settings.itemIcons[item.id] ||
          settings.categories.find((c) => c.id === item.category)?.icon ||
          'file',
        name: item.name.replace(/\.(lnk|exe|desktop)$/i, ''),
        searchText:
          item.name +
          ' ' +
          (item.target || '') +
          ' ' +
          (item.insight?.description?.[settings.language] || ''),
      })),
    ]);
  }, [query, items, settings, t, tool, capabilities]);
  useEffect(() => {
    setActive(0);
    setActions(null);
    setNotice('');
    setError('');
  }, [query]);
  useEffect(() => {
    document.getElementById('result-' + entries[active]?.id)?.scrollIntoView({ block: 'nearest' });
  }, [active, query]);
  const selected = entries[Math.min(active, Math.max(0, entries.length - 1))];
  const isItem = (entry) => !!entry && !entry.command && !entry.tool;
  const copyResult = async (entry) => {
    await api.launcherAction({ type: 'copy', text: entry.copyText });
    setNotice(t('launcherPlus.copied', { value: entry.copyText }));
    input.current?.focus();
    input.current?.select();
  };
  const execute = async (entry) => {
    if (!entry || busy) return;
    if (loading && !entry.tool && (!entry.command || entry.system)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (entry.unsupported) throw Error('LAUNCHER_UNSUPPORTED');
      if (entry.tool) {
        if (entry.status !== 'success') return;
        if (entry.type === 'web') {
          await api.launcherAction({ type: 'web', provider: entry.provider, query: entry.query });
          close();
        } else await copyResult(entry);
      } else if (entry.system) {
        if (['empty-trash', 'shutdown'].includes(entry.system)) {
          const prepared = await api.launcherAction({ type: 'prepare-system', id: entry.system });
          setConfirmation(prepared);
          setActions(null);
        } else {
          await api.launcherAction({ type: 'system', id: entry.system });
          close();
        }
      } else {
        if (entry.command) {
          if (onCommand) await onCommand(entry.command);
          else await api.runCommand(entry.command);
        } else await api.launch(entry.id);
        close();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const runAction = async (type) => {
    if (!actions || busy) return;
    setBusy(true);
    setError('');
    try {
      if (type === 'favorite') {
        const favorite = !actions.usage?.favorite;
        await api.setLauncherFavorite(actions.id, favorite);
        setItems((previous) =>
          previous.map((item) =>
            item.id === actions.id ? { ...item, usage: { ...item.usage, favorite } } : item,
          ),
        );
        setNotice(t(favorite ? 'launcherPlus.favoriteAdded' : 'launcherPlus.favoriteRemoved'));
        setActions(null);
        input.current?.focus();
      } else {
        await api.launcherAction({ type, id: actions.id });
        close();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const confirmSystem = async () => {
    if (!confirmation || busy || now >= confirmation.expiresAt) return;
    setBusy(true);
    setError('');
    try {
      await api.launcherAction({ type: 'confirm-system', token: confirmation.token });
      setConfirmation(null);
      close();
    } catch (e) {
      setError(errorMessage(e));
      setConfirmation(null);
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };
  const keyDown = (e) => {
    if (confirmation) return;
    if (actions) {
      if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        setActions(null);
        input.current?.focus();
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const buttons = [...menu.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement),
          step = e.key === 'ArrowUp' ? -1 : 1;
        buttons[
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? buttons.length - 1
              : (index + step + buttons.length) % buttons.length
        ]?.focus();
      }
      return;
    }
    if (e.target !== input.current || busy) return;
    if (
      ((e.key === 'Tab' && !e.shiftKey) ||
        (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) &&
      isItem(selected)
    ) {
      e.preventDefault();
      e.stopPropagation();
      setActions(selected);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(
        (n) =>
          (n + (e.key === 'ArrowDown' ? 1 : -1) + Math.max(1, entries.length)) %
          Math.max(1, entries.length),
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(selected);
    }
  };
  const badge = (entry) =>
    entry.tool
      ? entry.type === 'web'
        ? 'web'
        : entry.type === 'conversion'
          ? 'conversion'
          : 'calculation'
      : entry.command
        ? 'command'
        : /\.(lnk|exe|appimage|app|desktop|url)$/i.test(entry.source || entry.name) ||
            entry.kind === 'installed'
          ? 'app'
          : 'file';
  return createPortal(
    <div
      ref={layer}
      className={standalone ? 'native-launcher-dialog' : 'launcher-backdrop'}
      style={standalone ? { position: 'fixed', inset: 10 } : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          if (!confirmation) close();
        }
      }}
    >
      <div
        ref={panel}
        className="launcher-panel launcher-enhanced"
        role="dialog"
        aria-modal="true"
        aria-label={t('launcher.title')}
        tabIndex={-1}
        onKeyDown={keyDown}
      >
        <div className="launcher-search">
          <Search size={23} />
          <input
            ref={input}
            autoFocus
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={!confirmation}
            aria-label={t('launcher.search')}
            placeholder={t('launcherPlus.placeholder')}
            value={query}
            disabled={!!confirmation}
            onChange={(e) => setQuery(e.target.value)}
            aria-controls="launcher-results"
            aria-activedescendant={selected ? 'result-' + selected.id : undefined}
          />
          {(busy || loading) && <LoaderCircle className="spin" size={18} />}
          <button
            type="button"
            className="launcher-close"
            onClick={close}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>
        {confirmation ? (
          <div
            className="launcher-confirmation"
            role="alertdialog"
            aria-labelledby="launcher-confirm-title"
            aria-describedby="launcher-confirm-body"
          >
            <AlertTriangle size={28} />
            <h2 id="launcher-confirm-title">{t('launcherPlus.system.' + confirmation.id)}</h2>
            <p id="launcher-confirm-body">{t('launcherPlus.confirm.' + confirmation.id)}</p>
            {now >= confirmation.expiresAt && (
              <p role="status">{t('launcherPlus.confirmExpired')}</p>
            )}
            <div>
              <button
                ref={cancel}
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => {
                  setConfirmation(null);
                  input.current?.focus();
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn primary destructive-confirm"
                disabled={busy || now >= confirmation.expiresAt}
                onClick={confirmSystem}
              >
                {t('launcherPlus.confirmAction')}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="launcher-results"
            id="launcher-results"
            role="listbox"
            tabIndex={-1}
            aria-label={t('launcherPlus.results')}
          >
            {entries.map((entry, index) => (
              <div key={entry.id} role="presentation">
                {entry.section && entries[index - 1]?.section !== entry.section && (
                  <div className="launcher-section-label" role="presentation">
                    {t('launcherPlus.section.' + entry.section)}
                  </div>
                )}
                <button
                  role="option"
                  tabIndex={-1}
                  aria-selected={active === index}
                  id={'result-' + entry.id}
                  className={`launcher-result ${active === index ? 'selected' : ''} ${entry.tool ? 'launcher-tool-result' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => execute(entry)}
                  disabled={
                    busy ||
                    (loading && !entry.tool && (!entry.command || entry.system)) ||
                    entry.unsupported ||
                    (entry.tool && entry.status !== 'success')
                  }
                >
                  <span className="launcher-result-icon">
                    {entry.tool ? (
                      entry.type === 'web' ? (
                        <Globe />
                      ) : (
                        <Calculator />
                      )
                    ) : entry.command ? (
                      <AppIcon name={entry.icon} />
                    ) : (
                      <NativeItemIcon item={entry} fallback={entry.icon} size={28} eager />
                    )}
                  </span>
                  <span className="launcher-result-copy">
                    <b>
                      {entry.usage?.favorite && <Star className="launcher-pinned" size={12} />}{' '}
                      {entry.name}
                    </b>
                    <small>
                      {entry.tool
                        ? entry.type === 'web'
                          ? entry.url || t('launcherPlus.webHint')
                          : entry.input
                        : entry.unsupported
                          ? t('launcherPlus.windowsOnly')
                          : entry.command
                            ? t('launcher.command')
                            : entry.source}
                    </small>
                  </span>
                  <span className="launcher-result-badges">
                    <span className={'launcher-type-badge ' + badge(entry)}>
                      {t('launcherPlus.badge.' + badge(entry))}
                    </span>
                    {isItem(entry) && (
                      <small>
                        {label(settings.categories.find((c) => c.id === entry.category))}
                      </small>
                    )}
                  </span>
                  {active === index ? <CornerDownLeft size={16} /> : <ArrowUpRight size={14} />}
                </button>
              </div>
            ))}
            {!entries.length && (
              <div className="launcher-empty">
                <Search size={28} />
                <p>{t('launcher.empty')}</p>
              </div>
            )}
          </div>
        )}
        {actions && (
          <div
            className="launcher-actions"
            ref={menu}
            role="menu"
            aria-label={t('launcherPlus.actionsFor', { name: actions.name })}
          >
            <div className="launcher-actions-title">
              {actions.name}
              <button
                type="button"
                aria-label={t('launcherPlus.closeActions')}
                onClick={() => {
                  setActions(null);
                  input.current?.focus();
                }}
              >
                <X size={15} />
              </button>
            </div>
            <button role="menuitem" disabled={busy} onClick={() => runAction('favorite')}>
              <Star size={16} />
              {t(
                actions.usage?.favorite
                  ? 'launcherPlus.removeFavorite'
                  : 'launcherPlus.addFavorite',
              )}
            </button>
            <button
              role="menuitem"
              disabled={busy || !capabilities.reveal}
              onClick={() => runAction('reveal')}
            >
              <FolderOpen size={16} />
              {t('launcherPlus.reveal')}
            </button>
            <button
              role="menuitem"
              disabled={busy || !capabilities.admin || !/\.(exe|lnk)$/i.test(actions.source || '')}
              onClick={() => runAction('admin')}
            >
              <Shield size={16} />
              {t('launcherPlus.admin')}
            </button>
          </div>
        )}
        {error && (
          <div className="launcher-error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="launcher-notice" role="status">
            <Copy size={14} />
            {notice}
          </div>
        )}
        <footer>
          <span className="launcher-brand">
            <Command size={13} />
            DarkDesk
          </span>
          <span>
            {isItem(selected)
              ? t('launcherPlus.itemHint')
              : selected?.tool && selected.status === 'success' && selected.type !== 'web'
                ? t('launcherPlus.copyHint')
                : t('launcher.hint')}
          </span>
          {isItem(selected) && !confirmation && (
            <button
              type="button"
              className="launcher-actions-trigger"
              disabled={busy}
              onClick={() => setActions(selected)}
              aria-label={t('launcherPlus.openActions')}
            >
              <MoreHorizontal size={15} />
              <span>{t('launcherPlus.actions')}</span>
            </button>
          )}
          {!native && <small>{t('common.demo')}</small>}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
