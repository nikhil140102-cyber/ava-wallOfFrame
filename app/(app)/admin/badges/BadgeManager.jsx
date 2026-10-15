"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { deleteBadge, saveBadge } from "@/app/actions";
import { PageHelp } from "@/components/PageHelp";

const ICONS = [
  "award",
  "star",
  "trophy",
  "sparkles",
  "bolt",
  "rocket",
  "code",
  "layers",
  "book",
  "clock",
  "compass",
  "shield",
  "flask",
  "cpu",
  "heart",
  "users",
  "calendar",
  "key",
  "flag",
  "megaphone",
  "hands",
  "coffee",
  "sun",
  "chart",
];
const COLORS = ["#3355E6", "#059669", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#DC2626", "#4B5563"];

function Medal({ icon, color, size = 72 }) {
  return (
    <span className="badge-medal" style={{ width: size, height: size, background: color }}>
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </span>
  );
}

export function BadgeManager({ badges, defaultPoints }) {
  const { toast } = useApp();
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState("active");
  const categories = useMemo(() => [...new Set(badges.map((b) => b.category))].sort(), [badges]);
  const list = badges.filter((b) => (show === "active" ? b.active : !b.active));

  function startNew() {
    setEditing({
      name: "",
      description: "",
      criteria: "",
      category: categories[0] ?? "Culture",
      icon: "star",
      color: COLORS[0],
      points: defaultPoints,
      active: true,
    });
  }

  async function setActive(b, active) {
    const res = await saveBadge({ ...b, active });
    toast(res.ok ? (active ? `${b.name} is available again` : `${b.name} retired — people who earned it keep it`) : res.error, {
      tone: res.ok ? "default" : "error",
      action: res.ok ? { label: "Undo", onClick: async () => void (await saveBadge({ ...b, active: !active })) } : undefined,
    });
  }

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1 className="large-title">Badge Studio</h1>
          <p>Design the badges people can earn. New badges appear in the directory and the Recognize sheet right away.</p>
        </div>
        <PageHelp topic="admin-badges" />
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={show === "active"} onClick={() => setShow("active")}>
            Active ({badges.filter((b) => b.active).length})
          </button>
          <button role="tab" aria-selected={show === "retired"} onClick={() => setShow("retired")}>
            Retired ({badges.filter((b) => !b.active).length})
          </button>
        </div>
        <button className="btn btn-filled" onClick={startNew}>
          <Icon name="plus" size={16} /> New Badge
        </button>
      </header>

      {list.length === 0 && (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="award" size={26} />
          </span>
          <h3>{show === "retired" ? "No retired badges" : "No badges yet"}</h3>
          <p>
            {show === "retired"
              ? "Badges you retire show up here, and you can bring them back any time."
              : "Create your first badge to start celebrating great work."}
          </p>
        </div>
      )}

      {[...new Set(list.map((b) => b.category))].map((cat) => (
        <section key={cat} style={{ marginBottom: 28 }}>
          <div className="section-label">{cat}</div>
          <div className="group">
            {list
              .filter((b) => b.category === cat)
              .map((b) => (
                <div key={b.id} className="group-item">
                  <Medal icon={b.icon} color={b.color} size={40} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 15 }}>{b.name}</b>
                    <span className="caption" style={{ display: "block" }}>
                      {b.description} · +{b.points} pts · {b.holders} {b.holders === 1 ? "person has" : "people have"} it
                    </span>
                  </span>
                  <button className="btn btn-plain btn-sm" onClick={() => setEditing(b)}>
                    Edit
                  </button>
                  <button
                    className="switch switch-sm"
                    role="switch"
                    aria-checked={b.active}
                    aria-label={`${b.name} available`}
                    onClick={() => setActive(b, !b.active)}
                  />
                </div>
              ))}
          </div>
        </section>
      ))}

      {editing && <BadgeSheet draft={editing} categories={categories} onClose={() => setEditing(null)} />}
    </main>
  );
}

