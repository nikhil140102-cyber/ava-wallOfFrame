"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { PageHelp } from "@/components/PageHelp";
import { useApp } from "@/components/shell/AppContext";
import { savePointRules } from "@/app/actions";
import { timeAgo } from "@/lib/format";

const AUTO = [
  { key: "welcome", label: "Welcome bonus", hint: "When HR adds a new person", icon: "personPlus", color: "var(--accent)" },
  { key: "birthday", label: "Birthday", hint: "On their birthday, once a year", icon: "gift", color: "var(--pink)" },
  { key: "anniversary", label: "Work anniversary", hint: "Every year on their joining date", icon: "calendar", color: "var(--orange)" },
];

function Amount({ value, onChange, step, label, disabled }) {
  return (
    <div className="stepper" aria-disabled={disabled || undefined}>
      <button onClick={() => onChange(Math.max(0, value - step))} aria-label={`Decrease ${label}`} disabled={disabled || value <= 0}>
        −
      </button>
      <input
        className="num stepper-input"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Math.min(100000, Number(e.target.value.replace(/\D/g, "")) || 0))}
      />
      <button onClick={() => onChange(value + step)} aria-label={`Increase ${label}`} disabled={disabled}>
        +
      </button>
    </div>
  );
}

export function PointRules({ initial, stats, activeCount, upcoming, recent }) {
  const { toast } = useApp();
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const setRule = (k, patch) => setF({ ...f, rules: { ...f.rules, [k]: { ...f.rules[k], ...patch } } });
  const perMonth = f.appreciationPoints ? Math.floor(f.monthlyBudget / f.appreciationPoints) : null;

  function save() {
    start(async () => {
      const r = await savePointRules(f);
      if (!r.ok) return toast(r.error, { tone: "error" });
      toast(
        r.data.given
          ? `Rules saved · ${r.data.given} ${r.data.given === 1 ? "person" : "people"} got points today`
          : "Rules saved — they apply right away"
      );
      router.refresh();
    });
  }

  return (
    <main className="page page-narrow">
      <header className="page-head">
        <div>
          <h1 className="large-title">Points Rules</h1>
          <p>You decide how many points people get. The app gives them out automatically.</p>
        </div>
        <PageHelp topic="admin-points" />
      </header>

      <div className="rules-hero">
        <span className="rules-hero-icon">
          <Icon name="sparkles" size={22} />
        </span>
        <div>
          <b>Only the Super Admin can change these amounts.</b>
          <span className="caption">
            HR and you decide reward requests and manage people; managers and employees just say thank you — the points follow on their own.
          </span>
        </div>
      </div>

      <section className="group-block">
        <div className="section-label">When someone is recognised</div>
        <div className="group">
          <div className="group-item">
            <span style={{ flex: 1 }}>
              Points per appreciation
              <span className="caption" style={{ display: "block" }}>
                Every person thanked gets this automatically. Set 0 to turn points off.
              </span>
            </span>
            <Amount
              value={f.appreciationPoints}
              step={5}
              label="Points per appreciation"
              onChange={(v) => setF({ ...f, appreciationPoints: v })}
            />
          </div>
          <div className="group-item">
            <span style={{ flex: 1 }}>
              Monthly giving budget
              <span className="caption" style={{ display: "block" }}>
                {perMonth !== null
                  ? `Each person can thank about ${perMonth} ${perMonth === 1 ? "person" : "people"} a month`
                  : "Points per person each month"}
              </span>
            </span>
            <Amount value={f.monthlyBudget} step={50} label="Monthly giving budget" onChange={(v) => setF({ ...f, monthlyBudget: v })} />
          </div>
        </div>
      </section>

      <section className="group-block">
        <div className="section-label">Automatic bonuses</div>
        <div className="group">
          {AUTO.map((a) => {
            const r = f.rules[a.key];
            const st = stats[a.key];
            return (
              <div key={a.key} className="group-item auto-rule" data-off={!r.on || undefined}>
                <span className="task-icon" style={{ background: `color-mix(in srgb, ${a.color} 14%, transparent)`, color: a.color }}>
                  <Icon name={a.icon} size={17} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {a.label}
                  <span className="caption" style={{ display: "block" }}>
                    {a.hint}
                    {st.count ? ` · given ${st.count}× ${a.key === "welcome" ? "so far" : "this year"}` : ""}
                  </span>
                </span>
                <Amount
                  value={r.points}
                  step={10}
                  label={`${a.label} points`}
                  disabled={!r.on}
                  onChange={(v) => setRule(a.key, { points: v })}
                />
                <button
                  className="switch"
                  role="switch"
                  aria-checked={r.on}
                  aria-label={`${a.label} on`}
                  onClick={() => setRule(a.key, { on: !r.on })}
                />
              </div>
            );
          })}
        </div>
        <p className="group-footer">
          Birthdays and anniversaries are checked once a day. HR adds birthdays and joining dates in <Link href="/admin/users">Users</Link>.
          Nobody is ever paid twice for the same day.
        </p>
      </section>

      <section className="group-block">
        <div className="section-label">Badges</div>
        <div className="group">
          <div className="group-item">
            <span style={{ flex: 1 }}>
              Points for a new badge
              <span className="caption" style={{ display: "block" }}>
                Used when HR creates a badge. You can set any badge&apos;s points in <Link href="/admin/badges">Badge Studio</Link>.
              </span>
            </span>
            <Amount
              value={f.badgeDefaultPoints}
              step={10}
              label="Points for a new badge"
              onChange={(v) => setF({ ...f, badgeDefaultPoints: v })}
            />
          </div>
        </div>
      </section>

      <div className="save-bar" data-show={dirty || undefined}>
        <span className="caption" style={{ flex: 1 }}>
          {dirty ? "You have unsaved changes. They apply to everyone as soon as you save." : `Applies to all ${activeCount} active people.`}
        </span>
        {dirty && (
          <button className="btn btn-plain" onClick={() => setF(initial)}>
            Revert
          </button>
        )}
        <button className="btn btn-filled" disabled={!dirty || pending} onClick={save}>
          {pending ? "Saving…" : "Save Rules"}
        </button>
      </div>

      <div className="grid-2" style={{ marginTop: 28 }}>
        <section className="group-block" style={{ margin: 0 }}>
          <div className="section-label">Coming up · next 30 days</div>
          <div className="group">
            {upcoming.length === 0 && <div className="group-item caption">No birthdays or anniversaries coming up.</div>}
            {upcoming.slice(0, 6).map((u) => {
              const rule = f.rules[u.kind];
              return (
                <div key={u.id} className="group-item">
                  <Avatar name={u.name} size={30} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {u.name}
                    <span className="caption" style={{ display: "block" }}>
                      {u.kind === "birthday" ? "🎂 Birthday" : `🎉 ${u.years}-year anniversary`} ·{" "}
                      {u.inDays === 0 ? "today" : u.inDays === 1 ? "tomorrow" : `in ${u.inDays} days`}
                    </span>
                  </span>
                  <span className={`tag ${rule.on ? "tag-orange" : ""}`}>{rule.on ? `+${rule.points}` : "Off"}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="group-block" style={{ margin: 0 }}>
          <div className="section-label">Recently given automatically</div>
          <div className="group">
            {recent.length === 0 && <div className="group-item caption">Nothing yet.</div>}
            {recent.map((r) => (
              <div key={r.id} className="group-item">
                <Avatar name={r.name} size={30} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {r.name}
                  <span className="caption" style={{ display: "block" }}>
                    {r.note} · {timeAgo(r.at)}
                  </span>
                </span>
                <span className="num" style={{ color: "var(--green)", fontWeight: 700 }}>
                  +{r.delta}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
