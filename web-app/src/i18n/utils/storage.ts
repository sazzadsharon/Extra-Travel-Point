import { type LocaleCode, DEFAULT_LOCALE, LANG_STORAGE_KEY, SUPPORTED_LOCALES } from '../config';

export const langStorage = {
  getLanguage(): LocaleCode {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    return stored && SUPPORTED_LOCALES.includes(stored as LocaleCode)
      ? (stored as LocaleCode)
      : DEFAULT_LOCALE;
  },
  setLanguage(locale: LocaleCode): void {
    if (typeof window === 'undefined' || !SUPPORTED_LOCALES.includes(locale)) return;
    window.localStorage.setItem(LANG_STORAGE_KEY, locale);
  },
  clearLanguage(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(LANG_STORAGE_KEY);
  },
};
