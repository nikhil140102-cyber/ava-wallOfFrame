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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PIN_KINDS = [
  {
    kind: "skill",
    label: "Skill learned",
    icon: "book",
    color: "#0D9488",
    placeholder: "e.g. Figma variables, SQL basics, Public speaking",
  },
  { kind: "certification", label: "Certification", icon: "shield", color: "#4F46E5", placeholder: "e.g. Advanced Accessibility course" },
  { kind: "achievement", label: "Achievement", icon: "trophy", color: "#CA8A04", placeholder: "e.g. Closed our biggest client deal" },
  { kind: "moment", label: "Moment", icon: "heart", color: "#E11D48", placeholder: "e.g. Team offsite in Coorg" },
];

const first = (n) => n.split(" ")[0];
const fmt = (ms, opts) => new Date(ms).toLocaleDateString("en-IN", opts);

export function MemoryWall({ items, mode, target, meId, people, years, year, canPin, onThisDay = [] }) {
  const router = useRouter();
  const { toast } = useApp();
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
    ["Thank-yous", count("appreciation")],
    ["Badges", count("badge")],
    ["Skills & certificates", count("skill") + count("certification")],
    ["Level-ups", count("level")],
    ["Achievements", count("achievement")],
  ].filter(([, n]) => n > 0);

  function go(u, y = year) {
    const q = new URLSearchParams();
    if (u && u !== meId) q.set("u", u);
    if (y !== thisYear) q.set("y", String(y));
    router.push(`/wall${q.toString() ? `?${q}` : ""}`);
  }

  const whose = everyone ? "Everyone’s" : mode === "mine" ? "Your" : `${first(target.name)}’s`;

  return (
    <main className="page memory-page">
      <header className="page-head">
        <div>
          <h1 className="large-title">Memory Wall</h1>
          <p>
            {whose} {year} in frames — badges, thank-yous, skills and milestones, pinned automatically as they happen.
          </p>
        </div>
        <PageHelp topic="wall" />
        {canPin && (
          <button className="btn btn-filled" onClick={() => setPinning(true)}>
            <Icon name="plus" size={16} /> Pin a Moment
          </button>
        )}
      </header>

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Whose wall">
          <button role="tab" aria-selected={mode === "mine"} onClick={() => go(meId)}>
            My Wall
          </button>
          <button role="tab" aria-selected={everyone} onClick={() => go("all")}>
            Everyone
          </button>
        </div>
        <select
          className="field"
          style={{ width: 220, height: 36 }}
          value={everyone ? "" : target.id}
          onChange={(e) => e.target.value && go(e.target.value)}
          aria-label="Open someone’s wall"
        >
          {everyone && <option value="">Open someone’s wall…</option>}
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === meId ? `${p.name} (you)` : p.name}
            </option>
          ))}
        </select>
        <div className="segmented" role="tablist" aria-label="Year" style={{ marginLeft: "auto" }}>
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
        <div className="wall-stats" aria-label="Year summary">
          <div className="wall-total">
            <b>{items.length}</b>
            <span>{items.length === 1 ? "memory" : "memories"}</span>
          </div>
          {stats.map(([label, n]) => (
            <div key={label}>
              <b>{n}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      <section className="wall" aria-label={`${whose} memories for ${year}`}>
        {months.length === 0 && (
          <Line label={year === thisYear ? "This year" : String(year)}>
            <EmptyFrame
              text={
                mode === "mine"
                  ? "Your first memory appears here when someone thanks you or you earn a badge."
                  : "Nothing pinned this year yet."
              }
            />
            <EmptyFrame text="Badges, level-ups and anniversaries hang here automatically." />
            {canPin && <AddFrame onClick={() => setPinning(true)} />}
          </Line>
        )}
        {months.map(([m, list]) => (
          <Line key={m} label={MONTHS[m]} count={list.length}>
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
            toast("Removed from the wall");
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
            toast(`“${title}” pinned to the wall`);
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
  return (
    <button className="polaroid polaroid-add" style={{ "--tilt": "1.5deg" }} onClick={onClick}>
      <Peg />
      <span className="pol-photo">
        <span className="art art-add">
          <Icon name="plus" size={30} />
        </span>
      </span>
      <span className="pol-cap">
        <span className="pol-title">Pin a skill, certificate or moment</span>
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
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet memory-sheet" role="dialog" aria-modal="true" aria-labelledby="mem-title">
        <div className="sheet-head">
          <span style={{ width: 60 }} />
          <h2 id="mem-title">{item.label}</h2>
          <button className="btn btn-plain" style={{ fontWeight: 700 }} onClick={onClose}>
            Done
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
                {fmt(item.at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {everyone && (
                  <>
                    {" "}
                    · <Link href={`/wall?u=${item.userId}`}>{item.userName}</Link>
                  </>
                )}
              </p>
              {item.subtitle && <p className="memory-sub">{item.subtitle}</p>}
              {item.detail && <p className="memory-text">{item.detail}</p>}
              {item.points > 0 && item.kind !== "level" && <span className="tag tag-orange">+{item.points} points</span>}
              <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {item.link && (
                  <Link className="btn btn-tinted btn-sm" href={item.link}>
                    {item.link.startsWith("/posts") ? "Open post" : "Open"} <Icon name="chevronRight" size={13} />
                  </Link>
                )}
                {everyone && (
                  <Link className="btn btn-gray btn-sm" href={`/wall?u=${item.userId}`}>
                    {first(item.userName)}’s wall
                  </Link>
                )}
                {item.removable &&
                  (confirm ? (
                    <>
                      <button className="btn btn-sm btn-destructive" onClick={onRemove}>
                        Remove from wall
                      </button>
                      <button className="btn btn-plain btn-sm" onClick={() => setConfirm(false)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-plain btn-sm" style={{ color: "var(--red)" }} onClick={() => setConfirm(true)}>
                      <Icon name="trash" size={13} /> Remove
                    </button>
                  ))}
              </div>
              {item.kind !== "skill" && item.kind !== "certification" && item.kind !== "achievement" && item.kind !== "moment" && (
                <p className="caption" style={{ marginTop: 14 }}>
                  Pinned automatically.
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
            Cancel
          </button>
          <h2 id="pin-title">Pin a Moment</h2>
          <button className="btn btn-plain" style={{ fontWeight: 700 }} disabled={title.trim().length < 2 || pending} onClick={save}>
            Pin
          </button>
        </div>
        <div className="sheet-body stack" style={{ gap: 18 }}>
          {!isMe && (
            <p className="caption" style={{ margin: 0 }}>
              Pinning to <b>{target.name}</b>’s wall. They’ll get a notification.
            </p>
          )}
          <div>
            <span className="rec-label">What kind of moment?</span>
            <div className="pin-kinds" role="radiogroup" aria-label="Kind">
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
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span className="rec-label">
              {kind === "skill" ? "What did you learn?" : kind === "certification" ? "Which certification?" : "What happened?"}
            </span>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={k.placeholder}
              maxLength={80}
              autoFocus
            />
          </label>
          <label>
            <span className="rec-label">
              A note to remember it by{" "}
              <span className="tertiary" style={{ fontWeight: 400 }}>
                — optional
              </span>
            </span>
            <textarea
              className="field"
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={400}
              placeholder="How it went, who helped, what's next…"
            />
          </label>
          <div className="form-grid">
            <label>
              <span className="rec-label">When</span>
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
                Photo{" "}
                <span className="tertiary" style={{ fontWeight: 400 }}>
                  — optional
                </span>
              </span>
              <ImagePicker value={photos} onChange={setPhotos} onError={(m) => toast(m, { tone: "error" })} max={1} compact />
            </div>
          </div>
          <div className="group">
            <div className="group-item">
              <span style={{ flex: 1 }}>
                Share in the feed
                <span className="caption" style={{ display: "block" }}>
                  Colleagues can applaud and comment
                </span>
              </span>
              <button
                className="switch"
                role="switch"
                aria-checked={share && !priv}
                aria-label="Share in the feed"
                disabled={priv}
                onClick={() => setShare(!share)}
              />
            </div>
            <div className="group-item">
              <span style={{ flex: 1 }}>
                Only me
                <span className="caption" style={{ display: "block" }}>
                  Hidden from others (HR can still see it)
                </span>
              </span>
              <button className="switch" role="switch" aria-checked={priv} aria-label="Only me" onClick={() => setPriv(!priv)} />
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
            Badges, thank-yous and level-ups are pinned for you automatically.
          </span>
          <button className="btn btn-filled" disabled={title.trim().length < 2 || pending} onClick={save}>
            <Icon name="plus" size={15} /> {pending ? "Pinning…" : "Pin to Wall"}
          </button>
        </div>
      </div>
    </>
  );
}
