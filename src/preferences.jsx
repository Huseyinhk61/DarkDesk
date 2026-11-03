import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';
import tr from './locales/tr.json';
import en from './locales/en.json';
import { defaultSettings, categorySegments } from '../shared/domain';
const Context = createContext(null);
const dictionaries = { tr, en };
export function PreferencesProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      return {
        ...structuredClone(defaultSettings),
        ...JSON.parse(localStorage.getItem('darkdesk-appearance') || '{}'),
      };
    } catch {
      return structuredClone(defaultSettings);
    }
  });
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
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = language;
    localStorage.setItem(
      'darkdesk-appearance',
      JSON.stringify({ theme: settings.theme, language, iconPack: settings.iconPack }),
    );
  }, [settings.theme, language, settings.iconPack]);
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
