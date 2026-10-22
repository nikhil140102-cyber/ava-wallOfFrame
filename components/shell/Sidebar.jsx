"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "../ThemeToggle";
import { Icon } from "../Icon";
import { Avatar, LevelPill } from "../Avatar";
import { useApp } from "./AppContext";
import { logout } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";

export function Sidebar({ open, onClose }) {
  const { data, can, openRecognize, openPalette } = useApp();
  const { t, fmt } = useI18n();
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
    { href: "/home", label: t("nav.home"), icon: "home" },
    { href: "/notifications", label: t("nav.notifications"), icon: "bell", count: data.unread },
    { href: "/people", label: t("nav.people"), icon: "people" },
    { href: "/badges", label: t("nav.badges"), icon: "award" },
    { href: "/rewards", label: t("nav.rewards"), icon: "gift" },
    { href: "/leaderboard", label: t("nav.leaderboard"), icon: "trophy" },
    { href: "/wall", label: t("nav.wall"), icon: "image" },
  ];
  const team = [{ href: "/team", label: t("nav.team"), icon: "users", perm: "team.view" }];
  const admin = [
    { href: "/admin", label: t("nav.adminOverview"), icon: "chart", perm: "analytics.view" },
    { href: "/admin/users", label: t("nav.adminUsers"), icon: "personPlus", perm: "users.manage" },
    { href: "/admin/roles", label: t("nav.adminRoles"), icon: "key", perm: "roles.manage" },
    { href: "/admin/levels", label: t("nav.adminLevels"), icon: "stairs", perm: "levels.manage" },
    { href: "/admin/badges", label: t("nav.adminBadges"), icon: "award", perm: "badges.manage" },
    { href: "/admin/rewards", label: t("nav.adminRewards"), icon: "gift", perm: "rewards.manage", count: data.pendingRedemptions },
    { href: "/admin/moderation", label: t("nav.adminModeration"), icon: "flag", perm: "moderation.manage", count: data.openReports },
    { href: "/admin/points", label: t("nav.adminPoints"), icon: "sparkles", perm: "points.manage" },
    { href: "/admin/settings", label: t("nav.adminSettings"), icon: "building", perm: "settings.manage" },
    { href: "/admin/audit", label: t("nav.adminAudit"), icon: "list", perm: "audit.view" },
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
      <aside className="sidebar" data-open={open || undefined} aria-label={t("nav.sidebar")}>
        <div className="sidebar-brand">
          <span className="brand-mark">W</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>Wall of Frames</b>
            <span>{data.companyName}</span>
          </div>
          <ThemeToggle />
        </div>

        <button className="sidebar-search" onClick={openPalette}>
          <Icon name="search" size={15} />
          <span>{t("nav.search")}</span>
          <kbd>⌘K</kbd>
        </button>

        {can("recognition.give") && (
          <button className="btn btn-filled sidebar-cta" onClick={() => openRecognize()}>
            <Icon name="sparkles" size={16} /> {t("nav.recognizeSomeone")}
          </button>
        )}

        <nav className="nav" aria-label={t("nav.mainNavigation")}>
          {main.map(renderItem)}
          {can("team.view") && (
            <>
              <div className="nav-label">{t("nav.section.manage")}</div>
              {team.map(renderItem)}
            </>
          )}
          {admin.length > 0 && (
            <>
              <div className="nav-label">{t("nav.section.admin")}</div>
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
                <LevelPill name={data.level.name} color={data.level.color} size="sm" />{" "}
                <span className="num">{t("nav.points", { points: fmt.num(data.balance) })}</span>
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
                      {t("nav.pointsToNext", { points: fmt.num(data.level.toNext), level: data.level.nextName })}
                    </span>
                  </div>
                )}
              </div>
              <div className="menu-sep" />
              <Link className="menu-item" href={`/people/${data.me.id}`} role="menuitem">
                <Icon name="person" size={16} /> {t("nav.myProfile")}
              </Link>
              <Link className="menu-item" href="/settings" role="menuitem">
                <Icon name="gear" size={16} /> {t("nav.settings")}
              </Link>
              <div className="menu-sep" />
              <form action={logout}>
                <button className="menu-item" role="menuitem">
                  <Icon name="logout" size={16} /> {t("nav.signOut")}
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
