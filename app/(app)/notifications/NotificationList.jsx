"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { markNotificationsRead } from "@/app/actions";
import { PageHelp } from "@/components/PageHelp";
import { useI18n } from "@/components/I18nProvider";

const KIND = {
  appreciation: { icon: "sparkles", color: "var(--accent)" },
  comment: { icon: "chat", color: "var(--teal)" },
  badge: { icon: "award", color: "var(--purple)" },
  reward: { icon: "gift", color: "var(--orange)" },
  nudge: { icon: "hand", color: "var(--pink)" },
  points: { icon: "sparkles", color: "var(--orange)" },
  memory: { icon: "image", color: "var(--pink)" },
  reaction: { icon: "heart", color: "var(--red)" },
  system: { icon: "bell", color: "var(--label-3)" },
};

export function NotificationList({ items }) {
  const router = useRouter();
  const { t, fmt } = useI18n();
  const [filter, setFilter] = useState("all");
  const [, start] = useTransition();
  const [list, markRead] = useOptimistic(items, (state, ids) =>
    state.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n))
  );
  const unread = list.filter((n) => !n.read).length;
  const shown = list.filter((n) => filter === "all" || !n.read);
  const today = new Date().setHours(0, 0, 0, 0);
  const groups = [
    { key: "today", label: t("notifications.today"), items: shown.filter((n) => n.createdAt >= today) },
    { key: "earlier", label: t("notifications.earlier"), items: shown.filter((n) => n.createdAt < today) },
  ].filter((g) => g.items.length);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="large-title">{t("notifications.title")}</h1>
          <p>{unread ? t("notifications.unreadCount", { count: unread, n: fmt.num(unread) }) : t("notifications.caughtUp")}</p>
        </div>
        <PageHelp topic="notifications" />
        <div className="segmented" role="tablist" aria-label={t("notifications.filter.label")}>
          <button role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
            {t("notifications.filter.all")}
          </button>
          <button role="tab" aria-selected={filter === "unread"} onClick={() => setFilter("unread")}>
            {t("notifications.filter.unread")}
          </button>
        </div>
        <button
          className="btn btn-tinted"
          disabled={!unread}
          onClick={() =>
            start(async () => {
              markRead("all");
              await markNotificationsRead();
            })
          }
        >
          {t("notifications.markAllRead")}
        </button>
      </header>

      {groups.length === 0 && (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="inbox" size={26} />
          </span>
          <h3>{filter === "unread" ? t("notifications.empty.unread") : t("notifications.empty.all")}</h3>
          <p>{t("notifications.empty.body")}</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="group-block">
          <div className="section-label">{g.label}</div>
          <div className="group">
            {g.items.map((n) => {
              const k = KIND[n.kind] ?? KIND.system;
              return (
                <button
                  key={n.id}
                  className="group-item indent"
                  style={{ alignItems: "flex-start", paddingTop: 12, paddingBottom: 12 }}
                  onClick={() =>
                    start(async () => {
                      if (!n.read) {
                        markRead([n.id]);
                        await markNotificationsRead([n.id]);
                      }
                      router.push(n.link);
                    })
                  }
                >
                  <span style={{ position: "relative" }}>
                    {n.actor ? (
                      <Avatar name={n.actor} size={36} />
                    ) : (
                      <span
                        className="avatar"
                        style={{ width: 36, height: 36, background: "var(--fill)", color: k.color, backgroundImage: "none" }}
                      >
                        <Icon name={k.icon} size={18} />
                      </span>
                    )}
                    {n.actor && (
                      <span
                        style={{
                          position: "absolute",
                          right: -4,
                          bottom: -4,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "var(--bg-elevated)",
                          color: k.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "var(--shadow-1)",
                        }}
                      >
                        <Icon name={k.icon} size={12} stroke={2.4} />
                      </span>
                    )}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: n.read ? 400 : 600, lineHeight: 1.4 }}>{n.title}</span>
                    <span className="caption">{fmt.timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && (
                    <span className="dot" style={{ background: "var(--accent)", marginTop: 6 }} aria-label={t("notifications.unread")} />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
