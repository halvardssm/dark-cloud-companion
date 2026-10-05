import { en, type MessageKey } from "./en";

export const defaultLocale = "en";
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en };

export function useTranslations(locale: Locale = defaultLocale) {
  const dict = dictionaries[locale];
  return (key: MessageKey) => dict[key] ?? en[key];
}
