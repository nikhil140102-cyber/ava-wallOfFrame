"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { PulseQuestion } from "@/components/PulseQuestion";
import { deleteSurvey, saveSurvey, setSurveyActive } from "@/app/actions";

export const TYPES = [
  { key: "mood", label: "Mood (5 faces)", short: "Faces", preview: "😞 😐 😄", icon: "😊" },
  { key: "scale", label: "Rating (1–5 stars)", short: "Stars", preview: "★★★★★", icon: "★" },
  { key: "nps", label: "Score (0–10)", short: "0 – 10", preview: "0 … 10", icon: "🔟" },
  { key: "yesno", label: "Yes / No", short: "Yes / No", preview: "✓ ✕", icon: "✓" },
  { key: "choice", label: "Multiple choice (pick one)", short: "Pick one", preview: "◉ ○ ○", icon: "◉" },
  { key: "multi", label: "Checkboxes (pick several)", short: "Pick many", preview: "☑ ☑ ☐", icon: "☑" },
  { key: "text", label: "Written answer", short: "Written", preview: "✎ Aa", icon: "✎" },
];
const FREQ = { once: "One-time", daily: "Every day", weekly: "Every week" };
const STATUS = {
  open: ["Live", "tag-green"],
  upcoming: ["Scheduled", "tag-accent"],
  ended: ["Ended", ""],
  paused: ["Paused", "tag-orange"],
};

const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const TEMPLATES = (company) => [
  {
    name: "Weekly happiness check",
    hint: "3 questions · every week",
    survey: {
      title: "Weekly happiness check",
      intro: "Two minutes to tell us how this week felt. Answers are anonymous.",
      frequency: "weekly",
      anonymous: true,
      questions: [
        { type: "mood", prompt: "How did you feel at work this week?", options: [], required: true },
        { type: "scale", prompt: "How manageable was your workload?", options: [], required: true },
        { type: "text", prompt: "Anything we could do better?", options: [], required: false },
      ],
    },
  },
  {
    name: "Daily mood",
    hint: "1 question · every day",
    survey: {
      title: "Daily mood",
      intro: "One tap: how are you today?",
      frequency: "daily",
      anonymous: true,
      questions: [{ type: "mood", prompt: "How are you feeling today?", options: [], required: true }],
    },
  },
  {
    name: "Employee NPS (eNPS)",
    hint: "2 questions · one-time",
    survey: {
      title: "Would you recommend us?",
      intro: "Our quarterly employee Net Promoter Score.",
      frequency: "once",
      anonymous: true,
      questions: [
        { type: "nps", prompt: `How likely are you to recommend ${company} as a place to work?`, options: [], required: true },
        { type: "text", prompt: "What is the main reason for your score?", options: [], required: false },
      ],
    },
  },
  {
    name: "Satisfaction survey",
    hint: "5 questions · one-time",
    survey: {
      title: "How satisfied are you?",
      intro: "Help us understand what's working and what isn't.",
      frequency: "once",
      anonymous: true,
      questions: [
        { type: "scale", prompt: `Overall, how satisfied are you working at ${company}?`, options: [], required: true },
        { type: "scale", prompt: "I get the support I need from my manager", options: [], required: true },
        { type: "yesno", prompt: "Do you have the tools you need to do your job well?", options: [], required: true },
        {
          type: "choice",
          prompt: "What would help you most right now?",
          options: ["Clearer goals", "More recognition", "Learning opportunities", "Better tools", "Flexible hours"],
          required: true,
        },
        {
          type: "multi",
          prompt: "Which benefits matter most to you?",
          options: ["Health insurance", "Learning budget", "Work from home", "Team outings", "Extra leave"],
          required: false,
        },
      ],
    },
  },
];

const blankQ = (type = "mood") => ({ type, prompt: "", options: type === "choice" || type === "multi" ? ["", ""] : [], required: true });

