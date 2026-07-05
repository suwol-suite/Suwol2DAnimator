import { defaultLocale, normalizeLocale } from './i18n/locale-manifest';
import type { LocaleCode } from './i18n/types';

export interface AppSettings {
  locale: LocaleCode;
}

export const defaultAppSettings: AppSettings = {
  locale: defaultLocale
};

export function normalizeAppSettings(value: unknown): AppSettings {
  const candidate = typeof value === 'object' && value !== null
    ? value as Partial<AppSettings>
    : {};

  return {
    locale: normalizeLocale(candidate.locale)
  };
}
