import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { statusOf } from "@/lib/pulse";
import { MIN_ANON, RATED, satisfactionOf, surveyData } from "@/lib/pulse-report";
import { Icon } from "@/components/Icon";
import { SAT_RULE, SatisfactionBar, SatisfactionMeter } from "@/components/SatisfactionMeter";

export const metadata = { title: "Pulse results" };
export const dynamic = "force-dynamic";

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
const FREQ = { once: "One-time", daily: "Every day", weekly: "Every week" };
const STATUS_LABEL = { open: "Live", upcoming: "Scheduled", ended: "Ended", paused: "Paused" };

const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const periodLabel = (freq, p) => (p === "once" ? "All answers" : freq === "weekly" ? `Week of ${fmtDay(p)}` : fmtDay(p));
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

function Bars({ rows, total }) {
  return (
    <div className="pulse-bars">
      {rows.map(([label, n]) => {
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <div key={label} className="pulse-bar">
            <span className="pulse-bar-label" dir="auto">
              {label}
            </span>
            <span className="pulse-bar-track">
              <span style={{ width: `${pct}%` }} />
            </span>
            <span className="pulse-bar-n num">
              {n} · {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function npsOf(nums) {
  if (!nums.length) return null;
  const pro = nums.filter((n) => n >= 9).length;
  const det = nums.filter((n) => n <= 6).length;
  return Math.round(((pro - det) / nums.length) * 100);
}

export default async function PulseResultsPage({ params, searchParams }) {
  await requirePermission("surveys.manage");
  const { id } = await params;
  const { p } = await searchParams;
  const data = await surveyData(id);
  if (!data) notFound();
  const { sv, questions, responses, answers } = data;
  const people = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.active, true));

  const periods = [...new Set(responses.map((r) => r.period))].sort().reverse();
  const recurring = sv.frequency !== "once";
  const selected = recurring && p && periods.includes(p) ? p : "all";
  // Anonymous surveys: a period with fewer than MIN_ANON answers is left out of "All time" too —
  // otherwise one person answering alone in a week could be picked out by their week label or by
  // how the totals changed.
  const periodCount = new Map();
  for (const r of responses) periodCount.set(r.period, (periodCount.get(r.period) ?? 0) + 1);
  const smallPeriods = sv.anonymous && recurring ? periods.filter((per) => periodCount.get(per) < MIN_ANON) : [];
  const inSel = responses.filter((r) => (selected === "all" ? !smallPeriods.includes(r.period) : r.period === selected));
  const selIds = new Set(inSel.map((r) => r.id));
  const respById = new Map(responses.map((r) => [r.id, r]));
  const hidden = sv.anonymous && inSel.length < MIN_ANON;
  const sat = satisfactionOf(questions, answers, selIds);
  const hasRated = questions.some((q) => RATED.includes(q.type));
  const rate = selected === "all" && recurring ? null : Math.round((inSel.length / Math.max(1, people.length)) * 100);

  // Trend: average per period for number questions (newest 12 periods, oldest first).
  const trendPeriods = periods.slice(0, 12).reverse();
  const periodSize = new Map(trendPeriods.map((per) => [per, responses.filter((r) => r.period === per).length]));

  return (
    <main className="page pulse-wide">
      <Link href="/admin/pulse" className="caption row" style={{ gap: 4, marginBottom: 10, color: "var(--accent)" }}>
        <Icon name="chevronDown" size={14} style={{ transform: "rotate(90deg)" }} /> All surveys
      </Link>
      <header className="page-head">
        <div>
          <h1 className="large-title" dir="auto">
            {sv.title}
          </h1>
          <p>
            {FREQ[sv.frequency]} · {sv.startsOn}
            {sv.endsOn ? ` → ${sv.endsOn}` : ""} · {STATUS_LABEL[statusOf(sv)]} · {sv.anonymous ? "Anonymous" : "Names visible"}
          </p>
        </div>
        {inSel.length > 0 && !hidden && (
          <a href={`/admin/pulse/report/download?survey=${sv.id}&p=${selected}`} className="btn btn-gray" download>
            <Icon name="inbox" size={16} /> Download report
          </a>
        )}
      </header>

      {recurring && periods.length > 0 && (
        <nav className="pulse-periods" aria-label="Period">
          <Link href={`?p=all`} aria-current={selected === "all" ? "page" : undefined}>
            All time
          </Link>
          {periods.slice(0, 14).map((per) => (
            <Link key={per} href={`?p=${per}`} aria-current={selected === per ? "page" : undefined}>
              {periodLabel(sv.frequency, per)}
            </Link>
          ))}
        </nav>
      )}

      <div className="pulse-kpis">
        <div className="card card-pad">
          <span className="caption">Responses</span>
          <b className="num">{inSel.length}</b>
          <span className="caption">
            {selected === "all" ? (recurring ? `across ${periods.length - smallPeriods.length} periods` : "so far") : periodLabel(sv.frequency, selected)}
          </span>
        </div>
        {rate !== null && (
          <div className="card card-pad">
            <span className="caption">Response rate</span>
            <b className="num">{rate}%</b>
            <span className="caption">of {people.length} people</span>
          </div>
        )}
        <div className="card card-pad">
          <span className="caption">Questions</span>
          <b className="num">{questions.length}</b>
          <span className="caption">{sv.anonymous ? "anonymous answers" : "named answers"}</span>
        </div>
      </div>

      {selected === "all" && smallPeriods.length > 0 && (
        <p className="caption pulse-heldback">
          <Icon name="eyeOff" size={13} /> Not included yet, to keep answers anonymous:{" "}
          {smallPeriods.map((per) => `${periodLabel(sv.frequency, per)} (${periodCount.get(per)} so far)`).join(", ")}. They appear once
          {` ${MIN_ANON}`} people have answered.
        </p>
      )}

      {inSel.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="inbox" size={26} />
          </span>
          <h3>No answers yet</h3>
          <p>Results appear here as soon as people start answering.</p>
        </div>
      ) : hidden ? (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="eyeOff" size={26} />
          </span>
          <h3>Waiting for {MIN_ANON - inSel.length} more {MIN_ANON - inSel.length === 1 ? "answer" : "answers"}</h3>
          <p>
            To keep this survey anonymous, results show once at least {MIN_ANON} people have answered
            {selected !== "all" ? " in this period" : ""}.
          </p>
        </div>
      ) : (
        <div className="pulse-results-grid">
          {hasRated && sat.people.total > 0 && (
            <SatisfactionMeter
              {...sat.people}
              unit={selected === "all" && recurring ? "responses" : "people"}
              title={`How happy people are${selected === "all" ? "" : ` · ${periodLabel(sv.frequency, selected)}`}`}
              note={`${SAT_RULE} With several rating questions, a person's answers are averaged.`}
              className="pulse-span"
            />
          )}
          {questions.map((q, i) => {
            const qa = answers.filter((a) => a.questionId === q.id && selIds.has(a.responseId));
            const nums = qa.map((a) => Number(a.value)).filter((n) => Number.isFinite(n));
            const trend =
              recurring && ["scale", "mood", "nps"].includes(q.type) && trendPeriods.length > 1
                ? trendPeriods
                    .map((per) => {
                      const vals = answers
                        .filter((a) => a.questionId === q.id && respById.get(a.responseId)?.period === per)
                        .map((a) => Number(a.value));
                      const ok = !sv.anonymous || (periodSize.get(per) ?? 0) >= MIN_ANON;
                      return { per, v: ok ? (q.type === "nps" ? npsOf(vals) : avg(vals)) : null };
                    })
                    .filter((x) => x.v !== null)
                : [];
            return (
              <section key={q.id} className={`card card-pad${q.type === "text" ? " pulse-span" : ""}`}>
                <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                  <span className="pulse-q-num">{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 className="headline" dir="auto">
                      {q.prompt}
                    </h2>
                    <span className="caption">
                      {qa.length} {qa.length === 1 ? "answer" : "answers"}
                    </span>
                  </div>
                  {(q.type === "scale" || q.type === "mood") && nums.length > 0 && (
                    <span className="pulse-score">
                      {q.type === "mood" && <span aria-hidden="true">{MOODS[Math.round(avg(nums)) - 1]}</span>}
                      <b className="num">{avg(nums).toFixed(1)}</b>
                      <span className="caption">/ 5</span>
                    </span>
                  )}
                  {q.type === "nps" && nums.length > 0 && (
                    <span className="pulse-score">
                      <b className="num">{npsOf(nums) > 0 ? `+${npsOf(nums)}` : npsOf(nums)}</b>
                      <span className="caption">eNPS</span>
                    </span>
                  )}
                </div>

                {sat.byQuestion.get(q.id)?.total > 0 && (
                  <div className="sat-q">
                    <SatisfactionBar {...sat.byQuestion.get(q.id)} thin />
                    <span className="caption">
                      <b className="sat-t-happy">{sat.byQuestion.get(q.id).happy} happy</b> · {sat.byQuestion.get(q.id).neutral} neutral ·{" "}
                      <b className="sat-t-unhappy">{sat.byQuestion.get(q.id).unhappy} not happy</b>
                    </span>
                  </div>
                )}
                {(q.type === "scale" || q.type === "mood") && (
                  <Bars
                    total={nums.length}
                    rows={[5, 4, 3, 2, 1].map((n) => [q.type === "mood" ? `${MOODS[n - 1]} ${n}` : `${"★".repeat(n)}`, nums.filter((x) => x === n).length])}
                  />
                )}
                {q.type === "nps" && (
                  <>
                    <Bars
                      total={nums.length}
                      rows={[
                        ["Promoters (9–10)", nums.filter((n) => n >= 9).length],
                        ["Passives (7–8)", nums.filter((n) => n === 7 || n === 8).length],
                        ["Detractors (0–6)", nums.filter((n) => n <= 6).length],
                      ]}
                    />
                    <p className="caption" style={{ marginTop: 8 }}>
                      eNPS = % promoters − % detractors (from −100 to +100). Above 0 is good, above +30 is great.
                    </p>
                  </>
                )}
                {q.type === "yesno" && (
                  <Bars
                    total={qa.length}
                    rows={[
                      ["Yes", qa.filter((a) => a.value === "yes").length],
                      ["No", qa.filter((a) => a.value === "no").length],
                    ]}
                  />
                )}
                {q.type === "choice" && <Bars total={qa.length} rows={(q.options ?? []).map((o) => [o, qa.filter((a) => a.value === o).length]).sort((a, b) => b[1] - a[1])} />}
                {q.type === "multi" && (
                  <>
                    <Bars
                      total={qa.length}
                      rows={(q.options ?? [])
                        .map((o) => [o, qa.filter((a) => JSON.parse(a.value || "[]").includes(o)).length])
                        .sort((a, b) => b[1] - a[1])}
                    />
                    <p className="caption" style={{ marginTop: 8 }}>
                      People could pick more than one, so percentages add up to more than 100%.
                    </p>
                  </>
                )}
                {q.type === "text" && (
                  <ul className="pulse-texts">
                    {qa
                      .map((a) => ({ a, r: respById.get(a.responseId) }))
                      .sort((x, y) => y.r.at - x.r.at)
                      .slice(0, 50)
                      .map(({ a, r }) => (
                        <li key={a.id}>
                          <span dir="auto">“{a.value}”</span>
                          <span className="caption">
                            {sv.anonymous ? "Anonymous" : r.name} · {recurring ? periodLabel(sv.frequency, r.period) : fmtDay(new Date(r.at.getTime() + 330 * 60_000).toISOString().slice(0, 10))}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}

                {trend.length > 1 && (
                  <div className="pulse-trend">
                    <span className="caption">Trend by {sv.frequency === "weekly" ? "week" : "day"}</span>
                    <div className="pulse-trend-bars">
                      {trend.map(({ per, v }) => {
                        const h = q.type === "nps" ? ((v + 100) / 200) * 100 : (v / 5) * 100;
                        return (
                          <div key={per} className="pulse-trend-col" title={`${periodLabel(sv.frequency, per)}: ${q.type === "nps" ? v : v.toFixed(1)}`}>
                            <span className="num">{q.type === "nps" ? v : v.toFixed(1)}</span>
                            <span className="pulse-trend-bar" style={{ height: `${Math.max(6, h)}%` }} />
                            <span className="caption">{fmtDay(per)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!sv.anonymous && q.type !== "text" && (
                  <details className="pulse-who">
                    <summary className="caption">Who answered what</summary>
                    <ul>
                      {qa.map((a) => (
                        <li key={a.id} className="caption">
                          {respById.get(a.responseId)?.name}: {q.type === "multi" ? JSON.parse(a.value).join(", ") : a.value}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
