import { parseCurrencyInput } from '../../shared/currency';
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
  RefreshCw,
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
    [favoritesOnly, setFavoritesOnly] = useState(false),
    [currencyResult, setCurrencyResult] = useState(null),
    [currencyRefresh, setCurrencyRefresh] = useState(0),
    [active, setActive] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [actions, setActions] = useState(null),
    [confirmation, setConfirmation] = useState(null),
    [commandUsage, setCommandUsage] = useState({}),
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
    loadVersion = useRef(0),
    sessionVersion = useRef(0);
  const standalone = window.location.hash === '#launcher';
  const currentSession = (version) => mounted.current && version === sessionVersion.current;
  const close = (outcome) => {
    ++sessionVersion.current;
    ++loadVersion.current;
    setBusy(false);
    return onClose
      ? onClose()
      : api.hideLauncher(
          Number.isSafeInteger(outcome?.launcherEpoch) ? outcome.launcherEpoch : undefined,
        );
  };
  useDialog({
    layer,
    panel,
    initialFocus: input,
    onClose: () => {
      if (confirmation) {
        if (busy) return;
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
      setCommandUsage(
        value.commandUsage &&
          typeof value.commandUsage === 'object' &&
          !Array.isArray(value.commandUsage)
          ? value.commandUsage
          : {},
      );
      setCapabilities(
        value.capabilities || { system: [], admin: false, reveal: true, copy: false, web: false },
      );
    } catch (e) {
      if (mounted.current && version === loadVersion.current) setError(errorMessage(e));
    } finally {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    ++sessionVersion.current;
    refresh();
    const off = api.onLauncherShown(() => {
      ++sessionVersion.current;
      setQuery('');
      setActive(0);
      setBusy(false);
      setError('');
      setNotice('');
      setActions(null);
      setConfirmation(null);
      input.current?.focus();
      refresh();
    });
    return () => {
      mounted.current = false;
      ++sessionVersion.current;
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
    ...[
      'empty-trash',
      'lock',
      'shutdown',
      'mute',
      'unmute',
      'volume-up',
      'volume-down',
      'screenshot',
      'wifi-on',
      'wifi-off',
      'night-light',
      'clean-space',
    ].map((id) => ({
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
  useEffect(() => setCurrencyRefresh(0), [query]);
  const currencyQuery = useMemo(
    () =>
      parseCurrencyInput(
        query,
        settings.currency?.target || (settings.language === 'tr' ? 'TRY' : 'USD'),
      ),
    [query, settings.language, settings.currency?.target],
  );
  useEffect(() => {
    let active = true;
    setCurrencyResult(null);
    if (!currencyQuery) return;
    const timer = setTimeout(
      () =>
        api
          .currencyQuote({ ...currencyQuery, refresh: currencyRefresh > 0 })
          .then((value) => {
            if (active)
              setCurrencyResult({
                ...value,
                type: 'currency',
                id: 'currency:result',
                status: 'success',
                input: query,
                displayValue: new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(
                  value.value,
                ),
                toUnit: value.to,
                copyText: String(value.value),
              });
          })
          .catch(() => {
            if (active)
              setCurrencyResult({
                ...currencyQuery,
                type: 'currency',
                id: 'currency:result',
                status: 'error',
                input: query,
              });
          }),
      300,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currencyQuery, query, locale, currencyRefresh]);
  const tool = useMemo(
    () =>
      currencyQuery
        ? (currencyResult?.input === query &&
          currencyResult?.from === currencyQuery.from &&
          currencyResult?.to === currencyQuery.to
            ? currencyResult
            : null) || {
            type: 'currency',
            id: 'currency:result',
            status: 'loading',
            input: query,
          }
        : launcherTool(query, locale),
    [query, locale, currencyQuery, currencyResult],
  );
  const helpOnly = query.trim() === '?' || (query.length > 0 && !query.trim());
  const showGuide = helpOnly || !query.trim();
  const entries = useMemo(() => {
    if (helpOnly) return [];
    if (tool?.type === 'system') {
      const matches = commands.filter(
        (entry) => entry.system && tool.matches.includes(entry.system),
      );
      if (matches.length)
        return matches.map((entry) => ({
          ...entry,
          systemSuggestion: tool.status !== 'success',
          nativeUnsupported: entry.unsupported,
          unsupported: tool.status === 'success' && entry.unsupported,
        }));
      return [
        {
          ...tool,
          tool: true,
          name: t(
            tool.error === 'INPUT_TOO_LONG'
              ? 'launcherTools.error.INPUT_TOO_LONG'
              : 'prefixPlus.unknownSystem',
          ),
        },
      ];
    }
    if (tool)
      return [
        {
          ...tool,
          tool: true,
          name:
            tool.status !== 'success'
              ? tool.type === 'currency'
                ? t(tool.status === 'loading' ? 'launcherNext.fxLoading' : 'launcherNext.fxError')
                : t('launcherTools.error.' + tool.error)
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
    const result = searchEntries(
      query,
      [
        ...commands.map((command) => ({
          ...command,
          usage: { favorite: settings.launcherCommandFavorites?.includes(command.id) },
        })),
        ...items.map((item) => ({
          ...item,
          icon:
            settings.itemIcons[item.id] ||
            settings.categories.find((c) => c.id === item.category)?.icon ||
            'file',
          name: (item.productName || item.name).replace(/\.(lnk|exe|desktop)$/i, ''),
          searchText:
            item.name +
            ' ' +
            (item.target || '') +
            ' ' +
            (item.insight?.description?.[settings.language] || ''),
        })),
      ].filter((entry) => !favoritesOnly || entry.usage?.favorite),
    );
    if (favoritesOnly) return result;
    if (!query.trim()) {
      const count = (entry) =>
        Number.isSafeInteger(commandUsage[entry.id]?.count) && commandUsage[entry.id].count > 0
          ? commandUsage[entry.id].count
          : 0;
      const recommended = commands
        .filter((entry) => count(entry) > 0)
        .sort(
          (a, b) =>
            count(b) - count(a) ||
            (commandUsage[b.id]?.lastUsed || 0) - (commandUsage[a.id]?.lastUsed || 0) ||
            a.name.localeCompare(b.name),
        )
        .slice(0, 3)
        .map((entry) => ({ ...entry, section: 'commands' }));
      const frequent = result.filter((entry) => entry.section === 'frequent');
      const chosen = new Set([...frequent, ...recommended].map((entry) => entry.id));
      return [
        ...frequent,
        ...recommended,
        ...result.filter((entry) => !chosen.has(entry.id)),
      ].slice(0, 16);
    }
    return result;
  }, [query, items, settings, t, tool, capabilities, commandUsage, helpOnly, favoritesOnly]);
  useEffect(() => {
    setActive(0);
    setActions(null);
    setNotice('');
    setError('');
  }, [query, favoritesOnly]);
  useEffect(() => {
    document.getElementById('result-' + entries[active]?.id)?.scrollIntoView({ block: 'nearest' });
  }, [active, query]);
  const selected = entries[Math.min(active, Math.max(0, entries.length - 1))];
  const isItem = (entry) => !!entry && !entry.command && !entry.tool;
  const pinSelected = async () => {
    if (!selected || selected.tool || busy) return;
    const version = sessionVersion.current;
    setBusy(true);
    try {
      if (selected.command) {
        const saved = await api.setCommandFavorite(
          selected.id,
          !settings.launcherCommandFavorites?.includes(selected.id),
        );
        if (currentSession(version)) setSettings(saved);
      } else {
        const favorite = !selected.usage?.favorite;
        await api.setLauncherFavorite(selected.id, favorite);
        if (currentSession(version))
          setItems((previous) =>
            previous.map((item) =>
              item.id === selected.id ? { ...item, usage: { ...item.usage, favorite } } : item,
            ),
          );
      }
    } catch (e) {
      if (currentSession(version)) setError(errorMessage(e));
    } finally {
      if (currentSession(version)) {
        setBusy(false);
        input.current?.focus();
      }
    }
  };
  const recordCommand = async (id, version) => {
    if (typeof api.recordLauncherCommand !== 'function') return;
    try {
      const result = await api.recordLauncherCommand(id);
      if (!currentSession(version)) return;
      if (result?.commandUsage) setCommandUsage(result.commandUsage);
      else if (result?.id === id && Number.isSafeInteger(result.count))
        setCommandUsage((previous) => ({
          ...previous,
          [id]: { count: result.count, lastUsed: result.lastUsed },
        }));
    } catch {}
  };
  const copyResult = async (entry, version) => {
    await api.launcherAction({ type: 'copy', text: entry.copyText });
    if (!currentSession(version)) return;
    setNotice(t('launcherPlus.copied', { value: entry.copyText }));
    input.current?.focus();
    input.current?.select();
  };
  const execute = async (entry) => {
    if (!entry || busy) return;
    if (entry.systemSuggestion) {
      setQuery('sys ' + entry.system);
      input.current?.focus();
      return;
    }
    if (loading && !entry.tool && (!entry.command || entry.system)) return;
    const version = sessionVersion.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (entry.unsupported) throw Error('LAUNCHER_UNSUPPORTED');
      if (entry.tool) {
        if (entry.status !== 'success') return;
        if (entry.type === 'web') {
          const outcome = await api.launcherAction({
            type: 'web',
            provider: entry.provider,
            query: entry.query,
          });
          if (currentSession(version)) close(outcome);
        } else await copyResult(entry, version);
      } else if (entry.system) {
        if (['empty-trash', 'shutdown'].includes(entry.system)) {
          const prepared = await api.launcherAction({ type: 'prepare-system', id: entry.system });
          if (currentSession(version)) {
            setConfirmation(prepared);
            setActions(null);
          }
        } else {
          const outcome = await api.launcherAction({ type: 'system', id: entry.system });
          await recordCommand(entry.id, version);
          if (currentSession(version)) close(outcome);
        }
      } else {
        const outcome = entry.command
          ? onCommand
            ? await onCommand(entry.command)
            : await api.runCommand(entry.command)
          : await api.launch(entry.id);
        if (entry.command) await recordCommand(entry.id, version);
        if (currentSession(version)) close(outcome);
      }
    } catch (e) {
      if (currentSession(version)) setError(errorMessage(e));
    } finally {
      if (currentSession(version)) setBusy(false);
    }
  };
  const runAction = async (type) => {
    if (!actions || busy) return;
    const version = sessionVersion.current;
    setBusy(true);
    setError('');
    try {
      if (type === 'favorite') {
        const favorite = !actions.usage?.favorite;
        await api.setLauncherFavorite(actions.id, favorite);
        if (!currentSession(version)) return;
        setItems((previous) =>
          previous.map((item) =>
            item.id === actions.id ? { ...item, usage: { ...item.usage, favorite } } : item,
          ),
        );
        setNotice(t(favorite ? 'launcherPlus.favoriteAdded' : 'launcherPlus.favoriteRemoved'));
        setActions(null);
        input.current?.focus();
      } else {
        const outcome = await api.launcherAction({ type, id: actions.id });
        if (currentSession(version)) close(outcome);
      }
    } catch (e) {
      if (currentSession(version)) setError(errorMessage(e));
    } finally {
      if (currentSession(version)) setBusy(false);
    }
  };
  const confirmSystem = async () => {
    if (!confirmation || busy || now >= confirmation.expiresAt) return;
    const version = sessionVersion.current;
    setBusy(true);
    setError('');
    try {
      const outcome = await api.launcherAction({
        type: 'confirm-system',
        token: confirmation.token,
      });
      await recordCommand('system:' + confirmation.id, version);
      if (currentSession(version)) {
        setConfirmation(null);
        close(outcome);
      }
    } catch (e) {
      if (currentSession(version)) {
        setError(errorMessage(e));
        setConfirmation(null);
        input.current?.focus();
      }
    } finally {
      if (currentSession(version)) setBusy(false);
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      pinSelected();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && ['1', '2'].includes(e.key)) {
      e.preventDefault();
      setFavoritesOnly(e.key === '2');
      return;
    }
    if (e.key === 'F1') {
      e.preventDefault();
      setQuery('?');
      return;
    }
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
        : entry.type === 'system'
          ? 'command'
          : ['conversion', 'currency'].includes(entry.type)
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
        {!confirmation && (
          <div
            className="launcher-favorite-tabs"
            role="group"
            aria-label={t('launcherNext.favorites')}
          >
            <button
              type="button"
              aria-pressed={!favoritesOnly}
              onClick={() => {
                setFavoritesOnly(false);
                input.current?.focus();
              }}
            >
              {t('launcherNext.all')}
            </button>
            <button
              type="button"
              aria-pressed={favoritesOnly}
              onClick={() => {
                setFavoritesOnly(true);
                input.current?.focus();
              }}
            >
              <Star size={13} />
              {t('launcherNext.favorites')}
            </button>
            {currencyQuery && (
              <button
                type="button"
                disabled={tool?.status === 'loading'}
                aria-label={t('currency.refresh')}
                title={t('currency.refresh')}
                onClick={() => setCurrencyRefresh((n) => n + 1)}
              >
                <RefreshCw size={14} />
                {t('currency.refresh')}
              </button>
            )}
            <button
              type="button"
              className="launcher-pin-selected"
              disabled={!selected || selected.tool || busy || loading}
              aria-label={t('launcherNext.pin')}
              aria-pressed={
                !!selected?.usage?.favorite ||
                !!settings.launcherCommandFavorites?.includes(selected?.id)
              }
              onClick={pinSelected}
            >
              <Star size={14} />
              <kbd>Ctrl+D</kbd>
            </button>
          </div>
        )}
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
                    {t(
                      entry.section === 'commands'
                        ? 'prefixPlus.recommended'
                        : 'launcherPlus.section.' + entry.section,
                    )}
                  </div>
                )}
                <button
                  role="option"
                  tabIndex={-1}
                  aria-selected={active === index}
                  id={'result-' + entry.id}
                  className={`launcher-result ${active === index ? 'selected' : ''} ${entry.tool ? 'launcher-tool-result' : ''}`}
                  onMouseMove={(event) => {
                    // Results can move under a stationary pointer while typing
                    // or scrolling. Only real pointer motion changes selection.
                    if (event.movementX || event.movementY) setActive(index);
                  }}
                  onClick={() => execute(entry)}
                  disabled={
                    busy ||
                    (loading &&
                      !entry.systemSuggestion &&
                      !entry.tool &&
                      (!entry.command || entry.system)) ||
                    entry.unsupported ||
                    (entry.tool && entry.status !== 'success')
                  }
                >
                  <span className="launcher-result-icon">
                    {entry.tool ? (
                      entry.type === 'web' ? (
                        <Globe />
                      ) : entry.type === 'system' ? (
                        <Command />
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
                        ? entry.type === 'currency'
                          ? entry.status === 'success'
                            ? `${entry.provider} · ${t('launcherNext.fxDate', { date: entry.date })}${entry.cached ? ' · ' + t('launcherNext.fxCached') : ''}`
                            : t('launcherNext.fxHelp')
                          : entry.type === 'web'
                            ? entry.url || t('launcherPlus.webHint')
                            : entry.input
                        : entry.systemSuggestion
                          ? t('prefixPlus.chooseSystem')
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
            {!entries.length && !helpOnly && (
              <div className="launcher-empty">
                <Search size={28} />
                <p>
                  {t(
                    favoritesOnly && !query.trim()
                      ? 'launcherNext.emptyFavorites'
                      : 'launcher.empty',
                  )}
                </p>
              </div>
            )}
          </div>
        )}
        {showGuide && !confirmation && (
          <section
            className={`launcher-prefix-guide ${helpOnly ? 'expanded' : ''}`}
            aria-label={t('prefixPlus.title')}
          >
            <div className="launcher-prefix-heading">
              <b>{t('prefixPlus.title')}</b>
              <small>
                {t('ux312.launcherHint', { target: settings.currency?.target || 'TRY' })}
              </small>
              <span>{t('prefixPlus.helpHint')}</span>
            </div>
            <div
              className="launcher-prefix-options"
              onKeyDown={(event) => {
                if (
                  !['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(
                    event.key,
                  )
                )
                  return;
                const buttons = [...event.currentTarget.querySelectorAll('button')];
                const current = buttons.indexOf(document.activeElement);
                event.preventDefault();
                event.stopPropagation();
                buttons[
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? buttons.length - 1
                      : (current +
                          (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) +
                          buttons.length) %
                        buttons.length
                ]?.focus();
              }}
            >
              {['g', 'yt', 'gh', 'calc', 'sys'].map((prefix) => (
                <button
                  type="button"
                  key={prefix}
                  disabled={busy}
                  aria-label={t('prefixPlus.use', { prefix })}
                  onClick={() => {
                    setQuery(prefix + ' ');
                    input.current?.focus();
                  }}
                >
                  <code>{prefix}</code>
                  <span>{t('prefixPlus.' + prefix)}</span>
                  {helpOnly && <small>{t('prefixPlus.example.' + prefix)}</small>}
                </button>
              ))}
            </div>
          </section>
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
