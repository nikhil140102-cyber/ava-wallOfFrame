"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { cancelRedemption, redeemReward } from "@/app/actions";
import { num, timeAgo } from "@/lib/format";
import { PageHelp } from "@/components/PageHelp";

const TINT = {
  "Time off": "var(--accent)",
  Learning: "var(--green)",
  Experiences: "var(--orange)",
  Vouchers: "var(--pink)",
  "Give back": "var(--red)",
};

export function RewardStore({ balance, lifetime, canRedeem, rewards, history }) {
  const { toast } = useApp();
  const [cat, setCat] = useState("All");
  const [confirm, setConfirm] = useState(null);
  const [pending, setPending] = useState(false);
  const cats = ["All", ...new Set(rewards.map((r) => r.category))];
  const list = rewards.filter((r) => cat === "All" || r.category === cat);
  const held = history.filter((h) => h.status === "pending").reduce((n, h) => n + h.cost, 0);

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1 className="large-title">Rewards</h1>
          <p>Spend the points your teammates give you.</p>
        </div>
        <PageHelp topic="rewards" />
      </header>

      <section className="balance-hero">
        <div>
          <span className="caption">Available to spend</span>
          <div className="balance-amount num">
            {num(balance)}
            <small>points</small>
          </div>
          {held > 0 && <span className="caption">{num(held)} held for pending requests</span>}
        </div>
        <div className="balance-side">
          <div>
            <b className="num">{num(lifetime)}</b>
            <span className="caption">lifetime earned</span>
          </div>
          <div>
            <b className="num">{history.filter((h) => h.status === "approved").length}</b>
            <span className="caption">rewards redeemed</span>
          </div>
        </div>
      </section>

      <div className="toolbar" style={{ marginTop: 24 }}>
        {cats.map((c) => (
          <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="reward-grid">
        {list.map((r) => {
          const short = r.cost - balance;
          const color = TINT[r.category] ?? "var(--accent)";
          return (
            <article key={r.id} className="card reward-card">
              <div className="reward-art" style={{ color, background: `color-mix(in srgb, ${color} 10%, var(--bg-elevated))` }}>
                <Icon name={r.icon} size={40} stroke={1.5} />
              </div>
              <div className="reward-info">
                <span className="caption">{r.category}</span>
                <h3 className="headline">{r.name}</h3>
                <p className="caption" style={{ minHeight: 34 }}>
                  {r.description}
                </p>
                <div className="row" style={{ marginTop: 10 }}>
                  <span className="num" style={{ fontWeight: 700, flex: 1 }}>
                    {num(r.cost)} <span className="caption">pts</span>
                  </span>
                  {short <= 0 ? (
                    <button className="btn btn-tinted btn-sm" disabled={!canRedeem} onClick={() => setConfirm(r)}>
                      Redeem
                    </button>
                  ) : (
                    <span className="caption num">{num(short)} more</span>
                  )}
                </div>
                {short > 0 && (
                  <div className="progress" style={{ marginTop: 8, height: 4 }}>
                    <span style={{ width: `${Math.max(4, (balance / r.cost) * 100)}%`, background: color }} />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section style={{ marginTop: 36 }}>
        <div className="section-label">Your requests</div>
        {history.length === 0 ? (
          <div className="group">
            <div className="group-item caption">No requests yet.</div>
          </div>
        ) : (
          <div className="group">
            {history.map((h) => (
              <div key={h.id} className="group-item indent">
                <span
                  className="avatar"
                  style={{ width: 32, height: 32, background: "var(--fill)", color: "var(--label-2)", backgroundImage: "none" }}
                >
                  <Icon name={h.icon} size={16} />
                </span>
                <span style={{ flex: 1 }}>
                  <b style={{ fontSize: 14 }}>{h.name}</b>
                  <span className="caption" style={{ display: "block" }}>
                    {num(h.cost)} pts · {timeAgo(h.createdAt)}
                    {h.note ? ` · “${h.note}”` : ""}
                  </span>
                </span>
                <span className={`tag ${h.status === "approved" ? "tag-green" : h.status === "rejected" ? "tag-red" : "tag-orange"}`}>
                  {h.status === "pending" ? "Waiting for HR or Super Admin" : h.status === "approved" ? "Approved" : "Declined · refunded"}
                </span>
                {h.status === "pending" && (
                  <button
                    className="btn btn-plain btn-sm btn-destructive"
                    onClick={async () => {
                      const r = await cancelRedemption(h.id);
                      toast(r.ok ? `Request cancelled — ${num(h.cost)} points returned` : r.error, { tone: r.ok ? "default" : "error" });
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {confirm && (
        <>
          <div className="scrim" onClick={() => setConfirm(null)} />
          <div
            className="sheet"
            style={{ width: "min(400px, calc(100vw - 32px))" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="redeem-title"
          >
            <div className="sheet-body" style={{ textAlign: "center", paddingTop: 28 }}>
              <span className="badge-medal" style={{ margin: "0 auto", background: TINT[confirm.category] ?? "var(--accent)" }}>
                <Icon name={confirm.icon} size={26} />
              </span>
              <h2 id="redeem-title" className="title-3" style={{ marginTop: 14 }}>
                Redeem {confirm.name}?
              </h2>
              <p className="subhead" style={{ marginTop: 6 }}>
                {num(confirm.cost)} points will be held until HR or the Super Admin approves. You can cancel any time before then.
                You&apos;ll have {num(balance - confirm.cost)} left.
              </p>
            </div>
            <div className="sheet-foot">
              <button className="btn btn-gray" style={{ flex: 1 }} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-filled"
                style={{ flex: 1 }}
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  const r = await redeemReward(confirm.id);
                  setPending(false);
                  setConfirm(null);
                  toast(r.ok ? (r.message ?? "Requested") : r.error, { tone: r.ok ? "default" : "error" });
                }}
              >
                Redeem
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
