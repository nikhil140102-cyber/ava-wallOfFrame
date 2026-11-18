"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { deleteAnnouncement, endAnnouncement, saveAnnouncement } from "@/app/actions";

const TONES = [
  { key: "info", label: "Info", icon: "megaphone", hint: "Everyday news" },
  { key: "celebrate", label: "Celebration", icon: "sparkles", hint: "Wins, welcomes, birthdays" },
  { key: "urgent", label: "Urgent", icon: "bolt", hint: "Turns the bar red" },
];
const MAX = 200;

const istDay = (offsetDays = 0) => {
  const d = new Date(Date.now() + 330 * 60_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
};
const fmt = (ms) =>
  new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function Preview({ text, tone, author }) {
  return (
    <div className="ann-bar" data-urgent={tone === "urgent" || undefined} style={{ borderRadius: 12 }} aria-hidden="true">
      <span className="ann-label">
        <Icon name="megaphone" size={15} />
        <span className="ann-label-text">Announcements</span>
      </span>
      <div className="ann-viewport">
        <ul className="ann-items">
          <li className={`ann-item ann-${tone}`}>
            <Icon name={TONES.find((t) => t.key === tone)?.icon ?? "megaphone"} size={14} />
            <span dir="auto">{text || "Your announcement will look like this"}</span>
            <span className="ann-author">— {author}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export function AnnouncementsEditor({ list }) {
  const { toast, data } = useApp();
  const [f, setF] = useState({ text: "", tone: "info", endsOn: istDay(7) });
  const [busy, setBusy] = useState(false);
  const live = list.filter((a) => a.live);
  const ended = list.filter((a) => !a.live);

  async function post() {
    setBusy(true);
    const r = await saveAnnouncement(f);
    setBusy(false);
    if (!r.ok) return toast(r.error, { tone: "error" });
    setF({ text: "", tone: "info", endsOn: istDay(7) });
    toast("Announcement is live for everyone");
  }

  return (
    <main className="page page-narrow">
      <header className="page-head">
        <div>
          <h1 className="large-title">Announcements</h1>
          <p>Short messages that scroll across the top of the app for everyone. Only HR and admins can post them.</p>
        </div>
      </header>

      <section className="group-block">
        <div className="section-label">New announcement</div>
        <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Message</span>
            <textarea
              className="field"
              rows={2}
              maxLength={MAX}
              placeholder="e.g. Town hall on Friday at 4 PM in the main hall — bring your questions"
              value={f.text}
              onChange={(e) => setF({ ...f, text: e.target.value })}
              style={{ resize: "vertical" }}
            />
            <span className="caption" style={{ textAlign: "right" }}>
              {f.text.length}/{MAX}
            </span>
          </label>

          <div style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Style</span>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label="Style">
              {TONES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={f.tone === t.key}
                  className={`btn btn-sm ${f.tone === t.key ? "btn-filled" : "btn-gray"}`}
                  onClick={() => setF({ ...f, tone: t.key })}
                  title={t.hint}
                >
                  <Icon name={t.icon} size={14} /> {t.label}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: "grid", gap: 6, maxWidth: 260 }}>
            <span className="field-label">Show until</span>
            <input
              type="date"
              className="field"
              min={istDay(0)}
              value={f.endsOn}
              onChange={(e) => setF({ ...f, endsOn: e.target.value })}
            />
            <span className="caption">Leave empty to keep it up until you take it down.</span>
          </label>

          <div style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Preview</span>
            <Preview text={f.text.trim()} tone={f.tone} author={data.me.name} />
          </div>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-filled" disabled={busy || f.text.trim().length < 3} onClick={post}>
              <Icon name="megaphone" size={16} /> Post to everyone
            </button>
          </div>
        </div>
      </section>

      <section className="group-block">
        <div className="section-label">Live now ({live.length})</div>
        <div className="group">
          {live.length === 0 && <div className="group-item secondary">Nothing is showing. The bar is hidden until you post something.</div>}
          {live.map((a) => (
            <Row key={a.id} a={a} live toast={toast} />
          ))}
        </div>
      </section>

      {ended.length > 0 && (
        <section className="group-block">
          <div className="section-label">Ended</div>
          <div className="group">
            {ended.map((a) => (
              <Row key={a.id} a={a} toast={toast} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Row({ a, live, toast }) {
  const tone = TONES.find((t) => t.key === a.tone) ?? TONES[0];
  return (
    <div className="group-item" style={{ alignItems: "flex-start", opacity: live ? 1 : 0.6 }}>
      <Icon
        name={tone.icon}
        size={18}
        style={{ marginTop: 2, color: a.tone === "urgent" ? "var(--red)" : a.tone === "celebrate" ? "var(--orange)" : "var(--accent)" }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span dir="auto" style={{ display: "block" }}>
          {a.text}
        </span>
        <span className="caption">
          {tone.label} · {a.author || "Someone"} · {fmt(a.createdAt)} ·{" "}
          {live ? (a.endsAt ? `until ${fmt(a.endsAt)}` : "until taken down") : "ended"}
        </span>
      </span>
      {live && (
        <button
          className="btn btn-sm btn-gray"
          onClick={async () => {
            const r = await endAnnouncement(a.id);
            toast(r.ok ? "Taken down" : r.error, { tone: r.ok ? "default" : "error" });
          }}
        >
          Take down
        </button>
      )}
      <button
        className="icon-btn"
        aria-label="Delete announcement"
        onClick={async () => {
          const r = await deleteAnnouncement(a.id);
          toast(r.ok ? "Deleted" : r.error, { tone: r.ok ? "default" : "error" });
        }}
      >
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}
