import { en, type MessageKey } from "./en";

export type { MessageKey };
export const defaultLocale = "en";
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en };

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function useTranslations(locale: Locale = defaultLocale): Translate {
  const dict = dictionaries[locale];
  return (key, vars) => {
    const s = dict[key] ?? en[key];
    return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
  };
}
