'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { type LocaleCode, DEFAULT_LOCALE } from './config';
import { langStorage } from './langStorage';
import { t } from './i18n';

export interface LanguageContextType {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = langStorage.getLanguage();
    setLocaleState(stored);
  }, []);

  const setLocale = useCallback((next: LocaleCode) => {
    langStorage.setLanguage(next);
    setLocaleState(next);
  }, []);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => t(locale, key, params),
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: translate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return { locale: context.locale, setLocale: context.setLocale };
}
