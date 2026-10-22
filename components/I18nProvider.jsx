"use client";

import { createContext, useContext, useMemo } from "react";
import { createTranslator, rich } from "@/lib/i18n/translate";
import { buildFormatData, formattersFromData } from "@/lib/i18n/format";
import { localeInfo } from "@/lib/i18n/locales";

const I18n = createContext(null);

export function I18nProvider({ locale, messages, fmtData, children }) {
  const value = useMemo(
    () => ({ locale, dir: localeInfo(locale).dir, t: createTranslator(locale, messages), fmt: formattersFromData(fmtData), rich }),
    [locale, messages, fmtData]
  );
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

/** For client components: const { t, fmt, rich, locale } = useI18n(); */
export function useI18n() {
  const v = useContext(I18n);
  if (!v) {
    // Outside the provider (shouldn't happen) — behave like English.
    return { locale: "en", dir: "ltr", t: createTranslator("en", {}), fmt: formattersFromData(buildFormatData("en")), rich };
  }
  return v;
}
