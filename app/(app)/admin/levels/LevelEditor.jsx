"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { saveLevels } from "@/app/actions";
import { num } from "@/lib/format";
import { PageHelp } from "@/components/PageHelp";

export function LevelEditor({ levels, lifetimes }) {
  const { toast } = useApp();
  const [rows, setRows] = useState(levels);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(rows) !== JSON.stringify(levels);
  const sorted = [...rows].sort((a, b) => a.minPoints - b.minPoints);
  // Live preview: how many people would sit at each level with the thresholds as typed.
  const counts = sorted.map(
    (l, i) => lifetimes.filter((p) => p >= l.minPoints && (i === sorted.length - 1 || p < sorted[i + 1].minPoints)).length
  );
  const total = lifetimes.length || 1;
  const set = (id, patch) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <main className="page page-narrow" style={{ maxWidth: 860 }}>
      <header className="page-head">
        <div>
          <h1 className="large-title">Levels</h1>
          <p>Levels come from lifetime points (appreciations and badges). Spending points never lowers a level.</p>
        </div>
        <PageHelp topic="admin-levels" />
      </header>

      <section className="card card-pad">
        <h2 className="headline">Where people are today</h2>
        <div className="level-bar" role="img" aria-label="Distribution of people across levels">
          {sorted.map((l, i) => (
            <span key={l.id} style={{ flex: Math.max(counts[i], 0.25), background: l.color }} title={`${l.name}: ${counts[i]}`} />
          ))}
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
          {sorted.map((l, i) => (
            <span key={l.id} className="row caption" style={{ gap: 6 }}>
              <span className="dot" style={{ background: l.color }} />
              <b style={{ color: "var(--label)" }}>{l.name}</b> {counts[i]} ({Math.round((counts[i] / total) * 100)}%)
            </span>
          ))}
        </div>
        <p className="caption" style={{ marginTop: 10 }}>
          Updates as you edit thresholds below, before you save.
        </p>
      </section>

      <section className="group-block" style={{ marginTop: 28 }}>
        <div className="section-label">Thresholds &amp; perks</div>
        <div className="group">
          {sorted.map((l, i) => (
            <div key={l.id} className="group-item level-row">
              <input
                type="color"
                value={l.color}
                onChange={(e) => set(l.id, { color: e.target.value.toUpperCase() })}
                aria-label={`${l.name} colour`}
                className="color-input"
              />
              <input
                className="inline-input"
                style={{ fontWeight: 600, maxWidth: 140 }}
                value={l.name}
                onChange={(e) => set(l.id, { name: e.target.value })}
                aria-label="Level name"
              />
              <label className="row caption" style={{ gap: 6 }}>
                from
                <input
                  className="field num"
                  style={{ width: 96, height: 34 }}
                  type="number"
                  min={0}
                  step={50}
                  value={l.minPoints}
                  disabled={i === 0}
                  onChange={(e) => set(l.id, { minPoints: Math.max(0, Number(e.target.value)) })}
                  aria-label={`${l.name} minimum points`}
                />
                pts
              </label>
              <input
                className="inline-input"
                value={l.perk}
                onChange={(e) => set(l.id, { perk: e.target.value })}
                placeholder="Perk at this level"
                aria-label={`${l.name} perk`}
              />
            </div>
          ))}
        </div>
        <p className="group-footer">The first level always starts at 0.</p>
      </section>

      <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
        {dirty && (
          <button className="btn btn-plain" onClick={() => setRows(levels)}>
            <Icon name="undo" size={15} /> Revert
          </button>
        )}
        <button
          className="btn btn-filled"
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            const r = await saveLevels(rows);
            setSaving(false);
            toast(r.ok ? "Levels saved — everyone's level updates right away" : r.error, { tone: r.ok ? "default" : "error" });
          }}
        >
          Save Levels
        </button>
      </div>
      <p className="caption" style={{ textAlign: "right", marginTop: 8 }}>
        Average lifetime points: {num(Math.round(lifetimes.reduce((a, b) => a + b, 0) / total))}
      </p>
    </main>
  );
}
