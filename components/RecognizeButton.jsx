"use client";

import { Icon } from "./Icon";
import { useApp } from "./shell/AppContext";
import { useI18n } from "@/components/I18nProvider";

export function RecognizeButton({ to, label, variant = "tinted" }) {
  const { openRecognize, can } = useApp();
  const { t } = useI18n();
  if (!can("recognition.give")) return null;
  return (
    <button className={`btn btn-sm btn-${variant}`} onClick={() => openRecognize(to ? [to] : [])}>
      <Icon name="sparkles" size={14} /> {label ?? t("nav.recognize")}
    </button>
  );
}
