import { en } from './en';
import { zhTW, type MessageKey } from './zh-TW';

export type { MessageKey };
export type Locale = 'zh-TW' | 'en';

export const DEFAULT_LOCALE: Locale = 'zh-TW';

const tables: Record<Locale, Partial<Record<MessageKey, string>>> = {
  'zh-TW': zhTW,
  en,
};

let current: Locale = DEFAULT_LOCALE;

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/**
 * Translate a key. Lookup order: current locale → zh-TW → the key itself.
 * `{name}` placeholders are replaced from `params`.
 */
export function t(key: MessageKey | (string & {}), params?: Record<string, string | number>): string {
  const k = key as MessageKey;
  const raw = tables[current][k] ?? zhTW[k] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}
