"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import { useApp } from "@/components/shell/AppContext";
import { awardBadge } from "@/app/actions";
import { PageHelp } from "@/components/PageHelp";

function AwardTo({ badge, onDone }) {
  const { data, can, toast } = useApp();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  if (!can("badges.award")) return null;
  const options = data.people
    .filter(
      (p) => p.id !== data.me.id && !badge.holders.some((h) => h.id === p.id) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))
    )
    .slice(0, 4);
  return (
    <div className="award-to">
      <div className="section-label" style={{ padding: "0 0 8px" }}>
        {t("badges.award.heading")}
      </div>
      <label className="search">
        <Icon name="search" size={15} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("badges.award.placeholder")}
          aria-label={t("badges.award.searchLabel")}
        />
      </label>
      {q &&
        options.map((p) => (
          <div key={p.id} className="rail-row">
            <Avatar name={p.name} size={30} />
            <span style={{ flex: 1 }}>
              <b>{p.name}</b>
              <span className="caption">{p.title}</span>
            </span>
            <button
              className="btn btn-sm btn-tinted"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                const r = await awardBadge(p.id, badge.id, "");
                setPending(false);
                toast(r.ok ? t("badges.award.toast", { badge: badge.name, name: p.name.split(" ")[0] }) : r.error, {
                  tone: r.ok ? "default" : "error",
                });
                if (r.ok) onDone();
              }}
            >
              {t("badges.award.button")}
            </button>
          </div>
        ))}
      {q && options.length === 0 && (
        <p className="caption" style={{ marginTop: 8 }}>
          {t("badges.award.noMatch")}
        </p>
      )}
    </div>
  );
}

export function BadgeBrowser({ badges, canManage }) {
  const { t, fmt } = useI18n();
  const [show, setShow] = useState("all");
  const [open, setOpen] = useState(null);
  const earned = badges.filter((b) => b.earnedAt).length;
  const categories = [...new Set(badges.map((b) => b.category))];

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) setOpen(badges.find((b) => b.id === hash) ?? null);
  }, [badges]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1 className="large-title">{t("badges.title")}</h1>
          <p>{t("badges.subtitle", { earned: fmt.num(earned), count: badges.length })}</p>
        </div>
        <PageHelp topic="badges" />
        {canManage && (
          <Link href="/admin/badges" className="btn btn-tinted">
            <Icon name="pencil" size={15} /> {t("badges.manage")}
          </Link>
        )}
        <div className="segmented" role="tablist">
          {["all", "earned", "locked"].map((k) => (
            <button key={k} role="tab" aria-selected={show === k} onClick={() => setShow(k)}>
              {t(`badges.filter.${k}`)}
            </button>
          ))}
        </div>
      </header>

      <div className="progress" style={{ height: 8, marginBottom: 28 }}>
        <span style={{ width: `${(earned / badges.length) * 100}%`, background: "linear-gradient(90deg, #3355E6, #7C3AED)" }} />
      </div>

      {categories.map((cat) => {
        const list = badges
          .filter((b) => b.category === cat)
          .filter((b) => (show === "all" ? true : show === "earned" ? b.earnedAt : !b.earnedAt));
        if (!list.length) return null;
        const got = badges.filter((b) => b.category === cat && b.earnedAt).length;
        const total = badges.filter((b) => b.category === cat).length;
        return (
          <section key={cat} style={{ marginBottom: 32 }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <h2 className="title-3" style={{ flex: 1 }}>
                {cat}
              </h2>
              <span className="caption num">{t("badges.categoryProgress", { got: fmt.num(got), total: fmt.num(total) })}</span>
            </div>
            <div className="badge-grid">
              {list.map((b) => (
                <button key={b.id} id={b.id} className="badge-tile" data-locked={!b.earnedAt || undefined} onClick={() => setOpen(b)}>
                  <span className="badge-medal" style={{ background: b.color }}>
                    <Icon name={b.earnedAt ? b.icon : "lock"} size={24} />
                  </span>
                  <b>{b.name}</b>
                  <span className="caption">
                    {b.earnedAt
                      ? t("badges.earnedOn", { date: fmt.date(b.earnedAt) })
                      : t("badges.holdersCount", { count: b.holders.length })}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {open && (
        <>
          <div className="scrim" onClick={() => setOpen(null)} />
          <div
            className="sheet"
            style={{ width: "min(460px, calc(100vw - 32px))" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="badge-title"
          >
            <div className="sheet-body" style={{ textAlign: "center", paddingTop: 28 }}>
              <button
                className="icon-btn"
                style={{ position: "absolute", top: 12, right: 12 }}
                onClick={() => setOpen(null)}
                aria-label={t("common.close")}
              >
                <Icon name="x" size={18} />
              </button>
              <span
                className="badge-medal"
                style={{
                  width: 88,
                  height: 88,
                  margin: "0 auto",
                  background: open.color,
                  filter: open.earnedAt ? undefined : "grayscale(1)",
                  opacity: open.earnedAt ? 1 : 0.5,
                }}
              >
                <Icon name={open.icon} size={40} />
              </span>
              <h2 id="badge-title" className="title-2" style={{ marginTop: 16 }}>
                {open.name}
              </h2>
              <p className="secondary" style={{ marginTop: 4 }}>
                {open.description}
              </p>
              {open.criteria && (
                <div className="how-to-earn">
                  <span className="caption" style={{ fontWeight: 600 }}>
                    {t("badges.howToEarn")}
                  </span>
                  <p>{open.criteria}</p>
                </div>
              )}
              <div className="row" style={{ justifyContent: "center", marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                <span className="tag">{open.category}</span>
                <span className="tag tag-orange">{t("badges.pointsTag", { count: open.points, n: fmt.num(open.points) })}</span>
                {open.earnedAt ? (
                  <span className="tag tag-green">{t("badges.earnedOn", { date: fmt.date(open.earnedAt) })}</span>
                ) : (
                  <span className="tag">{t("badges.notEarned")}</span>
                )}
                {!open.active && <span className="tag tag-red">{t("badges.retired")}</span>}
              </div>
              <div style={{ textAlign: "left", marginTop: 24 }}>
                <div className="section-label" style={{ padding: "0 0 8px" }}>
                  {open.holders.length ? t("badges.heldBy", { count: open.holders.length }) : t("badges.noHolders")}
                </div>
                {open.holders.map((h) => (
                  <Link key={h.id} href={`/people/${h.id}`} className="rail-row">
                    <Avatar name={h.name} size={30} />
                    <span>
                      <b>{h.name}</b>
                      <span className="caption">{h.title}</span>
                    </span>
                  </Link>
                ))}
                {!open.earnedAt && (
                  <p className="caption" style={{ marginTop: 12 }}>
                    {t("badges.keepGoing")}
                  </p>
                )}
              </div>
              {open.active && <AwardTo badge={open} onDone={() => setOpen(null)} />}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
