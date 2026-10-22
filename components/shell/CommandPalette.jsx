"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { useApp } from "./AppContext";
import { useI18n } from "@/components/I18nProvider";

export function CommandPalette() {
  const { palette, closePalette, data, can, openRecognize } = useApp();
  const router = useRouter();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (palette) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [palette]);

  const commands = useMemo(() => {
    const go = (href) => () => {
      closePalette();
      router.push(href);
    };
    const pages = [
      [t("nav.home"), "/home", "home"],
      [t("nav.notifications"), "/notifications", "bell"],
      [t("nav.people"), "/people", "people"],
      [t("nav.badges"), "/badges", "award"],
      [t("nav.rewards"), "/rewards", "gift"],
      [t("nav.leaderboard"), "/leaderboard", "trophy"],
      [t("nav.wall"), "/wall", "image"],
      [t("nav.team"), "/team", "users", "team.view"],
      [t("palette.adminOverview"), "/admin", "chart", "analytics.view"],
      [t("nav.adminUsers"), "/admin/users", "personPlus", "users.manage"],
      [t("nav.adminRoles"), "/admin/roles", "key", "roles.manage"],
      [t("nav.adminLevels"), "/admin/levels", "stairs", "levels.manage"],
      [t("nav.adminBadges"), "/admin/badges", "award", "badges.manage"],
      [t("nav.adminRewards"), "/admin/rewards", "gift", "rewards.manage"],
      [t("nav.adminModeration"), "/admin/moderation", "flag", "moderation.manage"],
      [t("nav.adminPoints"), "/admin/points", "sparkles", "points.manage"],
      [t("nav.adminSettings"), "/admin/settings", "building", "settings.manage"],
      [t("nav.adminAudit"), "/admin/audit", "list", "audit.view"],
      [t("nav.settings"), "/settings", "gear"],
    ];
    const list = [];
    if (can("recognition.give")) {
      list.push({
        id: "recognize",
        group: t("palette.group.actions"),
        label: t("nav.recognizeSomeone"),
        hint: "⌘J",
        icon: "sparkles",
        run: () => (closePalette(), openRecognize()),
      });
    }
    for (const [label, href, icon, perm] of pages) {
      if (!perm || can(perm)) list.push({ id: href, group: t("palette.group.goTo"), label, icon, run: go(href) });
    }
    for (const p of data.people) {
      list.push({
        id: p.id,
        group: "people",
        label: p.name,
        hint: [p.title, p.department].filter(Boolean).join(" · "),
        person: p.name,
        run: go(`/people/${p.id}`),
      });
      if (can("recognition.give") && p.id !== data.me.id) {
        list.push({
          id: `rec-${p.id}`,
          group: "recognize",
          label: t("palette.recognizePerson", { name: p.name }),
          icon: "sparkles",
          run: () => (closePalette(), openRecognize([p.id])),
        });
      }
    }
    return list;
  }, [data, can, closePalette, openRecognize, router, t]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands.filter((c) => c.group !== "people" && c.group !== "recognize").slice(0, 12);
    return commands
      .filter((c) => c.label.toLowerCase().includes(s) || c.hint?.toLowerCase().includes(s))
      .sort((a, b) => Number(b.label.toLowerCase().startsWith(s)) - Number(a.label.toLowerCase().startsWith(s)))
      .slice(0, 14);
  }, [q, commands]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!palette) return null;

  const groupLabel = (g) => (g === "people" ? t("palette.group.people") : g === "recognize" ? t("palette.group.recognize") : g);
  let lastGroup = "";
  return (
    <>
      <div className="scrim" onClick={closePalette} />
      <div className="palette" role="dialog" aria-modal="true" aria-label={t("palette.label")}>
        <div className="palette-input">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("palette.placeholder")}
            aria-label={t("palette.label")}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              if (e.key === "Enter") results[active]?.run();
              if (e.key === "Escape") closePalette();
            }}
          />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef} role="listbox">
          {results.length === 0 && <div className="palette-empty">{t("palette.empty", { query: q })}</div>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? groupLabel(c.group) : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {header && <div className="palette-group">{header}</div>}
                <button
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  className="menu-item palette-item"
                  data-active={i === active || undefined}
                  onMouseEnter={() => setActive(i)}
                  onClick={c.run}
                >
                  {c.person ? <Avatar name={c.person} size={24} /> : <Icon name={c.icon ?? "chevronRight"} size={18} />}
                  <span style={{ flex: 1 }}>{c.label}</span>
                  {c.hint && <span className="caption">{c.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
