"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { useApp } from "./AppContext";

export function CommandPalette() {
  const { palette, closePalette, data, can, openRecognize } = useApp();
  const router = useRouter();
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
      ["Home", "/home", "home"],
      ["Notifications", "/notifications", "bell"],
      ["People", "/people", "people"],
      ["Badges", "/badges", "award"],
      ["Rewards", "/rewards", "gift"],
      ["Leaderboard", "/leaderboard", "trophy"],
      ["My Team", "/team", "users", "team.view"],
      ["Admin Overview", "/admin", "chart", "analytics.view"],
      ["Users", "/admin/users", "personPlus", "users.manage"],
      ["Roles & Permissions", "/admin/roles", "key", "roles.manage"],
      ["Levels", "/admin/levels", "stairs", "levels.manage"],
      ["Badge Studio", "/admin/badges", "award", "badges.manage"],
      ["Reward Approvals", "/admin/rewards", "gift", "rewards.manage"],
      ["Moderation", "/admin/moderation", "flag", "moderation.manage"],
      ["Points Rules", "/admin/points", "sparkles", "points.manage"],
      ["Company Settings", "/admin/settings", "building", "settings.manage"],
      ["Audit Log", "/admin/audit", "list", "audit.view"],
      ["Settings", "/settings", "gear"],
    ];
    const list = [];
    if (can("recognition.give")) {
      list.push({
        id: "recognize",
        group: "Actions",
        label: "Recognize someone",
        hint: "⌘J",
        icon: "sparkles",
        run: () => (closePalette(), openRecognize()),
      });
    }
    for (const [label, href, icon, perm] of pages) {
      if (!perm || can(perm)) list.push({ id: href, group: "Go to", label, icon, run: go(href) });
    }
    for (const p of data.people) {
      list.push({
        id: p.id,
        group: "People",
        label: p.name,
        hint: [p.title, p.department].filter(Boolean).join(" · "),
        person: p.name,
        run: go(`/people/${p.id}`),
      });
      if (can("recognition.give") && p.id !== data.me.id) {
        list.push({
          id: `rec-${p.id}`,
          group: "Recognize",
          label: `Recognize ${p.name}`,
          icon: "sparkles",
          run: () => (closePalette(), openRecognize([p.id])),
        });
      }
    }
    return list;
  }, [data, can, closePalette, openRecognize, router]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return commands.filter((c) => c.group !== "People" && c.group !== "Recognize").slice(0, 12);
    return commands
      .filter((c) => c.label.toLowerCase().includes(t) || c.hint?.toLowerCase().includes(t))
      .sort((a, b) => Number(b.label.toLowerCase().startsWith(t)) - Number(a.label.toLowerCase().startsWith(t)))
      .slice(0, 14);
  }, [q, commands]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!palette) return null;

  let lastGroup = "";
  return (
    <>
      <div className="scrim" onClick={closePalette} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-input">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, pages and actions"
            aria-label="Search"
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
          {results.length === 0 && <div className="palette-empty">No results for “{q}”</div>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
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
