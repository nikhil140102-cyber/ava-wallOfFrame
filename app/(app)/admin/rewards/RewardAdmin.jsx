"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { decideRedemption, saveReward } from "@/app/actions";
import { num, timeAgo } from "@/lib/format";
import { PageHelp } from "@/components/PageHelp";

const ICONS = ["gift", "coffee", "book", "sun", "calendar", "users", "heart", "rocket", "star", "trophy"];

export function RewardAdmin({ requests, rewards }) {
  const { toast } = useApp();
  const [tab, setTab] = useState("pending");
  const [declining, setDeclining] = useState(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(null);
  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending");

  async function decide(r, approve, n) {
    const res = await decideRedemption(r.id, approve, n);
    toast(
      res.ok ? (approve ? `Approved ${r.reward} for ${r.user.split(" ")[0]}` : `Declined — ${num(r.cost)} points refunded`) : res.error,
      { tone: res.ok ? "default" : "error" }
    );
  }

  return (
    <main className="page" style={{ maxWidth: 960 }}>
      <header className="page-head">
        <div>
          <h1 className="large-title">Reward Approvals</h1>
          <p>{pending.length ? `${pending.length} waiting for a decision` : "Nothing waiting — nice."}</p>
        </div>
        <PageHelp topic="admin-rewards" />
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={tab === "pending"} onClick={() => setTab("pending")}>
            Pending {pending.length > 0 && `(${pending.length})`}
          </button>
          <button role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>
            History
          </button>
          <button role="tab" aria-selected={tab === "catalogue"} onClick={() => setTab("catalogue")}>
            Catalogue
          </button>
        </div>
      </header>

      {tab === "pending" &&
        (pending.length === 0 ? (
          <div className="card empty">
            <span className="empty-icon">
              <Icon name="check" size={26} />
            </span>
            <h3>All caught up</h3>
            <p>New reward requests will appear here, and you&apos;ll get a notification.</p>
          </div>
        ) : (
          <div className="stack">
            {pending.map((r) => (
              <div key={r.id} className="card card-pad row" style={{ gap: 14 }}>
                <Link href={`/people/${r.userId}`}>
                  <Avatar name={r.user} size={44} />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{r.user}</b> <span className="secondary">requested</span> <b>{r.reward}</b>
                  <div className="caption">
                    {num(r.cost)} points · {timeAgo(r.createdAt)} · points are already held
                  </div>
                </div>
                <button className="btn btn-destructive" onClick={() => (setDeclining(r), setNote(""))}>
                  Decline
                </button>
                <button className="btn btn-filled" onClick={() => decide(r, true)}>
                  <Icon name="check" size={15} stroke={2.4} /> Approve
                </button>
              </div>
            ))}
          </div>
        ))}

      {tab === "history" && (
        <div className="group">
          {history.length === 0 && <div className="group-item caption">No decisions yet.</div>}
          {history.map((r) => (
            <div key={r.id} className="group-item indent">
              <Avatar name={r.user} size={32} />
              <span style={{ flex: 1 }}>
                <b style={{ fontSize: 14 }}>{r.user}</b> · {r.reward}
                <span className="caption" style={{ display: "block" }}>
                  {num(r.cost)} pts · {r.decidedBy ? `by ${r.decidedBy}` : ""} {r.decidedAt ? timeAgo(r.decidedAt) : ""}
                  {r.note ? ` · “${r.note}”` : ""}
                </span>
              </span>
              <span className={`tag ${r.status === "approved" ? "tag-green" : "tag-red"}`}>
                {r.status === "approved" ? "Approved" : "Declined"}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "catalogue" && (
        <>
          <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
            <button
              className="btn btn-tinted"
              onClick={() => setEditing({ name: "", description: "", category: "Experiences", icon: "gift", cost: 500, active: true })}
            >
              <Icon name="plus" size={15} /> Add Reward
            </button>
          </div>
          <div className="group">
            {rewards.map((r) => (
              <div key={r.id} className="group-item indent" style={{ opacity: r.active ? 1 : 0.55 }}>
                <span
                  className="avatar"
                  style={{ width: 32, height: 32, background: "var(--fill)", color: "var(--accent)", backgroundImage: "none" }}
                >
                  <Icon name={r.icon} size={16} />
                </span>
                <span style={{ flex: 1 }}>
                  <b style={{ fontSize: 14 }}>{r.name}</b>
                  <span className="caption" style={{ display: "block" }}>
                    {r.category} · {num(r.cost)} pts
                  </span>
                </span>
                <button className="btn btn-plain btn-sm" onClick={() => setEditing(r)}>
                  Edit
                </button>
                <button
                  className="switch switch-sm"
                  role="switch"
                  aria-checked={r.active}
                  aria-label={`${r.name} available`}
                  onClick={async () => {
                    const res = await saveReward({ ...r, active: !r.active });
                    toast(res.ok ? (r.active ? `${r.name} hidden from the store` : `${r.name} is back in the store`) : res.error, {
                      tone: res.ok ? "default" : "error",
                    });
                  }}
                />
              </div>
            ))}
          </div>
          <p className="group-footer">Switch a reward off to hide it from the store without deleting its history.</p>
        </>
      )}

      {declining && (
        <>
          <div className="scrim" onClick={() => setDeclining(null)} />
          <div
            className="sheet"
            style={{ width: "min(420px, calc(100vw - 32px))" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="decline-title"
          >
            <div className="sheet-body">
              <h2 id="decline-title" className="title-3" style={{ textAlign: "center" }}>
                Decline {declining.reward}?
              </h2>
              <p className="subhead" style={{ textAlign: "center", marginTop: 6 }}>
                {num(declining.cost)} points go straight back to {declining.user.split(" ")[0]}.
              </p>
              <textarea
                className="field"
                style={{ marginTop: 16 }}
                rows={3}
                placeholder="Add a short note for them (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="sheet-foot">
              <button className="btn btn-gray" style={{ flex: 1 }} onClick={() => setDeclining(null)}>
                Cancel
              </button>
              <button
                className="btn btn-filled btn-destructive"
                style={{ flex: 1 }}
                onClick={async () => {
                  const r = declining;
                  setDeclining(null);
                  await decide(r, false, note.trim() || undefined);
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <>
          <div className="scrim" onClick={() => setEditing(null)} />
          <div
            className="sheet"
            style={{ width: "min(520px, calc(100vw - 32px))" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-reward"
          >
            <div className="sheet-head">
              <button className="btn btn-plain" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <h2 id="edit-reward">{editing.id ? "Edit Reward" : "New Reward"}</h2>
              <button
                className="btn btn-plain"
                style={{ fontWeight: 700 }}
                onClick={async () => {
                  const res = await saveReward({
                    id: editing.id,
                    name: editing.name ?? "",
                    description: editing.description ?? "",
                    category: editing.category ?? "",
                    icon: editing.icon ?? "gift",
                    cost: Number(editing.cost ?? 0),
                    active: editing.active ?? true,
                  });
                  if (!res.ok) return toast(res.error, { tone: "error" });
                  setEditing(null);
                  toast("Reward saved");
                }}
              >
                Save
              </button>
            </div>
            <div className="sheet-body form-grid">
              <label style={{ gridColumn: "1 / -1" }}>
                <span className="field-label">Name</span>
                <input
                  className="field"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  autoFocus
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                <span className="field-label">Description</span>
                <input
                  className="field"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Category</span>
                <input
                  className="field"
                  list="reward-cats"
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                />
                <datalist id="reward-cats">
                  {[...new Set(rewards.map((r) => r.category))].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label>
                <span className="field-label">Cost (points)</span>
                <input
                  className="field num"
                  type="number"
                  min={10}
                  step={10}
                  value={editing.cost}
                  onChange={(e) => setEditing({ ...editing, cost: Number(e.target.value) })}
                />
              </label>
              <div style={{ gridColumn: "1 / -1" }}>
                <span className="field-label">Icon</span>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {ICONS.map((i) => (
                    <button
                      key={i}
                      className="icon-btn"
                      style={editing.icon === i ? { background: "var(--accent)", color: "#fff" } : { background: "var(--fill-2)" }}
                      onClick={() => setEditing({ ...editing, icon: i })}
                      aria-label={i}
                      aria-pressed={editing.icon === i}
                    >
                      <Icon name={i} size={18} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
