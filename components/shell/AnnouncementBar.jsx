"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../Icon";
import { useApp } from "./AppContext";
import { useI18n } from "@/components/I18nProvider";

// The scrolling announcement bar at the top of every page.
// Everyone sees it; only people with "feed.announce" (HR Admin, Super Admin, or a role given that
// permission) get the edit button. Messages are added in Admin → Announcements.

const TONE_ICON = { info: "megaphone", celebrate: "sparkles", urgent: "bolt" };

function Items({ list, hidden }) {
  return (
    <ul className="ann-items" aria-hidden={hidden || undefined}>
      {list.map((a) => (
        <li key={a.id} className={`ann-item ann-${a.tone}`}>
          <Icon name={TONE_ICON[a.tone] ?? "megaphone"} size={14} />
          <span dir="auto">{a.text}</span>
          {a.author && <span className="ann-author">— {a.author}</span>}
        </li>
      ))}
    </ul>
  );
}

export function AnnouncementBar() {
  const { data, can } = useApp();
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  const list = data.announcements ?? [];
  if (!list.length) return null;

  const urgent = list.some((a) => a.tone === "urgent");
  // Roughly 60 characters every 10 seconds, so long messages don't race past.
  const chars = list.reduce((n, a) => n + a.text.length + (a.author?.length ?? 0) + 12, 0);
  const duration = Math.max(18, Math.round(chars / 6));

  return (
    <section className="ann-bar" data-urgent={urgent || undefined} data-paused={paused || undefined} aria-label={t("ann.label")}>
      <span className="ann-label">
        <Icon name="megaphone" size={15} />
        <span className="ann-label-text">{t("ann.label")}</span>
      </span>
      <div className="ann-viewport">
        <div className="ann-track" style={{ "--ann-duration": `${duration}s` }}>
          <Items list={list} />
          <Items list={list} hidden />
        </div>
      </div>
      <button
        className="ann-btn"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? t("ann.play") : t("ann.pause")}
        title={paused ? t("ann.play") : t("ann.pause")}
        aria-pressed={paused}
      >
        {paused ? (
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="4" y="3.5" width="2.6" height="9" rx="1" fill="currentColor" />
            <rect x="9.4" y="3.5" width="2.6" height="9" rx="1" fill="currentColor" />
          </svg>
        )}
      </button>
      {can("feed.announce") && (
        <Link href="/admin/announcements" className="ann-btn" aria-label={t("ann.manage")} title={t("ann.manage")}>
          <Icon name="pencil" size={14} />
        </Link>
      )}
    </section>
  );
}
