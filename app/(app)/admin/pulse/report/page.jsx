import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { companyReport, pct } from "@/lib/pulse-report";
import { Icon } from "@/components/Icon";
import { SAT_RULE, SatisfactionBar, SatisfactionMeter } from "@/components/SatisfactionMeter";

export const metadata = { title: "Satisfaction report" };
export const dynamic = "force-dynamic";

const RANGES = [
  ["30", "Last 30 days", 30],
  ["90", "Last 90 days", 90],
  ["all", "All time", null],
];
const FREQ = { once: "One-time", daily: "Daily", weekly: "Weekly" };
const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// Company-wide: across every Pulse survey, how many answers were happy, neutral or not happy.
export default async function SatisfactionReportPage({ searchParams }) {
  await requirePermission("surveys.manage");
  const { range: r } = await searchParams;
  const range = RANGES.find(([k]) => k === r) ?? RANGES[0];
  const { rows, overall, weeks } = await companyReport(range[2]);

  return (
    <main className="page pulse-wide">
      <Link href="/admin/pulse" className="caption row" style={{ gap: 4, marginBottom: 10, color: "var(--accent)" }}>
        <Icon name="chevronDown" size={14} style={{ transform: "rotate(90deg)" }} /> Pulse surveys
      </Link>
      <header className="page-head">
        <div>
          <h1 className="large-title">Satisfaction report</h1>
          <p>How happy people are across all Pulse surveys: who is satisfied, who is neutral and who is not.</p>
        </div>
        {overall.total > 0 && (
          <a href={`/admin/pulse/report/download?range=${range[0]}`} className="btn btn-gray" download>
            <Icon name="inbox" size={16} /> Download report
          </a>
        )}
      </header>

      <nav className="pulse-periods" aria-label="Time range">
        {RANGES.map(([k, label]) => (
          <Link key={k} href={`?range=${k}`} aria-current={k === range[0] ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      {overall.total === 0 ? (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="chart" size={26} />
          </span>
          <h3>No ratings yet</h3>
          <p>Once people answer surveys with faces, stars or 0–10 questions, the report fills in here.</p>
        </div>
      ) : (
        <div className="pulse-results-grid">
          <SatisfactionMeter className={weeks.length > 1 ? "" : "pulse-span"} {...overall} unit="responses" title={`Everyone · ${range[1].toLowerCase()}`} note={SAT_RULE} />

          {weeks.length > 1 && (
            <section className="card card-pad">
              <h2 className="headline">Week by week</h2>
              <span className="caption">Share of happy responses each week</span>
              <div className="sat-weeks">
                {weeks.map((w) => (
                  <div key={w.week} className="sat-week" title={`Week of ${fmtDay(w.week)}: ${w.happy} happy, ${w.neutral} neutral, ${w.unhappy} not happy`}>
                    <span className="num">{pct(w.happy, w.total)}%</span>
                    <div className="sat-week-col">
                      <span className="sat-unhappy" style={{ flexGrow: w.unhappy }} />
                      <span className="sat-neutral" style={{ flexGrow: w.neutral }} />
                      <span className="sat-happy" style={{ flexGrow: w.happy }} />
                    </div>
                    <span className="caption">{fmtDay(w.week)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="group-block pulse-span">
            <div className="section-label">By survey</div>
            <div className="group">
              {rows.map((row) => (
                <Link key={row.id} href={`/admin/pulse/${row.id}`} className="group-item sat-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <b dir="auto">{row.title}</b>
                      <span className="caption">
                        {FREQ[row.frequency]}
                        {row.anonymous ? " · anonymous" : ""}
                      </span>
                    </span>
                    {row.total > 0 ? (
                      <>
                        <SatisfactionBar {...row} thin />
                        <span className="caption">
                          <b className="sat-t-happy">{row.happy} happy</b> · {row.neutral} neutral · <b className="sat-t-unhappy">{row.unhappy} not happy</b> · {row.total}{" "}
                          {row.total === 1 ? "response" : "responses"}
                        </span>
                      </>
                    ) : (
                      <span className="caption sat-held">
                        <Icon name="eyeOff" size={12} /> Hidden until 3 people have answered, to keep it anonymous
                      </span>
                    )}
                    {row.total > 0 && row.waiting > 0 && (
                      <span className="caption sat-held">
                        <Icon name="eyeOff" size={12} /> {row.waiting} more {row.waiting === 1 ? "answer is" : "answers are"} held back until enough people answer
                      </span>
                    )}
                  </div>
                  {row.total > 0 && <b className="sat-row-pct num">{pct(row.happy, row.total)}%</b>}
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
