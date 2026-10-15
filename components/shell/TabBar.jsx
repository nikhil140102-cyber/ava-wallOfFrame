"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../Icon";
import { useApp } from "./AppContext";

/** iPhone-style tab bar for small screens: the five things people do most, one thumb away. */
export function TabBar({ onMore }) {
  const path = usePathname();
  const { data, can, openRecognize } = useApp();
  const tabs = [
    ["/home", "Home", "home"],
    ["/people", "People", "people"],
  ];
  const right = [["/rewards", "Rewards", "gift"]];
  const item = ([href, label, icon]) => (
    <Link key={href} href={href} className="tab" aria-current={path.startsWith(href) ? "page" : undefined}>
      <Icon name={icon} size={23} />
      <span>{label}</span>
    </Link>
  );
  return (
    <nav className="tabbar" aria-label="Quick navigation">
      {tabs.map(item)}
      {can("recognition.give") ? (
        <button className="tab tab-main" onClick={() => openRecognize()} aria-label="Recognize someone">
          <span>
            <Icon name="plus" size={24} stroke={2.4} />
          </span>
        </button>
      ) : (
        item(["/badges", "Badges", "award"])
      )}
      {right.map(item)}
      <button className="tab" onClick={onMore} aria-label="More">
        <span style={{ position: "relative", display: "flex" }}>
          <Icon name="list" size={23} />
          {data.unread > 0 && <i className="tab-dot" />}
        </span>
        <span>More</span>
      </button>
    </nav>
  );
}
