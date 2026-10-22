"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { PageHelp } from "@/components/PageHelp";
import { ImagePicker } from "@/components/ImagePicker";
import { useApp } from "@/components/shell/AppContext";
import { celebrate } from "@/components/celebrate";
import { addMemory, deleteMemory, discardImage } from "@/app/actions";
import { Art, Peg, Polaroid } from "@/components/Polaroid";
import { OnThisDay } from "@/components/OnThisDay";
import { useI18n } from "@/components/I18nProvider";

// Labels come from memories.kind.<kind>; placeholders from wall.pin.placeholder.<kind>.
const PIN_KINDS = [
  { kind: "skill", icon: "book", color: "#0D9488" },
  { kind: "certification", icon: "shield", color: "#4F46E5" },
  { kind: "achievement", icon: "trophy", color: "#CA8A04" },
  { kind: "moment", icon: "heart", color: "#E11D48" },
];

const first = (n) => n.split(" ")[0];

export function MemoryWall({ items, mode, target, meId, people, years, year, canPin, onThisDay = [] }) {
  const router = useRouter();
  const { toast } = useApp();
  const { t, fmt, rich } = useI18n();
  const [open, setOpen] = useState(null);
  const [pinning, setPinning] = useState(false);
  const thisYear = new Date().getFullYear();
  const everyone = mode === "all";

  // Newest month first; the current month is always shown so there's somewhere to pin.
  const months = useMemo(() => {
    const byMonth = new Map();
    for (const it of items) {
      const m = new Date(it.at).getMonth();
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(it);
    }
    if (year === thisYear && canPin && !byMonth.has(new Date().getMonth())) byMonth.set(new Date().getMonth(), []);
    return [...byMonth.entries()].sort((a, b) => b[0] - a[0]);
  }, [items, year, thisYear, canPin]);

  const count = (k) => items.filter((i) => i.kind === k).length;
  const stats = [
    ["thankYous", count("appreciation")],
    ["badges", count("badge")],
    ["skills", count("skill") + count("certification")],
    ["levelUps", count("level")],
    ["achievements", count("achievement")],
  ].filter(([, n]) => n > 0);
  // "{n} badges" → <b>3</b><span>badges</span>, in whatever word order the language uses.
  const chip = (key, n) =>
    rich(t(`wall.stats.${key}`, { count: n }), { n: <b>{fmt.num(n)}</b> }).map((part, i) =>
      typeof part === "string" ? part.trim() ? <span key={`s${i}`}>{part.trim()}</span> : null : part
    );

  function go(u, y = year) {
    const q = new URLSearchParams();
    if (u && u !== meId) q.set("u", u);
    if (y !== thisYear) q.set("y", String(y));
    router.push(`/wall${q.toString() ? `?${q}` : ""}`);
  }

  const whoKey = everyone ? "all" : mode === "mine" ? "mine" : "person";
  const whoParams = { year, name: first(target.name) };

  return (
    <main className="page memory-page">
      <header className="page-head">
        <div>
          <h1 className="large-title">{t("wall.title")}</h1>
          <p>{t(`wall.intro.${whoKey}`, whoParams)}</p>
        </div>
        <PageHelp topic="wall" />
        {canPin && (
          <button className="btn btn-filled" onClick={() => setPinning(true)}>
            <Icon name="plus" size={16} /> {t("wall.pinMoment")}
          </button>
        )}
      </header>

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label={t("wall.tabs.label")}>
          <button role="tab" aria-selected={mode === "mine"} onClick={() => go(meId)}>
            {t("wall.tabs.mine")}
          </button>
          <button role="tab" aria-selected={everyone} onClick={() => go("all")}>
            {t("wall.tabs.everyone")}
          </button>
        </div>
        <select
          className="field"
          style={{ width: 220, height: 36 }}
          value={everyone ? "" : target.id}
          onChange={(e) => e.target.value && go(e.target.value)}
          aria-label={t("wall.picker.label")}
        >
          {everyone && <option value="">{t("wall.picker.placeholder")}</option>}
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === meId ? t("wall.picker.you", { name: p.name }) : p.name}
            </option>
          ))}
        </select>
        <div className="segmented" role="tablist" aria-label={t("wall.yearLabel")} style={{ marginLeft: "auto" }}>
          {years.map((y) => (
            <button key={y} role="tab" aria-selected={y === year} onClick={() => go(everyone ? "all" : target.id, y)}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {onThisDay.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <OnThisDay groups={onThisDay} />
        </div>
      )}

      {stats.length > 0 && (
        <div className="wall-stats" aria-label={t("wall.stats.label")}>
          <div className="wall-total">{chip("memories", items.length)}</div>
          {stats.map(([key, n]) => (
            <div key={key}>{chip(key, n)}</div>
          ))}
        </div>
      )}

      <section className="wall" aria-label={t(`wall.wallLabel.${whoKey}`, whoParams)}>
        {months.length === 0 && (
          <Line label={year === thisYear ? t("wall.thisYear") : String(year)}>
            <EmptyFrame text={mode === "mine" ? t("wall.empty.mine") : t("wall.empty.other")} />
            <EmptyFrame text={t("wall.empty.auto")} />
            {canPin && <AddFrame onClick={() => setPinning(true)} />}
          </Line>
        )}
        {months.map(([m, list]) => (
          <Line key={m} label={fmt.date(new Date(year, m, 1), { month: "long" })} count={list.length}>
            {canPin && year === thisYear && m === new Date().getMonth() && <AddFrame onClick={() => setPinning(true)} />}
            {list.map((it) => (
              <Polaroid key={it.id} item={it} showName={everyone} onOpen={() => setOpen(it)} />
            ))}
          </Line>
        ))}
      </section>

      {open && (
        <MemorySheet
          item={open}
          everyone={everyone}
          onClose={() => setOpen(null)}
          onRemove={async () => {
            const r = await deleteMemory(open.memoryId);
            if (!r.ok) return toast(r.error, { tone: "error" });
            setOpen(null);
            toast(t("wall.toast.removed"));
            router.refresh();
          }}
        />
      )}
      {pinning && (
        <PinSheet
          target={target}
          isMe={target.id === meId}
          year={year}
          onClose={() => setPinning(false)}
          onDone={(title) => {
            setPinning(false);
            celebrate();
            toast(t("wall.toast.pinned", { title }));
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

/** One clothesline: a sagging string with polaroids pegged along it. Scrolls sideways when full. */
function Line({ label, count, children }) {
  const kids = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  const n = kids.length;
  const inner = useRef(null);
  // Hang each polaroid exactly on the string: the string sags most in the middle of the row.
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const place = () => {
      const w = el.offsetWidth;
      for (const h of el.querySelectorAll(":scope > .hang")) {
        const t = (h.offsetLeft + h.offsetWidth / 2) / w;
        h.style.setProperty("--drop", `${4 * 20 * t * (1 - t)}px`);
      }
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);
  return (
    <div className="line">
      <div className="line-label">
        <span>{label}</span>
        {count > 0 && <small>{count}</small>}
      </div>
      <div className="line-track">
        <div className="line-inner" ref={inner}>
          <svg className="string" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 14 Q 500 54 1000 14" />
          </svg>
          {kids.map((child, i) => (
            <div key={child.key ?? i} className="hang">
              {child}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyFrame({ text }) {
  return (
    <div className="polaroid polaroid-empty" style={{ "--tilt": "-1.5deg" }}>
      <Peg />
      <span className="pol-photo">
        <span className="art art-empty">
          <Icon name="image" size={26} />
        </span>
      </span>
      <span className="pol-cap">
        <span className="pol-title">{text}</span>
      </span>
    </div>
  );
}

function AddFrame({ onClick }) {
  const { t } = useI18n();
  return (
    <button className="polaroid polaroid-add" style={{ "--tilt": "1.5deg" }} onClick={onClick}>
      <Peg />
      <span className="pol-photo">
        <span className="art art-add">
          <Icon name="plus" size={30} />
        </span>
      </span>
      <span className="pol-cap">
        <span className="pol-title">{t("wall.addFrame")}</span>
      </span>
    </button>
  );
}

function useEscape(onClose) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
}

function MemorySheet({ item, everyone, onClose, onRemove }) {
  useEscape(onClose);
  const { t, fmt } = useI18n();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet memory-sheet" role="dialog" aria-modal="true" aria-labelledby="mem-title">
        <div className="sheet-head">
          <span style={{ width: 60 }} />
          <h2 id="mem-title">{item.label}</h2>
          <button className="btn btn-plain" style={{ fontWeight: 700 }} onClick={onClose}>
            {t("common.done")}
          </button>
        </div>
        <div className="sheet-body">
          <div className="memory-detail">
            <div className="polaroid polaroid-big" style={{ "--tilt": "-2deg" }}>
              <Peg />
              <span className="pol-photo">
                <Art item={item} big />
              </span>
              <span className="pol-cap">
                <span className="pol-title">{item.title}</span>
              </span>
            </div>
            <div className="memory-info">
              <span className="tag" style={{ color: item.color, background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
                <Icon name={item.icon} size={12} /> {item.label}
              </span>
              <h3 className="title-2">{item.title}</h3>
              <p className="secondary">
                {fmt.date(item.at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {everyone && (
                  <>
                    {" "}
                    · <Link href={`/wall?u=${item.userId}`}>{item.userName}</Link>
                  </>
                )}
              </p>
              {item.subtitle && <p className="memory-sub">{item.subtitle}</p>}
              {item.detail && <p className="memory-text" dir="auto">{item.detail}</p>}
              {item.points > 0 && item.kind !== "level" && (
                <span className="tag tag-orange">{t("wall.sheet.points", { points: fmt.num(item.points) })}</span>
              )}
              <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {item.link && (
                  <Link className="btn btn-tinted btn-sm" href={item.link}>
                    {item.link.startsWith("/posts") ? t("wall.sheet.openPost") : t("wall.sheet.open")}{" "}
                    <Icon name="chevronRight" size={13} />
                  </Link>
                )}
                {everyone && (
                  <Link className="btn btn-gray btn-sm" href={`/wall?u=${item.userId}`}>
                    {t("wall.sheet.personWall", { name: first(item.userName) })}
                  </Link>
                )}
                {item.removable &&
                  (confirm ? (
                    <>
                      <button className="btn btn-sm btn-destructive" onClick={onRemove}>
                        {t("wall.sheet.removeConfirm")}
                      </button>
                      <button className="btn btn-plain btn-sm" onClick={() => setConfirm(false)}>
                        {t("wall.sheet.keep")}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-plain btn-sm" style={{ color: "var(--red)" }} onClick={() => setConfirm(true)}>
                      <Icon name="trash" size={13} /> {t("wall.sheet.remove")}
                    </button>
                  ))}
              </div>
              {item.kind !== "skill" && item.kind !== "certification" && item.kind !== "achievement" && item.kind !== "moment" && (
                <p className="caption" style={{ marginTop: 14 }}>
                  {t("wall.sheet.auto")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const toDateInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function PinSheet({ target, isMe, year, onClose, onDone }) {
  const { toast } = useApp();
  const { t, rich } = useI18n();
  useEscape(onClose);
  const today = new Date();
  const defaultDate = year === today.getFullYear() ? today : new Date(year, 11, 31);
  const [kind, setKind] = useState("skill");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState(toDateInput(defaultDate));
  const [photos, setPhotos] = useState([]);
  const [share, setShare] = useState(true);
  const [priv, setPriv] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const k = PIN_KINDS.find((x) => x.kind === kind);

  function close() {
    photos.forEach((p) => discardImage(p.id));
    onClose();
  }

  async function save() {
    setPending(true);
    setError(null);
    const [y, m, d] = date.split("-").map(Number);
    const r = await addMemory({
      userId: target.id,
      kind,
      title,
      detail,
      occurredAt: new Date(y, m - 1, d, 12).getTime(),
      imageId: photos[0]?.id ?? null,
      private: priv,
      share: share && !priv,
    });
    setPending(false);
    if (!r.ok) return setError(r.error);
    onDone(title);
  }

  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="pin-title">
        <div className="sheet-head">
          <button className="btn btn-plain" onClick={close}>
            {t("common.cancel")}
          </button>
          <h2 id="pin-title">{t("wall.pinMoment")}</h2>
          <button className="btn btn-plain" style={{ fontWeight: 700 }} disabled={title.trim().length < 2 || pending} onClick={save}>
            {t("wall.pin.pin")}
          </button>
        </div>
        <div className="sheet-body stack" style={{ gap: 18 }}>
          {!isMe && (
            <p className="caption" style={{ margin: 0 }}>
              {rich(t("wall.pin.forSomeone"), { name: <b>{target.name}</b> })}
            </p>
          )}
          <div>
            <span className="rec-label">{t("wall.pin.kindQuestion")}</span>
            <div className="pin-kinds" role="radiogroup" aria-label={t("wall.pin.kindLabel")}>
              {PIN_KINDS.map((x) => (
                <button
                  key={x.kind}
                  role="radio"
                  aria-checked={kind === x.kind}
                  className="pin-kind"
                  style={{ "--c": x.color }}
                  onClick={() => setKind(x.kind)}
                >
                  <span>
                    <Icon name={x.icon} size={18} />
                  </span>
                  {t(`memories.kind.${x.kind}`)}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span className="rec-label">
              {kind === "skill"
                ? t("wall.pin.titleSkill")
                : kind === "certification"
                  ? t("wall.pin.titleCertification")
                  : t("wall.pin.titleOther")}
            </span>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(`wall.pin.placeholder.${k.kind}`)}
              maxLength={80}
              autoFocus
            />
          </label>
          <label>
            <span className="rec-label">
              {t("wall.pin.note")}{" "}
              <span className="tertiary" style={{ fontWeight: 400 }}>
                {t("wall.pin.optional")}
              </span>
            </span>
            <textarea
              className="field"
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={400}
              placeholder={t("wall.pin.notePlaceholder")}
            />
          </label>
          <div className="form-grid">
            <label>
              <span className="rec-label">{t("wall.pin.when")}</span>
              <input
                className="field"
                type="date"
                value={date}
                max={toDateInput(today)}
                min={`${year}-01-01`}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <div>
              <span className="rec-label">
                {t("wall.pin.photo")}{" "}
                <span className="tertiary" style={{ fontWeight: 400 }}>
                  {t("wall.pin.optional")}
                </span>
              </span>
              <ImagePicker value={photos} onChange={setPhotos} onError={(m) => toast(m, { tone: "error" })} max={1} compact />
            </div>
          </div>
          <div className="group">
            <div className="group-item">
              <span style={{ flex: 1 }}>
                {t("wall.pin.share")}
                <span className="caption" style={{ display: "block" }}>
                  {t("wall.pin.shareHint")}
                </span>
              </span>
              <button
                className="switch"
                role="switch"
                aria-checked={share && !priv}
                aria-label={t("wall.pin.share")}
                disabled={priv}
                onClick={() => setShare(!share)}
              />
            </div>
            <div className="group-item">
              <span style={{ flex: 1 }}>
                {t("wall.pin.private")}
                <span className="caption" style={{ display: "block" }}>
                  {t("wall.pin.privateHint")}
                </span>
              </span>
              <button
                className="switch"
                role="switch"
                aria-checked={priv}
                aria-label={t("wall.pin.private")}
                onClick={() => setPriv(!priv)}
              />
            </div>
          </div>
          {error && (
            <p className="rec-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="sheet-foot">
          <span className="caption" style={{ flex: 1 }}>
            {t("wall.pin.footer")}
          </span>
          <button className="btn btn-filled" disabled={title.trim().length < 2 || pending} onClick={save}>
            <Icon name="plus" size={15} /> {pending ? t("wall.pin.pinning") : t("wall.pin.submit")}
          </button>
        </div>
      </div>
    </>
  );
}
