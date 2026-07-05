import ko from './locales/ko.json';
import en from './locales/en.json';
import type { LocaleCode, TranslationDictionary } from './types';

export const localeDictionaries: Record<LocaleCode, TranslationDictionary> = {
  ko,
  en
};
