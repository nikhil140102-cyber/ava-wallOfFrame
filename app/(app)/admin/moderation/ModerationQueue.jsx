"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { PostCard } from "@/components/PostCard";
import { useApp } from "@/components/shell/AppContext";
import { resolveReport, restorePost } from "@/app/actions";
import { timeAgo } from "@/lib/format";
import { PageHelp } from "@/components/PageHelp";

export function ModerationQueue({ items, hidden }) {
  const { toast } = useApp();
  const [tab, setTab] = useState("open");

  return (
    <main className="page page-narrow" style={{ maxWidth: 820 }}>
      <header className="page-head">
        <div>
          <h1 className="large-title">Moderation</h1>
          <p>Reported posts. Reporters stay anonymous to the author.</p>
        </div>
        <PageHelp topic="admin-moderation" />
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={tab === "open"} onClick={() => setTab("open")}>
            Needs Review {items.length > 0 && `(${items.length})`}
          </button>
          <button role="tab" aria-selected={tab === "hidden"} onClick={() => setTab("hidden")}>
            Hidden ({hidden.length})
          </button>
        </div>
      </header>

      {tab === "open" &&
        (items.length === 0 ? (
          <div className="card empty">
            <span className="empty-icon">
              <Icon name="shield" size={26} />
            </span>
            <h3>Nothing to review</h3>
            <p>When someone reports a post, it shows up here and you get a notification.</p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 28 }}>
            {items.map(({ post, reports }) => (
              <section key={post.id}>
                <div className="report-box">
                  <Icon name="flag" size={16} />
                  <div style={{ flex: 1 }}>
                    <b>
                      Reported {reports.length} {reports.length === 1 ? "time" : "times"}
                    </b>
                    {reports.map((r) => (
                      <div key={r.id} className="caption">
                        “{r.reason}” — {r.reporter}, {timeAgo(r.at)}
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      const res = await resolveReport(reports[0].id, "dismiss");
                      toast(res.ok ? "Report dismissed — the post stays up" : res.error, { tone: res.ok ? "default" : "error" });
                    }}
                  >
                    Keep Post
                  </button>
                  <button
                    className="btn btn-sm btn-filled btn-destructive"
                    onClick={async () => {
                      const res = await resolveReport(reports[0].id, "hide");
                      toast(res.ok ? "Post hidden from the feed" : res.error, {
                        tone: res.ok ? "default" : "error",
                        action: res.ok ? { label: "Undo", onClick: async () => void (await restorePost(post.id)) } : undefined,
                      });
                    }}
                  >
                    Hide Post
                  </button>
                </div>
                <PostCard post={post} />
              </section>
            ))}
          </div>
        ))}

      {tab === "hidden" &&
        (hidden.length === 0 ? (
          <div className="card empty">
            <span className="empty-icon">
              <Icon name="eye" size={26} />
            </span>
            <h3>No hidden posts</h3>
          </div>
        ) : (
          <div className="stack">
            {hidden.map((p) => (
              <section key={p.id}>
                <div className="row" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
                  <button
                    className="btn btn-sm btn-tinted"
                    onClick={async () => {
                      const r = await restorePost(p.id);
                      toast(r.ok ? "Post restored to the feed" : r.error, { tone: r.ok ? "default" : "error" });
                    }}
                  >
                    <Icon name="eye" size={14} /> Restore
                  </button>
                </div>
                <PostCard post={p} />
              </section>
            ))}
          </div>
        ))}
    </main>
  );
}
