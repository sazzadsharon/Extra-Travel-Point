import { type LocaleCode, DEFAULT_LOCALE, LANG_STORAGE_KEY, SUPPORTED_LOCALES } from './config';

export const langStorage = {
  getLanguage(): LocaleCode {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as LocaleCode)) {
      return stored as LocaleCode;
    }
    return DEFAULT_LOCALE;
  },
  setLanguage(locale: LocaleCode): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LANG_STORAGE_KEY, locale);
  },
  clearLanguage(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(LANG_STORAGE_KEY);
  },
};
