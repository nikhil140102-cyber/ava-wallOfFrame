"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALES } from "@/lib/i18n/locales";
import { useI18n } from "@/components/I18nProvider";
import { setGuestLocale, setPreferences } from "@/app/actions";
import { Icon } from "./Icon";

/** Searchable list of every language; the current one is checked. */
function LanguageList({ current, onPick, busy, autoFocus = false }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const listId = useId();
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LOCALES;
    return LOCALES.filter((l) => l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code === q);
  }, [query]);

  return (
    <div className="lang-list-wrap">
      <div className="lang-search">
        <Icon name="search" size={14} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("language.search")}
          aria-label={t("language.search")}
          aria-controls={listId}
          autoFocus={autoFocus}
        />
      </div>
      <ul className="lang-list" id={listId} role="listbox" aria-label={t("language.list")}>
        {matches.map((l) => (
          <li key={l.code} role="option" aria-selected={l.code === current}>
            <button type="button" className="menu-item lang-item" onClick={() => onPick(l.code)} disabled={busy} lang={l.code} dir={l.dir}>
              <span className="lang-names">
                <span className="lang-native">{l.native}</span>
                {l.native !== l.name && (
                  <span className="caption" lang="en" dir="ltr">
                    {l.name}
                  </span>
                )}
              </span>
              {l.code === current && <Icon name="check" size={15} stroke={2.6} className="lang-check" />}
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="lang-empty caption">{t("language.noMatch")}</li>}
      </ul>
    </div>
  );
}

/**
 * Language switcher. "button" = compact button with a popover (sign-in page, top bars);
 * "inline" = the searchable list on its own (Settings).
 */
export function LanguagePicker({ signedIn, variant = "button" }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function pick(code) {
    if (code === locale) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      if (signedIn) await setPreferences({ locale: code });
      else await setGuestLocale(code);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (variant === "inline") {
    return (
      <div className="lang-inline">
        <LanguageList current={locale} onPick={pick} busy={busy} />
      </div>
    );
  }

  const label = t("language.button", { language: current.native });
  return (
    <div className="lang-picker" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="lang-button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={t("language.label")}
      >
        <Icon name="compass" size={15} />
        <span className="lang-current" lang={current.code} dir={current.dir}>
          {current.native}
        </span>
        <Icon name="chevronDown" size={12} stroke={2.4} />
      </button>
      {open && (
        <div className="popover lang-popover" role="dialog" aria-label={t("language.choose")}>
          <div className="lang-popover-title caption">{t("language.choose")}</div>
          <LanguageList current={locale} onPick={pick} busy={busy} autoFocus />
        </div>
      )}
    </div>
  );
}