function BadgeSheet({ draft, categories, onClose }) {
  const { toast, can } = useApp();
  const canPoints = can("points.manage");
  const [d, setD] = useState(draft);
  const [newCat, setNewCat] = useState(!categories.includes(draft.category));
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const set = (k, v) => setD({ ...d, [k]: v });
  const ready = d.name.trim().length >= 2 && d.description.trim().length >= 3 && d.category.trim().length >= 2;

  async function save() {
    setPending(true);
    setError(null);
    const res = await saveBadge({
      id: d.id,
      name: d.name,
      description: d.description,
      criteria: d.criteria,
      category: d.category,
      icon: d.icon,
      color: d.color,
      points: d.points,
      active: d.active,
    });
    setPending(false);
    if (!res.ok) return setError(res.error);
    onClose();
    toast(d.id ? "Badge updated" : `${d.name} created — it's live in the directory`);
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="sheet"
        style={{ width: "min(720px, calc(100vw - 32px))" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-sheet"
      >
        <div className="sheet-head">
          <button className="btn btn-plain" onClick={onClose}>
            Cancel
          </button>
          <h2 id="badge-sheet">{d.id ? "Edit Badge" : "New Badge"}</h2>
          <button className="btn btn-plain" style={{ fontWeight: 700 }} disabled={!ready || pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="sheet-body studio">
          <aside className="studio-preview" aria-label="Preview">
            <Medal icon={d.icon} color={d.color} size={96} />
            <b>{d.name || "Badge name"}</b>
            <span className="caption">{d.description || "One-line description"}</span>
            <span className="row" style={{ gap: 6, justifyContent: "center", marginTop: 6 }}>
              <span className="tag">{d.category || "Category"}</span>
              <span className="tag tag-orange">+{d.points} pts</span>
            </span>
            <span className="caption" style={{ marginTop: 10 }}>
              This is how it looks in the directory and on profiles.
            </span>
          </aside>
          <div className="stack" style={{ gap: 16, flex: 1, minWidth: 0 }}>
            <label>
              <span className="field-label">Name</span>
              <input
                className="field"
                value={d.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Bug Hunter"
                maxLength={40}
                autoFocus
              />
            </label>
            <label>
              <span className="field-label">Description</span>
              <input
                className="field"
                value={d.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="What it celebrates, in one line"
                maxLength={120}
              />
            </label>
            <label>
              <span className="field-label">How to earn it</span>
              <textarea
                className="field"
                rows={2}
                value={d.criteria}
                onChange={(e) => set("criteria", e.target.value)}
                placeholder="e.g. Find and fix 5 production bugs in a quarter"
                maxLength={300}
              />
              <span className="field-hint">Shown to everyone, so keep it concrete.</span>
            </label>
            <div className="form-grid">
              <label>
                <span className="field-label">Category</span>
                {newCat ? (
                  <input
                    className="field"
                    value={d.category}
                    onChange={(e) => set("category", e.target.value)}
                    placeholder="New category name"
                    maxLength={30}
                  />
                ) : (
                  <select
                    className="field"
                    value={d.category}
                    onChange={(e) => {
                      if (e.target.value === "__new") {
                        setNewCat(true);
                        set("category", "");
                      } else set("category", e.target.value);
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__new">New category…</option>
                  </select>
                )}
              </label>
              <div>
                <span className="field-label">Points when awarded</span>
                {canPoints ? (
                  <div className="stepper" style={{ height: 44 }}>
                    <button onClick={() => set("points", Math.max(0, d.points - 25))} aria-label="Fewer points">
                      −
                    </button>
                    <span className="num">{d.points}</span>
                    <button onClick={() => set("points", Math.min(1000, d.points + 25))} aria-label="More points">
                      +
                    </button>
                  </div>
                ) : (
                  <div className="locked-value" title="Point amounts are decided by the Super Admin">
                    <Icon name="lock" size={14} /> <b className="num">{d.points}</b>
                    <span className="caption">Set by Super Admin</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <span className="field-label">Icon</span>
              <div className="icon-grid" role="radiogroup" aria-label="Icon">
                {ICONS.map((i) => (
                  <button
                    key={i}
                    role="radio"
                    aria-checked={d.icon === i}
                    aria-label={i}
                    onClick={() => set("icon", i)}
                    style={d.icon === i ? { background: d.color, color: "#fff" } : undefined}
                  >
                    <Icon name={i} size={18} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="field-label">Colour</span>
              <div className="row" style={{ gap: 8 }} role="radiogroup" aria-label="Colour">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className="color-dot"
                    style={{ background: c, width: 30, height: 30 }}
                    role="radio"
                    aria-checked={d.color === c}
                    aria-label={c}
                    onClick={() => set("color", c)}
                  />
                ))}
              </div>
            </div>
            {error && (
              <p className="rec-error" role="alert">
                {error}
              </p>
            )}
            {d.id && (
              <div className="group" style={{ marginTop: 4 }}>
                {d.holders ? (
                  <button
                    className="group-item"
                    style={{ justifyContent: "center", color: "var(--orange)" }}
                    onClick={() => set("active", !d.active)}
                  >
                    {d.active ? "Retire this badge on save" : "Bring this badge back on save"}
                  </button>
                ) : (
                  <button
                    className="group-item"
                    style={{ justifyContent: "center", color: "var(--red)" }}
                    onClick={async () => {
                      const r = await deleteBadge(d.id);
                      if (!r.ok) return setError(r.error);
                      onClose();
                      toast("Badge deleted");
                    }}
                  >
                    Delete Badge
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
