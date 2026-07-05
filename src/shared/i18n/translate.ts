import { fallbackLocale, normalizeLocale } from './locale-manifest';
import { localeDictionaries } from './locales';
import type { LocaleCode, TranslationDictionary, TranslationKey, TranslationParams } from './types';

export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

export function createTranslator(locale: LocaleCode): Translator {
  return (key, params) => translate(key, params, locale);
}

export function translate(
  key: TranslationKey,
  params: TranslationParams | undefined,
  locale: LocaleCode,
  dictionaries: Record<LocaleCode, TranslationDictionary> = localeDictionaries
): string {
  const normalizedLocale = normalizeLocale(locale);
  const localized = resolveTranslation(dictionaries[normalizedLocale], key);
  const fallback = resolveTranslation(dictionaries[fallbackLocale], key);
  const template = localized ?? fallback;

  if (template === undefined) {
    console.warn(`[i18n] Missing translation key: ${key}`);
    return key;
  }

  if (localized === undefined && normalizedLocale !== fallbackLocale) {
    console.warn(`[i18n] Missing ${normalizedLocale} translation for key: ${key}`);
  }

  return interpolate(template, params);
}

function resolveTranslation(dictionary: TranslationDictionary | undefined, key: TranslationKey): string | undefined {
  if (!dictionary) {
    return undefined;
  }

  let current: unknown = dictionary;
  for (const segment of key.split('.')) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params: TranslationParams | undefined): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
