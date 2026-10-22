// English source strings live in lib/i18n/messages/en/<area>.json (keys like "home.greeting").
// `npm run i18n:merge` combines them into messages/en.json; each other language is messages/<code>.json.
import { DEFAULT_LOCALE, isLocale } from "./locales";
import EN_FLAT from "./messages/en.json";

export const EN = EN_FLAT;

const cache = new Map();

/** English plus the language's own strings on top (anything missing stays English). */
export async function loadMessages(locale) {
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) return EN;
  if (!cache.has(locale)) {
    cache.set(
      locale,
      import(`./messages/${locale}.json`)
        .then((m) => ({ ...EN, ...(m.default ?? m) }))
        .catch(() => EN)
    );
  }
  return cache.get(locale);
}
