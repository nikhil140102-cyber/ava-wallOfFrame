"use client";

import { Icon } from "./Icon";
import { useApp } from "./shell/AppContext";

export function RecognizeButton({ to, label = "Recognize", variant = "tinted" }) {
  const { openRecognize, can } = useApp();
  if (!can("recognition.give")) return null;
  return (
    <button className={`btn btn-sm btn-${variant}`} onClick={() => openRecognize(to ? [to] : [])}>
      <Icon name="sparkles" size={14} /> {label}
    </button>
  );
}
