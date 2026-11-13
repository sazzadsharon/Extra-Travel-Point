'use client';

import { Languages } from 'lucide-react';
import { useAdminLanguage } from './LanguageProvider';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useAdminLanguage();
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
      <Languages className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{t('language')}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as 'en' | 'bn')}
        aria-label={t('language')}
        className="cursor-pointer bg-transparent font-medium outline-none"
      >
        <option value="en">{t('english')}</option>
        <option value="bn">{t('bangla')}</option>
      </select>
    </label>
  );
}
