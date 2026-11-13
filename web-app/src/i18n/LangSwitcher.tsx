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

  const isCompact = variant === 'compact';

  return (
    <label
      className={
        isCompact
          ? 'inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 shadow-sm transition-colors hover:bg-ink-50'
          : 'inline-flex items-center gap-1.5 text-xs font-medium text-ink-600'
      }
    >
      {showIcon && <Languages aria-hidden="true" className="h-4 w-4 shrink-0" />}
      <span className={isCompact ? 'sr-only' : 'whitespace-nowrap'}>
        {t('language.selectLanguage')}
      </span>
      <select
        value={locale}
        aria-label={t('language.selectLanguage')}
        onChange={(event) => setLocale(event.target.value as typeof locale)}
        className={
          isCompact
            ? 'max-w-[7.5rem] cursor-pointer border-0 bg-transparent py-0 pl-0 pr-5 text-xs font-semibold text-ink-800 outline-none focus:ring-2 focus:ring-etp-400'
            : 'rounded px-2 py-1 text-ink-700 outline-none focus:ring-2 focus:ring-etp-400'
        }
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_CONFIG[code].nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
