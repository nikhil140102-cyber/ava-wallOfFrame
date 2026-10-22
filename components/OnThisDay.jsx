"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Polaroid } from "./Polaroid";
import { useApp } from "./shell/AppContext";
import { shareOnThisDay } from "@/app/actions";
import { useI18n } from "./I18nProvider";

const todayKey = () => `wof-otd-hidden-${new Date().toISOString().slice(0, 10)}`;

/** Facebook-style “On this day”: what happened on today’s date in earlier years. */
export function OnThisDay({ groups, compact = false }) {
  const { toast, can } = useApp();
  const { t, fmt } = useI18n();
  const [tab, setTab] = useState(0);
  const [selected, setSelected] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(todayKey()) === "1");
    } catch {}
  }, []);

  if (!groups?.length || hidden) return null;
  const g = groups[Math.min(tab, groups.length - 1)];
  const pick = g.items.find((i) => i.id === selected) ?? g.items.find((i) => !i.private) ?? g.items[0];
  const label = (n) => t("otd.yearsAgo", { count: n });
  const date = fmt.date(g.items[0].at, { day: "numeric", month: "long", year: "numeric" });

  async function share() {
    setPending(true);
    const r = await shareOnThisDay(pick.id);
    setPending(false);
    toast(r.ok ? t("otd.shared") : r.error, { tone: r.ok ? "default" : "error" });
  }

  return (
    <section className={`card otd${compact ? " otd-compact" : ""}`} id="on-this-day" aria-labelledby="otd-title">
      <div className="otd-head">
        <span className="otd-icon" aria-hidden="true">
          🕰️
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="otd-title" className="title-3">
            {t("otd.title")}
          </h2>
          <p className="caption">{t("otd.yearsAgoToday", { count: g.yearsAgo, date })}</p>
        </div>
        <button
          className="btn btn-plain btn-sm"
          onClick={() => {
            try {
              localStorage.setItem(todayKey(), "1");
            } catch {}
            setHidden(true);
          }}
          aria-label={t("otd.hide")}
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {groups.length > 1 && (
        <div className="segmented otd-tabs" role="tablist" aria-label={t("otd.howLongAgo")}>
          {groups.map((x, i) => (
            <button key={x.year} role="tab" aria-selected={i === tab} onClick={() => (setTab(i), setSelected(null))}>
              {label(x.yearsAgo)}
            </button>
          ))}
        </div>
      )}

      <div className="otd-strip">
        <svg className="string" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 14 Q 500 40 1000 14" />
        </svg>
        {g.items.map((it) => (
          <div key={it.id} className="otd-hang" data-selected={pick.id === it.id || undefined}>
            <Polaroid item={it} onOpen={() => setSelected(it.id)} />
          </div>
        ))}
      </div>

      <div className="otd-foot">
        <p className="otd-quote" dir="auto">
          <b>{pick.title}</b>
          {pick.detail ? <span> — {pick.detail.length > 120 ? `${pick.detail.slice(0, 120)}…` : pick.detail}</span> : null}
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {can("recognition.give") && !pick.private && (
            <button className="btn btn-filled btn-sm" onClick={share} disabled={pending}>
              <Icon name="send" size={13} /> {pending ? t("otd.sharing") : t("otd.share")}
            </button>
          )}
          <Link className="btn btn-gray btn-sm" href={`/wall?y=${g.year}`}>
            {t("otd.seeWall", { year: g.year })}
          </Link>
        </div>
      </div>
    </section>
  );
}
