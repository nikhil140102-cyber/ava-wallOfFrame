import Link from "next/link";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getLeaderboard, getLevels, getPoints, levelFor } from "@/lib/queries";
import { Avatar, LevelPill } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PageHelp } from "@/components/PageHelp";

export const metadata = { title: "Leaderboard" };

const PERIODS = { week: { label: "This Week", days: 7 }, month: { label: "30 Days", days: 30 }, all: { label: "All Time", days: null } };

export default async function LeaderboardPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = sp.period && sp.period in PERIODS ? sp.period : "month";
  const dept = sp.dept ?? "";
  const [rows, depts, levels] = await Promise.all([
    getLeaderboard(PERIODS[period].days, dept || undefined),
    db.select().from(s.departments).orderBy(s.departments.name),
    getLevels(),
  ]);
  const points = await getPoints(rows.map((r) => r.id));
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const myRank = rows.findIndex((r) => r.id === user.id);
  const q = (p, d) => `/leaderboard?period=${p}${d ? `&dept=${d}` : ""}`;

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1 className="large-title">Leaderboard</h1>
          <p>Points received from appreciations and badges{myRank >= 0 ? ` · You're #${myRank + 1}` : ""}.</p>
        </div>
        <PageHelp topic="leaderboard" />
        <nav className="segmented" aria-label="Period">
          {Object.keys(PERIODS).map((p) => (
            <Link key={p} href={q(p, dept)} aria-selected={period === p} role="tab">
              {PERIODS[p].label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="toolbar">
        <Link href={q(period, "")} className="chip" aria-pressed={!dept}>
          Whole company
        </Link>
        {depts.map((d) => (
          <Link key={d.id} href={q(period, d.id)} className="chip" aria-pressed={dept === d.id}>
            {d.name}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="trophy" size={26} />
          </span>
          <h3>No points yet</h3>
          <p>Nobody has received points in this period. Recognition you give shows up here.</p>
        </div>
      ) : (
        <>
          <section className="podium">
            {[podium[1], podium[0], podium[2]].map((p, i) => {
              if (!p) return <div key={i} />;
              const place = p === podium[0] ? 1 : p === podium[1] ? 2 : 3;
              const lvl = levelFor(points.get(p.id).lifetime, levels);
              return (
                <Link key={p.id} href={`/people/${p.id}`} className="podium-place" data-place={place}>
                  <Avatar name={p.name} size={place === 1 ? 76 : 60} ring={lvl.current.color} />
                  <b>{p.name}</b>
                  <span className="caption">{p.department}</span>
                  <span className="podium-pts num">{p.points} pts</span>
                  <span className="podium-step">{place}</span>
                </Link>
              );
            })}
          </section>
          {rest.length > 0 && (
            <div className="group" style={{ marginTop: 24 }}>
              {rest.map((p, i) => {
                const lvl = levelFor(points.get(p.id).lifetime, levels);
                return (
                  <Link
                    key={p.id}
                    href={`/people/${p.id}`}
                    className="group-item indent"
                    style={p.id === user.id ? { background: "var(--accent-tint)" } : undefined}
                  >
                    <span className="rank num" style={{ width: 28 }}>
                      {i + 4}
                    </span>
                    <Avatar name={p.name} size={32} />
                    <span style={{ flex: 1 }}>
                      <b style={{ fontSize: 14 }}>{p.name}</b> {p.id === user.id && <span className="tag tag-accent">You</span>}
                      <span className="caption" style={{ display: "block" }}>
                        {p.title} · {p.department}
                      </span>
                    </span>
                    <LevelPill name={lvl.current.name} color={lvl.current.color} size="sm" />
                    <b className="num" style={{ width: 70, textAlign: "right" }}>
                      {p.points}
                    </b>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
