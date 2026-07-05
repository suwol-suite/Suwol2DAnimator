export type LocaleCode = 'ko' | 'en';

export type TranslationValue = string | TranslationDictionary;

export interface TranslationDictionary {
  [key: string]: TranslationValue;
}

export type TranslationParam = string | number | boolean;

export type TranslationParams = Record<string, TranslationParam>;

export type TranslationKey = string;
