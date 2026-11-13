export type LocaleCode = 'en' | 'bn';

export interface LanguageConfig {
  code: LocaleCode;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LOCALES: LocaleCode[] = ['en', 'bn'];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export const LANGUAGE_CONFIG: Record<LocaleCode, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
  },
  bn: {
    code: 'bn',
    name: 'Bangla',
    nativeName: 'বাংলা',
    dir: 'ltr',
  },
};

export const LANG_STORAGE_KEY = 'etp_language';
