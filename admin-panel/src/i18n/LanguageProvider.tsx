'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ADMIN_MESSAGES, type AdminLocale } from './messages';

interface AdminLanguageContextValue {
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  t: (key: string) => string;
}

const AdminLanguageContext = createContext<AdminLanguageContextValue | undefined>(undefined);
const STORAGE_KEY = 'etp_language';

export function AdminLanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'bn') setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }, [locale]);

  const setLocale = useCallback((next: AdminLocale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  const t = useCallback((key: string) => ADMIN_MESSAGES[locale][key] ?? ADMIN_MESSAGES.en[key] ?? key, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>;
}

export function useAdminLanguage() {
  const context = useContext(AdminLanguageContext);
  if (!context) throw new Error('useAdminLanguage must be used within AdminLanguageProvider');
  return context;
}
