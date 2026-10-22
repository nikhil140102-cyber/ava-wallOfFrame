"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { useApp } from "./AppContext";
import { giveAppreciation, undoAppreciation } from "@/app/actions";
import { celebrate } from "../celebrate";
import { ImagePicker, MAX_PHOTOS } from "../ImagePicker";
import { useI18n } from "../I18nProvider";

const MAX = 500;

export function RecognizeSheet() {
  const { recognize, closeRecognize, data, can, toast } = useApp();
  const { t, fmt } = useI18n();
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
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (
      data.people
        .filter((p) => !recipients.includes(p.id) && (data.allowSelf || p.id !== data.me.id))
        .filter((p) => p.name.toLowerCase().includes(q) || p.department?.toLowerCase().includes(q))
        // First or last name starting with what was typed ranks above a match in the middle of a word.
        .sort(
          (a, b) =>
            Number(
              b.name
                .toLowerCase()
                .split(" ")
                .some((w) => w.startsWith(q))
            ) -
            Number(
              a.name
                .toLowerCase()
                .split(" ")
                .some((w) => w.startsWith(q))
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
      const firstNames = recipients.map((id) => byId.get(id)?.name.split(" ")[0]).filter(Boolean);
      const names = fmt.list(firstNames);
      toast(t("recognize.toast.sent", { names }), {
        action: {
          label: t("recognize.toast.undo"),
          onClick: async () => {
            const u = await undoAppreciation(res.data.postId);
            toast(u.ok ? t("recognize.toast.removed") : u.error, { tone: u.ok ? "default" : "error" });
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
            <Icon name="image" size={22} /> {t("recognize.dropHint")}
          </div>
        )}
        <div className="sheet-head">
          <button className="btn btn-plain" onClick={closeRecognize}>
            {t("recognize.cancel")}
          </button>
          <h2 id="rec-title">{t("recognize.title")}</h2>
          <button className="btn btn-plain" style={{ fontWeight: 700 }} disabled={!ready || pending} onClick={submit}>
            {pending ? t("recognize.sending") : t("recognize.send")}
          </button>
        </div>

        <div className="sheet-body rec-body">
          <section>
            <label className="rec-label" htmlFor="rec-to">
              <span className="step-num" data-done={recipients.length > 0 || undefined}>
                1
              </span>{" "}
              {t("recognize.step1")}
            </label>
            <div className="rec-to">
              {recipients.map((id) => {
                const p = byId.get(id);
                if (!p) return null;
                return (
                  <span key={id} className="token">
                    <Avatar name={p.name} size={22} />
                    {p.name}
                    <button
                      aria-label={t("recognize.removePerson", { name: p.name })}
                      onClick={() => setRecipients(recipients.filter((r) => r !== id))}
                    >
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
                placeholder={recipients.length ? "" : t("recognize.searchPlaceholder")}
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
              {t("recognize.step2")}
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
              {t("recognize.step3")}
            </label>
            <textarea
              id="rec-msg"
              ref={bodyRef}
              className="field"
              rows={4}
              maxLength={MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("recognize.messagePlaceholder")}
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
            />
            <div className="rec-count caption">
              {body.length}/{MAX}
            </div>
          </section>

          <section>
            <span className="rec-label">
              {t("recognize.photos.label")}{" "}
              <span className="tertiary" style={{ fontWeight: 400 }}>
                {t("recognize.photos.optional", { max: MAX_PHOTOS })}
              </span>
            </span>
            <ImagePicker ref={pickerRef} value={photos} onChange={setPhotos} onError={(m) => toast(m, { tone: "error" })} />
            <p className="caption" style={{ marginTop: 6 }}>
              {t("recognize.photos.help")}
            </p>
          </section>

          <section>
            <span className="rec-label">
              {t("recognize.badge.label")}{" "}
              <span className="tertiary" style={{ fontWeight: 400 }}>
                {t("recognize.badge.optional")}
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
                  {t(recipients.length > 1 ? "recognize.points.autoEach" : "recognize.points.auto", {
                    count: points,
                    points: fmt.num(points),
                  })}
                </span>
                <span className="caption">
                  {over
                    ? t("recognize.points.over", { cost: fmt.num(cost), remaining: fmt.num(remaining) })
                    : t("recognize.points.left", { left: fmt.num(Math.max(0, remaining - cost)), total: fmt.num(data.budget.monthly) })}
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
              ? t("recognize.hint.step1")
              : !valueId
                ? t("recognize.hint.step2")
                : body.trim().length < 3
                  ? t("recognize.hint.step3")
                  : over
                    ? t("recognize.hint.over")
                    : t("recognize.hint.ready", { company: data.companyName })}
          </span>
          <button className="btn btn-filled" disabled={!ready || pending} onClick={submit}>
            <Icon name="send" size={15} /> {pending ? t("recognize.sending") : t("recognize.sendAppreciation")}
          </button>
        </div>
      </div>
    </>
  );
}
