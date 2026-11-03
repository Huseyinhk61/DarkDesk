import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import tr from './locales/tr.json';
import en from './locales/en.json';
import { defaultSettings, categorySegments } from '../shared/domain';
import { sanitizeAppearance, resolveTheme } from '../shared/appearance';
const Context = createContext(null);
const dictionaries = { tr, en };
export function PreferencesProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      return {
        ...structuredClone(defaultSettings),
        ...sanitizeAppearance(JSON.parse(localStorage.getItem('darkdesk-appearance') || '{}')),
      };
    } catch {
      return structuredClone(defaultSettings);
    }
  });
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const color = window.matchMedia('(prefers-color-scheme: dark)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateColor = () => setDark(color.matches);
    const updateMotion = () => setReduced(motion.matches);
    color.addEventListener('change', updateColor);
    motion.addEventListener('change', updateMotion);
    updateColor();
    updateMotion();
    return () => {
      color.removeEventListener('change', updateColor);
      motion.removeEventListener('change', updateMotion);
    };
  }, []);
  const language = settings.language,
    locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const t = useMemo(
    () =>
      (key, params = {}) => {
        const text = dictionaries[language]?.[key] ?? dictionaries.tr[key] ?? key;
        return text.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? '{' + name + '}'));
      },
    [language],
  );
  useLayoutEffect(() => {
    const root = document.documentElement;
    const theme = resolveTheme(settings.theme, dark);
    root.dataset.theme = theme.id;
    root.dataset.themePreference = settings.theme;
    root.dataset.colorScheme = theme.scheme;
    root.dataset.density = settings.density;
    root.dataset.motion = settings.motion === 'reduced' || reduced ? 'reduced' : 'full';
    root.style.setProperty('--ui-scale', String(settings.uiScale / 100));
    root.style.colorScheme = theme.scheme;
    for (const [key, value] of Object.entries(theme.tokens))
      root.style.setProperty('--' + key, value);
    root.lang = language;
    try {
      localStorage.setItem('darkdesk-appearance', JSON.stringify(sanitizeAppearance(settings)));
    } catch {}
  }, [
    settings.theme,
    settings.uiScale,
    settings.density,
    settings.motion,
    language,
    settings.iconPack,
    dark,
    reduced,
  ]);
  const label = (c) => (c?.labelKey ? t(c.labelKey) : c?.name || '');
  const categoryLabel = (id) => label(settings.categories.find((c) => c.id === id));
  const groupPath = (id) => categorySegments(id, settings.categories).join(' / ');
  const errorMessage = (error) => {
    let raw = typeof error === 'string' ? error : error.message;
    raw = raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
    const code = raw.split(':')[0];
    if (dictionaries[language]['errors.' + code]) {
      const detail = raw.slice(code.length + 1).trim();
      return (
        t('errors.' + code) +
        (detail
          ? ' ' +
            (detail.includes(':') || dictionaries[language]['errors.' + detail]
              ? errorMessage(detail)
              : detail)
          : '')
      );
    }
    return raw;
  };
  return (
    <Context.Provider
      value={{
        settings,
        setSettings,
        t,
        language,
        locale,
        label,
        categoryLabel,
        groupPath,
        errorMessage,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
