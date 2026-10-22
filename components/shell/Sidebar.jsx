"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Avatar, LevelPill } from "../Avatar";
import { useApp } from "./AppContext";
import { logout } from "@/app/actions";
import { num } from "@/lib/format";

export function Sidebar({ open, onClose }) {
  const { data, can, openRecognize, openPalette } = useApp();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  useEffect(onClose, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const main = [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/notifications", label: "Notifications", icon: "bell", count: data.unread },
    { href: "/people", label: "People", icon: "people" },
    { href: "/badges", label: "Badges", icon: "award" },
    { href: "/rewards", label: "Rewards", icon: "gift" },
    { href: "/leaderboard", label: "Leaderboard", icon: "trophy" },
    { href: "/wall", label: "Memory Wall", icon: "image" },
  ];
  const team = [{ href: "/team", label: "My Team", icon: "users", perm: "team.view" }];
  const admin = [
    { href: "/admin", label: "Overview", icon: "chart", perm: "analytics.view" },
    { href: "/admin/users", label: "Users", icon: "personPlus", perm: "users.manage" },
    { href: "/admin/roles", label: "Roles & Permissions", icon: "key", perm: "roles.manage" },
    { href: "/admin/levels", label: "Levels", icon: "stairs", perm: "levels.manage" },
    { href: "/admin/badges", label: "Badge Studio", icon: "award", perm: "badges.manage" },
    { href: "/admin/rewards", label: "Reward Approvals", icon: "gift", perm: "rewards.manage", count: data.pendingRedemptions },
    { href: "/admin/moderation", label: "Moderation", icon: "flag", perm: "moderation.manage", count: data.openReports },
    { href: "/admin/points", label: "Points Rules", icon: "sparkles", perm: "points.manage" },
    { href: "/admin/settings", label: "Company Settings", icon: "building", perm: "settings.manage" },
    { href: "/admin/audit", label: "Audit Log", icon: "list", perm: "audit.view" },
  ].filter((i) => can(i.perm));

  const isActive = (href) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));

  const renderItem = (i) => (
    <Link key={i.href} href={i.href} className="nav-item" aria-current={isActive(i.href) ? "page" : undefined}>
      <Icon name={i.icon} size={18} />
      <span>{i.label}</span>
      {!!i.count && <span className="count-badge">{i.count > 99 ? "99+" : i.count}</span>}
    </Link>
  );

  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} />}
      <aside className="sidebar" data-open={open || undefined} aria-label="Sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">W</span>
          <div>
            <b>Wall of Frames</b>
            <span>{data.companyName}</span>
          </div>
        </div>

        <button className="sidebar-search" onClick={openPalette}>
          <Icon name="search" size={15} />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </button>

        {can("recognition.give") && (
          <button className="btn btn-filled sidebar-cta" onClick={() => openRecognize()}>
            <Icon name="sparkles" size={16} /> Recognize someone
          </button>
        )}

        <nav className="nav" aria-label="Main navigation">
          {main.map(renderItem)}
          {can("team.view") && (
            <>
              <div className="nav-label">Manage</div>
              {team.map(renderItem)}
            </>
          )}
          {admin.length > 0 && (
            <>
              <div className="nav-label">Admin</div>
              {admin.map(renderItem)}
            </>
          )}
        </nav>

        <div className="sidebar-me" ref={menuRef}>
          <button className="me-btn" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu">
            <Avatar name={data.me.name} size={34} ring={data.level.color} />
            <span className="me-text">
              <b>{data.me.name}</b>
              <span>
                <LevelPill name={data.level.name} color={data.level.color} size="sm" /> <span className="num">{num(data.balance)} pts</span>
              </span>
            </span>
            <Icon name="chevronDown" size={14} style={{ color: "var(--label-3)" }} />
          </button>
          {menu && (
            <div className="popover me-menu" role="menu">
              <div className="me-menu-head">
                <b>{data.me.name}</b>
                <span className="caption">
                  {data.me.title} · <span style={{ color: data.me.roleColor, fontWeight: 600 }}>{data.me.roleName}</span>
                </span>
                {data.level.nextName && (
                  <div style={{ marginTop: 10 }}>
                    <div className="progress">
                      <span style={{ width: `${data.level.progress * 100}%`, background: data.level.color }} />
                    </div>
                    <span className="caption">
                      {num(data.level.toNext)} points to {data.level.nextName}
                    </span>
                  </div>
                )}
              </div>
              <div className="menu-sep" />
              <Link className="menu-item" href={`/people/${data.me.id}`} role="menuitem">
                <Icon name="person" size={16} /> My Profile
              </Link>
              <Link className="menu-item" href="/settings" role="menuitem">
                <Icon name="gear" size={16} /> Settings
              </Link>
              <div className="menu-sep" />
              <form action={logout}>
                <button className="menu-item" role="menuitem">
                  <Icon name="logout" size={16} /> Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
