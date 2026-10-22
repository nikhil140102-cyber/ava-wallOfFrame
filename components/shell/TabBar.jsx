"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../Icon";
import { useApp } from "./AppContext";
import { useI18n } from "@/components/I18nProvider";

/** iPhone-style tab bar for small screens: the five things people do most, one thumb away. */
export function TabBar({ onMore }) {
  const path = usePathname();
  const { data, can, openRecognize } = useApp();
  const { t } = useI18n();
  const tabs = [
    ["/home", t("nav.home"), "home"],
    ["/people", t("nav.people"), "people"],
  ];
  const right = [["/rewards", t("nav.rewards"), "gift"]];
  const item = ([href, label, icon]) => (
    <Link key={href} href={href} className="tab" aria-current={path.startsWith(href) ? "page" : undefined}>
      <Icon name={icon} size={23} />
      <span>{label}</span>
    </Link>
  );
  return (
    <nav className="tabbar" aria-label={t("nav.quickNavigation")}>
      {tabs.map(item)}
      {can("recognition.give") ? (
        <button className="tab tab-main" onClick={() => openRecognize()} aria-label={t("nav.recognizeSomeone")}>
          <span>
            <Icon name="plus" size={24} stroke={2.4} />
          </span>
        </button>
      ) : (
        item(["/badges", t("nav.badges"), "award"])
      )}
      {right.map(item)}
      <button className="tab" onClick={onMore} aria-label={t("nav.more")}>
        <span style={{ position: "relative", display: "flex" }}>
          <Icon name="list" size={23} />
          {data.unread > 0 && <i className="tab-dot" />}
        </span>
        <span>{t("nav.more")}</span>
      </button>
    </nav>
  );
}
