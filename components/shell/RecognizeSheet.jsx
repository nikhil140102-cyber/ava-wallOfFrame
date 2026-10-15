"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { useApp } from "./AppContext";
import { giveAppreciation, undoAppreciation } from "@/app/actions";
import { celebrate } from "../celebrate";
import { ImagePicker } from "../ImagePicker";

const MAX = 500;

export function RecognizeSheet() {
  const { recognize, closeRecognize, data, can, toast } = useApp();
  const [recipients, setRecipients] = useState([]);
  const [query, setQuery] = useState("");
  const [valueId, setValueId] = useState(null);
  const [badgeId, setBadgeId] = useState(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [dragging, setDragging] = useState(false);
  const pickerRef = useRef(null);
  const [pending, start] = useTransition();
  const searchRef = useRef(null);
  const bodyRef = useRef(null);

  // Reset to sensible defaults every time the sheet opens.
  useEffect(() => {
    if (!recognize.open) return;
    setRecipients(recognize.prefill);
    setQuery("");
    setValueId(null);
    setBadgeId(null);
    setBody("");
    setPhotos([]);
    setDragging(false);
    setError(null);
    requestAnimationFrame(() => (recognize.prefill.length ? bodyRef.current : searchRef.current)?.focus());
  }, [recognize.open, recognize.prefill]);

  useEffect(() => {
    if (!recognize.open) return;
    const onKey = (e) => e.key === "Escape" && closeRecognize();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recognize.open, closeRecognize]);

  const byId = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data.people]);
  const matches = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return [];
    return (
      data.people
        .filter((p) => !recipients.includes(p.id) && (data.allowSelf || p.id !== data.me.id))
        .filter((p) => p.name.toLowerCase().includes(t) || p.department?.toLowerCase().includes(t))
        // First or last name starting with what was typed ranks above a match in the middle of a word.
        .sort(
          (a, b) =>
            Number(
              b.name
                .toLowerCase()
                .split(" ")
                .some((w) => w.startsWith(t))
            ) -
            Number(
              a.name
                .toLowerCase()
                .split(" ")
                .some((w) => w.startsWith(t))
            )
        )
        .slice(0, 5)
    );
  }, [query, recipients, data]);
  const badges = data.badges.filter((b) => can("badges.award") || b.category === "Culture");

  const remaining = data.budget.monthly - data.budget.used;
  const points = data.appreciationPoints;
  const cost = points * recipients.length;
  const over = cost > remaining;
  const ready = recipients.length > 0 && !!valueId && body.trim().length >= 3 && !over;

  if (!recognize.open) return null;

  function submit() {
    if (!ready || pending) return;
    setError(null);
    start(async () => {
      const res = await giveAppreciation({ recipientIds: recipients, valueId: valueId, badgeId, body, imageIds: photos.map((x) => x.id) });
      if (!res.ok) return setError(res.error);
      closeRecognize();
      celebrate();
      const names = recipients.map((id) => byId.get(id)?.name.split(" ")[0]).join(" & ");
      toast(`Appreciation sent to ${names}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const u = await undoAppreciation(res.data.postId);
            toast(u.ok ? "Appreciation removed" : u.error, { tone: u.ok ? "default" : "error" });
          },
        },
      });
    });
  }

  return (
    <>
      <div className="scrim" onClick={closeRecognize} />
      <div
        className="sheet recognize"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rec-title"
        onPaste={(e) => {
          const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
          if (files.length) {
            e.preventDefault();
            pickerRef.current?.addFiles(files);
          }
        }}
        onDragOver={(e) => {
          if ([...e.dataTransfer.types].includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pickerRef.current?.addFiles(e.dataTransfer.files);
        }}
      >
        {dragging && (
          <div className="drop-hint">
            <Icon name="image" size={22} /> Drop photos to add them
          </div>
        )}
        <div className="sheet-head">
          <button className="btn btn-plain" onClick={closeRecognize}>
            Cancel
          </button>
          <h2 id="rec-title">Recognize</h2>
          <button className="btn btn-plain" style={{ fontWeight: 700 }} disabled={!ready || pending} onClick={submit}>
            {pending ? "Sending…" : "Send"}
          </button>
        </div>

        <div className="sheet-body rec-body">
          <section>
            <label className="rec-label" htmlFor="rec-to">
              <span className="step-num" data-done={recipients.length > 0 || undefined}>
                1
              </span>{" "}
              Who are you thanking?
            </label>
            <div className="rec-to">
              {recipients.map((id) => {
                const p = byId.get(id);
                if (!p) return null;
                return (
                  <span key={id} className="token">
                    <Avatar name={p.name} size={22} />
                    {p.name}
                    <button aria-label={`Remove ${p.name}`} onClick={() => setRecipients(recipients.filter((r) => r !== id))}>
                      <Icon name="x" size={12} stroke={2.4} />
                    </button>
                  </span>
                );
              })}
              <input
                id="rec-to"
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches[0]) {
                    e.preventDefault();
                    setRecipients([...recipients, matches[0].id]);
                    setQuery("");
                  }
                  if (e.key === "Backspace" && !query && recipients.length) setRecipients(recipients.slice(0, -1));
                }}
                placeholder={recipients.length ? "" : "Start typing a name…"}
                autoComplete="off"
              />
            </div>
            {matches.length > 0 && (
              <div className="rec-matches">
                {matches.map((p, i) => (
                  <button
                    key={p.id}
                    className="menu-item"
                    data-active={i === 0 || undefined}
                    onClick={() => {
                      setRecipients([...recipients, p.id]);
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                  >
                    <Avatar name={p.name} size={28} />
                    <span style={{ flex: 1 }}>
                      {p.name}
                      <span className="caption" style={{ display: "block" }}>
                        {p.title} · {p.department}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <span className="rec-label">
              <span className="step-num" data-done={!!valueId || undefined}>
                2
              </span>{" "}
              Which value did they show?
            </span>
            <div className="rec-values">
              {data.values.map((v) => (
                <button key={v.id} className="chip" aria-pressed={valueId === v.id} onClick={() => setValueId(v.id)} title={v.description}>
                  {valueId === v.id && <Icon name="check" size={14} stroke={2.6} />}
                  {v.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="rec-label" htmlFor="rec-msg">
              <span className="step-num" data-done={body.trim().length >= 3 || undefined}>
                3
              </span>{" "}
              Say thank you
            </label>
            <textarea
              id="rec-msg"
              ref={bodyRef}
              className="field"
              rows={4}
              maxLength={MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did they do, and why did it matter?"
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
            />
            <div className="rec-count caption">
              {body.length}/{MAX}
            </div>
          </section>

          <section>
            <span className="rec-label">
              Add photos{" "}
              <span className="tertiary" style={{ fontWeight: 400 }}>
                — optional, up to 4
              </span>
            </span>
            <ImagePicker ref={pickerRef} value={photos} onChange={setPhotos} onError={(m) => toast(m, { tone: "error" })} />
            <p className="caption" style={{ marginTop: 6 }}>
              Team photo, a screenshot of the work, a happy moment. You can also paste or drag photos here.
            </p>
          </section>

          <section>
            <span className="rec-label">
              Add a badge{" "}
              <span className="tertiary" style={{ fontWeight: 400 }}>
                — optional
              </span>
            </span>
            <div className="rec-badges">
              {badges.map((b) => (
                <button
                  key={b.id}
                  className="rec-badge"
                  aria-pressed={badgeId === b.id}
                  onClick={() => setBadgeId(badgeId === b.id ? null : b.id)}
                >
                  <span style={{ background: `color-mix(in srgb, ${b.color} 14%, transparent)`, color: b.color }}>
                    <Icon name={b.icon} size={18} />
                  </span>
                  {b.name}
                </button>
              ))}
            </div>
          </section>

          {points > 0 && (
            <section className="rec-points rec-auto" data-over={over || undefined}>
              <span className="rec-auto-icon" aria-hidden="true">
                <Icon name="sparkles" size={18} />
              </span>
              <div style={{ flex: 1 }}>
                <span className="rec-label" style={{ marginBottom: 2 }}>
                  +{points} points{recipients.length > 1 ? " each" : ""}, given automatically
                </span>
                <span className="caption">
                  {over
                    ? `That's ${cost} — you have ${remaining} left to give this month`
                    : `${Math.max(0, remaining - cost)} of ${data.budget.monthly} left to give this month · amount set by the Super Admin`}
                </span>
              </div>
            </section>
          )}

          {error && (
            <p className="rec-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="sheet-foot">
          <span className="caption" style={{ flex: 1 }} aria-live="polite">
            {!recipients.length
              ? "Step 1: choose who you're thanking"
              : !valueId
                ? "Step 2: pick a value"
                : body.trim().length < 3
                  ? "Step 3: write a short thank-you"
                  : over
                    ? "You've used this month's giving budget — try fewer people"
                    : `Ready! Everyone at ${data.companyName} will see this.`}
          </span>
          <button className="btn btn-filled" disabled={!ready || pending} onClick={submit}>
            <Icon name="send" size={15} /> {pending ? "Sending…" : "Send Appreciation"}
          </button>
        </div>
      </div>
    </>
  );
}
