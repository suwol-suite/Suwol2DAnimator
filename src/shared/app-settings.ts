import { defaultLocale, normalizeLocale } from './i18n/locale-manifest';
import type { LocaleCode } from './i18n/types';

export interface AppSettings {
  locale: LocaleCode;
  updates: UpdateSettings;
}

export interface UpdateSettings {
  autoCheckOnStart: boolean;
  lastCheckAt?: string;
}

export const defaultAppSettings: AppSettings = {
  locale: defaultLocale,
  updates: {
    autoCheckOnStart: true
  }
};

export function normalizeAppSettings(value: unknown): AppSettings {
  const candidate = typeof value === 'object' && value !== null
    ? value as Partial<AppSettings>
    : {};

  return {
    locale: normalizeLocale(candidate.locale),
    updates: normalizeUpdateSettings(candidate.updates)
  };
}

export function normalizeUpdateSettings(value: unknown): UpdateSettings {
  const candidate = typeof value === 'object' && value !== null
    ? value as Partial<UpdateSettings>
    : {};
  const lastCheckAt = typeof candidate.lastCheckAt === 'string' && candidate.lastCheckAt.trim().length > 0
    ? candidate.lastCheckAt
    : undefined;

  return {
    autoCheckOnStart: typeof candidate.autoCheckOnStart === 'boolean'
      ? candidate.autoCheckOnStart
      : defaultAppSettings.updates.autoCheckOnStart,
    ...(lastCheckAt ? { lastCheckAt } : {})
  };
}
