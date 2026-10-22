"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { markNotificationsRead } from "@/app/actions";
import { timeAgo } from "@/lib/format";
import { PageHelp } from "@/components/PageHelp";

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
  const [filter, setFilter] = useState("all");
  const [, start] = useTransition();
  const [list, markRead] = useOptimistic(items, (state, ids) =>
    state.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n))
  );
  const unread = list.filter((n) => !n.read).length;
  const shown = list.filter((n) => filter === "all" || !n.read);
  const today = new Date().setHours(0, 0, 0, 0);
  const groups = [
    { label: "Today", items: shown.filter((n) => n.createdAt >= today) },
    { label: "Earlier", items: shown.filter((n) => n.createdAt < today) },
  ].filter((g) => g.items.length);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="large-title">Notifications</h1>
          <p>{unread ? `${unread} unread` : "You're all caught up."}</p>
        </div>
        <PageHelp topic="notifications" />
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
            All
          </button>
          <button role="tab" aria-selected={filter === "unread"} onClick={() => setFilter("unread")}>
            Unread
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
          Mark All as Read
        </button>
      </header>

      {groups.length === 0 && (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="inbox" size={26} />
          </span>
          <h3>{filter === "unread" ? "No unread notifications" : "No notifications yet"}</h3>
          <p>Appreciations, comments, badges and reward updates will show up here.</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.label} className="group-block">
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
                    <span className="caption">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="dot" style={{ background: "var(--accent)", marginTop: 6 }} aria-label="Unread" />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
