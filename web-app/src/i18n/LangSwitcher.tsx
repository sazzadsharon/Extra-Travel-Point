'use client';

import { Languages } from 'lucide-react';
import { useTranslation } from './useTranslation';
import { LANGUAGE_CONFIG, SUPPORTED_LOCALES } from './config';

interface LangSwitcherProps {
  variant?: 'compact' | 'full';
  showIcon?: boolean;
}

export default function LangSwitcher({
  variant = 'compact',
  showIcon = true,
}: LangSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  const toggleLanguage = () => {
    const next = locale === 'en' ? 'bn' : 'en';
    setLocale(next);
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label={t('language.switchLanguage')}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-ink-600 bg-ink-50 rounded-lg hover:bg-ink-100 hover:text-ink-800 transition-colors"
      >
        {showIcon && <Languages className="w-3.5 h-3.5" />}
        <span>{LANGUAGE_CONFIG[locale].name}</span>
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600">
      {showIcon && <Languages className="w-3.5 h-3.5" />}
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        className="border-0 bg-transparent text-ink-700 focus:outline-none focus:ring-2 focus:ring-etp-400 rounded px-2 py-1"
      >
        {SUPPORTED_LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {LANGUAGE_CONFIG[loc].name}
          </option>
        ))}
      </select>
    </div>
  );
}
