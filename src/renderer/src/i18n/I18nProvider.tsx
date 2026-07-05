import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { defaultLocale, normalizeLocale, supportedLocales } from '../../../shared/i18n/locale-manifest';
import { createTranslator } from '../../../shared/i18n/translate';
import type { LocaleCode, TranslationKey, TranslationParams } from '../../../shared/i18n/types';

interface I18nContextValue {
  locale: LocaleCode;
  supportedLocales: typeof supportedLocales;
  settingsWarning: string;
  setLocale: (locale: LocaleCode) => Promise<void>;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(defaultLocale);
  const [settingsWarning, setSettingsWarning] = useState('');

  useEffect(() => {
    let cancelled = false;
    window.suwol.app.getAppSettings()
      .then((settings) => {
        if (!cancelled) {
          setLocaleState(normalizeLocale(settings.locale));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSettingsWarning(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (nextLocale: LocaleCode) => {
    const normalizedLocale = normalizeLocale(nextLocale);
    setLocaleState(normalizedLocale);
    setSettingsWarning('');

    try {
      await window.suwol.app.saveAppSettings({ locale: normalizedLocale });
    } catch (error) {
      setSettingsWarning(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    supportedLocales,
    settingsWarning,
    setLocale,
    t
  }), [locale, setLocale, settingsWarning, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
