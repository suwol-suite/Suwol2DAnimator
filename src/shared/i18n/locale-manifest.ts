import type { LocaleCode } from './types';

export const defaultLocale: LocaleCode = 'ko';
export const fallbackLocale: LocaleCode = 'en';

export const supportedLocales = [
  { code: 'ko', label: 'Korean', nativeLabel: '한국어' },
  { code: 'en', label: 'English', nativeLabel: 'English' }
] as const;

export function isSupportedLocale(value: unknown): value is LocaleCode {
  return typeof value === 'string' && supportedLocales.some((locale) => locale.code === value);
}

export function normalizeLocale(value: unknown): LocaleCode {
  return isSupportedLocale(value) ? value : defaultLocale;
}