function Builder({ today, company, onSaved }) {
  const { toast } = useApp();
  const empty = { title: "", intro: "", frequency: "weekly", anonymous: true, startsOn: today, endsOn: addDays(today, 56), questions: [blankQ()] };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState({});
  const setQ = (i, patch) => setF({ ...f, questions: f.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const move = (i, d) => {
    const qs = [...f.questions];
    const [x] = qs.splice(i, 1);
    qs.splice(i + d, 0, x);
    setF({ ...f, questions: qs });
  };

  async function save() {
    setBusy(true);
    const payload = {
      ...f,
      endsOn: f.endsOn || null,
      questions: f.questions.map((q) => {
        const opts = q.options.map((o) => o.trim());
        if (["scale", "nps"].includes(q.type)) return { ...q, options: opts[0] && opts[1] ? opts.slice(0, 2) : [] };
        return { ...q, options: opts.filter(Boolean) };
      }),
    };
    const r = await saveSurvey(payload);
    setBusy(false);
    if (!r.ok) return toast(r.error, { tone: "error" });
    toast(f.startsOn <= today ? "Survey is live. Everyone has been notified." : "Survey scheduled");
    setF(empty);
    onSaved();
  }

  return (
    <section className="group-block">
      <div className="section-label">New survey</div>
      <div className="card card-pad" style={{ display: "grid", gap: 16 }}>
        <div>
          <span className="field-label">Start from a template</span>
          <div className="pulse-templates">
            {TEMPLATES(company).map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                className="pulse-template"
                onClick={() => setF({ ...f, ...tpl.survey, questions: tpl.survey.questions.map((q) => ({ ...q, options: [...q.options] })) })}
              >
                <b>{tpl.name}</b>
                <span className="caption">{tpl.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="field-label">Title</span>
          <input className="field" maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Weekly happiness check" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="field-label">Intro (optional)</span>
          <input className="field" maxLength={300} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} placeholder="One line telling people why you're asking" />
        </label>

        <div className="pulse-sched">
          <div style={{ display: "grid", gap: 6 }}>
            <span className="field-label">How often</span>
            <div className="segmented" role="radiogroup" aria-label="How often">
              {Object.entries(FREQ).map(([k, v]) => (
                <button key={k} type="button" role="radio" aria-selected={f.frequency === k} aria-checked={f.frequency === k} onClick={() => setF({ ...f, frequency: k })}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Starts</span>
            <input type="date" className="field" min={today} value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Ends (optional)</span>
            <input type="date" className="field" min={f.startsOn} value={f.endsOn ?? ""} onChange={(e) => setF({ ...f, endsOn: e.target.value })} />
          </label>
        </div>
        <p className="caption" style={{ marginTop: -8 }}>
          {f.frequency === "once" && "Everyone can answer once while it's open."}
          {f.frequency === "daily" && "Everyone can answer once a day, every day it's open. Results are grouped by day."}
          {f.frequency === "weekly" && "Everyone can answer once a week (Monday–Sunday). Results are grouped by week."}
        </p>

        <div className="group" style={{ margin: 0 }}>
          <div className="group-item">
            <span style={{ flex: 1 }}>
              Anonymous answers
              <span className="caption" style={{ display: "block" }}>
                {f.anonymous
                  ? "You'll see totals and written answers, never who said what. Results show once 3 people have answered."
                  : "You'll see each person's name next to their answers. Tell people this in the intro."}
              </span>
            </span>
            <button className="switch" role="switch" aria-checked={f.anonymous} aria-label="Anonymous answers" onClick={() => setF({ ...f, anonymous: !f.anonymous })} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <span className="field-label">Questions</span>
          {f.questions.map((q, i) => (
            <div key={i} className="pulse-qedit">
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="pulse-q-num">{i + 1}</span>
                <span className="caption">{TYPES.find((t) => t.key === q.type)?.label}</span>
                <label className="caption row" style={{ gap: 6 }}>
                  <input type="checkbox" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} /> Required
                </label>
                <span style={{ flex: 1 }} />
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                  <Icon name="chevronDown" size={16} style={{ transform: "rotate(180deg)" }} />
                </button>
                <button className="icon-btn" disabled={i === f.questions.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                  <Icon name="chevronDown" size={16} />
                </button>
                <button
                  className="icon-btn"
                  disabled={f.questions.length === 1}
                  onClick={() => setF({ ...f, questions: f.questions.filter((_, j) => j !== i) })}
                  aria-label="Remove question"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <div className="pulse-typepick" role="radiogroup" aria-label={`Question ${i + 1}: answer type`}>
                {TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={q.type === t.key}
                    className="pulse-typetile"
                    onClick={() =>
                      setQ(i, { type: t.key, options: ["choice", "multi"].includes(t.key) ? (["choice", "multi"].includes(q.type) && q.options.length ? q.options : ["", ""]) : [] })
                    }
                  >
                    <span className="pulse-typeicon" aria-hidden="true">
                      {t.preview}
                    </span>
                    <span>{t.short}</span>
                  </button>
                ))}
              </div>
              <input className="field" maxLength={200} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} placeholder="Write the question" style={{ marginTop: 8 }} />
              {["scale", "nps"].includes(q.type) && (
                <div className="pulse-endlabels">
                  <input
                    className="field"
                    maxLength={40}
                    value={q.options[0] ?? ""}
                    onChange={(e) => setQ(i, { options: [e.target.value, q.options[1] ?? ""] })}
                    placeholder={q.type === "nps" ? "Low end label (default: Not likely)" : "Low end label (default: Not at all)"}
                    aria-label="Label for the lowest answer"
                  />
                  <input
                    className="field"
                    maxLength={40}
                    value={q.options[1] ?? ""}
                    onChange={(e) => setQ(i, { options: [q.options[0] ?? "", e.target.value] })}
                    placeholder={q.type === "nps" ? "High end label (default: Very likely)" : "High end label (default: Completely)"}
                    aria-label="Label for the highest answer"
                  />
                </div>
              )}
              {["choice", "multi"].includes(q.type) && (
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  {q.options.map((o, k) => (
                    <div key={k} className="row" style={{ gap: 6 }}>
                      <span className="caption" style={{ width: 18 }}>
                        {q.type === "choice" ? "◯" : "☐"}
                      </span>
                      <input
                        className="field"
                        style={{ height: 38 }}
                        maxLength={60}
                        value={o}
                        placeholder={`Option ${k + 1}`}
                        onChange={(e) => setQ(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })}
                      />
                      <button className="icon-btn" disabled={q.options.length <= 2} onClick={() => setQ(i, { options: q.options.filter((_, m) => m !== k) })} aria-label="Remove option">
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                  {q.options.length < 8 && (
                    <button className="btn btn-plain btn-sm" style={{ justifySelf: "start" }} onClick={() => setQ(i, { options: [...q.options, ""] })}>
                      <Icon name="plus" size={14} /> Add option
                    </button>
                  )}
                </div>
              )}
              <details className="pulse-preview">
                <summary>Preview what employees see</summary>
                <PulseQuestion
                  q={{ id: `preview-${i}`, ...q, prompt: q.prompt || "Your question", options: ["choice", "multi"].includes(q.type) ? q.options.filter((o) => o.trim()) : q.options }}
                  index={i}
                  value={previews[i]}
                  onChange={(v) => setPreviews({ ...previews, [i]: v })}
                />
              </details>
            </div>
          ))}
          {f.questions.length < 12 && (
            <button className="btn btn-gray" style={{ justifySelf: "start" }} onClick={() => setF({ ...f, questions: [...f.questions, blankQ("scale")] })}>
              <Icon name="plus" size={16} /> Add question
            </button>
          )}
        </div>

        <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-plain" onClick={() => setF(empty)}>
            Clear
          </button>
          <button className="btn btn-filled" disabled={busy || f.title.trim().length < 3} onClick={save}>
            <Icon name="send" size={16} /> {f.startsOn <= today ? "Publish now" : "Schedule"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function PulseAdmin({ surveys, today, company }) {
  const { toast } = useApp();
  const router = useRouter();
  return (
    <main className="page page-narrow">
      <header className="page-head">
        <div>
          <h1 className="large-title">Pulse Surveys</h1>
          <p>Ask everyone short questions, once or on a daily or weekly schedule, and see how satisfaction changes over time.</p>
        </div>
        <Link href="/admin/pulse/report" className="btn btn-tinted">
          <Icon name="chart" size={16} /> Satisfaction report
        </Link>
      </header>

      <section className="group-block">
        <div className="section-label">Your surveys ({surveys.length})</div>
        <div className="group">
          {surveys.length === 0 && <div className="group-item secondary">No surveys yet. Start from a template below.</div>}
          {surveys.map((sv) => {
            const [label, cls] = STATUS[sv.status];
            return (
              <div key={sv.id} className="group-item" style={{ alignItems: "flex-start" }}>
                <Link href={`/admin/pulse/${sv.id}`} style={{ flex: 1, minWidth: 0 }}>
                  <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <b dir="auto">{sv.title}</b>
                    <span className={`tag ${cls}`}>{label}</span>
                    {sv.anonymous && <span className="tag">Anonymous</span>}
                  </span>
                  <span className="caption" style={{ display: "block", marginTop: 2 }}>
                    {FREQ[sv.frequency]} · {sv.questions} questions · {sv.startsOn}
                    {sv.endsOn ? ` → ${sv.endsOn}` : " → no end date"} · {sv.responses} responses
                  </span>
                </Link>
                <Link href={`/admin/pulse/${sv.id}`} className="btn btn-sm btn-tinted">
                  Results
                </Link>
                <button
                  className="btn btn-sm btn-gray"
                  onClick={async () => {
                    const r = await setSurveyActive(sv.id, sv.status === "paused");
                    if (!r.ok) return toast(r.error, { tone: "error" });
                    toast(sv.status === "paused" ? "Resumed" : "Paused");
                    router.refresh();
                  }}
                >
                  {sv.status === "paused" ? "Resume" : "Pause"}
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Delete ${sv.title}`}
                  onClick={async () => {
                    if (!window.confirm(`Delete “${sv.title}” and all its answers? This can't be undone.`)) return;
                    const r = await deleteSurvey(sv.id);
                    if (!r.ok) return toast(r.error, { tone: "error" });
                    toast("Survey deleted");
                    router.refresh();
                  }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <Builder today={today} company={company} onSaved={() => router.refresh()} />
    </main>
  );
}
