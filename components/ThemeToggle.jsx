"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { setPreferences } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";

function resolved() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "light" || t === "dark") return t;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** One tap between light and dark. “Automatic” stays available in Settings. */
export function ThemeToggle({ signedIn = true, className = "theme-toggle", labels }) {
  const [mode, setMode] = useState("light");
  const { t } = useI18n();
  useEffect(() => setMode(resolved()), []);
  const next = mode === "dark" ? "light" : "dark";
  const label = (labels ?? { light: t("theme.switchToLight"), dark: t("theme.switchToDark") })[next];

  function toggle() {
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `wof_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setMode(next);
    if (signedIn) setPreferences({ theme: next });
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-label={label} title={label}>
      <Icon name={mode === "dark" ? "sun" : "moon"} size={16} />
    </button>
  );
}
