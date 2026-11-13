import type { LocaleCode } from '../config';

const LOCALE_TAG: Record<LocaleCode, string> = {
  en: 'en-BD',
  bn: 'bn-BD',
};

export function formatNumber(value: number, locale: LocaleCode): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale]).format(value);
}

export function formatCurrency(
  value: number,
  locale: LocaleCode,
  currency = 'BDT'
): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(
  value: Date | string | number,
  locale: LocaleCode,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], options).format(new Date(value));
}
