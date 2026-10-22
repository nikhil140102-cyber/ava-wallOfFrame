import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_LOCALE, isLocale, localeInfo, matchLocale } from "./locales";
import { loadMessages, EN } from "./messages";
import { createTranslator, rich } from "./translate";
import { buildFormatData, formattersFromData } from "./format";

/** The person's language: their saved choice → the sign-in page choice (cookie) → their browser → English. */
export const getLocale = cache(async () => {
  const user = await getCurrentUser();
  if (user?.locale && isLocale(user.locale)) return user.locale;
  const cookie = (await cookies()).get("wof_locale")?.value;
  if (cookie && isLocale(cookie)) return cookie;
  return matchLocale((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
});

/** For server components: const { t, fmt, rich } = await getI18n(); */
export const getI18n = cache(async () => {
  const locale = await getLocale();
  const messages = await loadMessages(locale);
  const fmtData = buildFormatData(locale);
  return { locale, dir: localeInfo(locale).dir, messages, fmtData, t: createTranslator(locale, messages, EN), fmt: formattersFromData(fmtData), rich };
});

/** Translate for someone else (e.g. a notification in the recipient's language). */
export async function translatorFor(locale) {
  const code = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const messages = await loadMessages(code);
  return createTranslator(code, messages, EN);
}
