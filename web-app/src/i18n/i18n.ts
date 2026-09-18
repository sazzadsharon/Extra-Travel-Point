import { type LocaleCode, DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';
import en from './locales/en.json';
import bn from './locales/bn.json';

type TranslationNode = string | Record<string, unknown>;
type Translations = Record<string, TranslationNode>;
type TranslationTree = Record<string, TranslationNode>;

const resources: Record<LocaleCode, TranslationTree> = {
  en,
  bn,
};

function getNestedValue(
  obj: Record<string, unknown>,
  path: string[]
): string | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? (current as string) : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

export function t(
  locale: LocaleCode,
  key: string,
  params?: Record<string, string | number>
): string {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    return key;
  }

  const segments = key.split('.');
  const value = getNestedValue(resources[locale] as unknown as Record<string, unknown>, segments);

  if (value === undefined) {
    if (locale !== DEFAULT_LOCALE) {
      const fallback = getNestedValue(
        resources[DEFAULT_LOCALE] as unknown as Record<string, unknown>,
        segments
      );
      if (fallback !== undefined) {
        return interpolate(fallback, params);
      }
    }
    return key;
  }

  return interpolate(value, params);
}

export function getTranslationsForLocale(locale: LocaleCode): TranslationTree {
  return resources[locale] || resources[DEFAULT_LOCALE];
}

export { resources };
