import Link from "next/link";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { countAppreciations, getActivity, weeklyCounts } from "@/lib/analytics";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { formatDate, num } from "@/lib/format";
import { PageHelp } from "@/components/PageHelp";

export const metadata = { title: "Admin Overview" };

export default async function AdminOverview() {
  const user = await requirePermission("analytics.view");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [people, depts, activity, now30, prev30, weeks, values, pointsRow, pending] = await Promise.all([
    db
      .select({ id: s.users.id, name: s.users.name, title: s.users.title, departmentId: s.users.departmentId, joinedAt: s.users.joinedAt })
      .from(s.users)
      .where(eq(s.users.active, true)),
    db.select().from(s.departments).orderBy(s.departments.name),
    getActivity(30),
    countAppreciations(30),
    countAppreciations(60, 30),
    weeklyCounts(12),
    db
      .select({ name: s.companyValues.name, n: sql`count(${s.posts.id})` })
      .from(s.companyValues)
      .leftJoin(s.posts, and(eq(s.posts.valueId, s.companyValues.id), gte(s.posts.createdAt, since)))
      .groupBy(s.companyValues.id)
      .orderBy(sql`count(${s.posts.id}) desc`),
    db
      .select({ n: sql`coalesce(sum(${s.pointLedger.delta}),0)` })
      .from(s.pointLedger)
      .where(and(gte(s.pointLedger.createdAt, since), sql`${s.pointLedger.reason} in ('appreciation','badge')`))
      .get(),
    db
      .select({ n: sql`count(*)` })
      .from(s.redemptions)
      .where(eq(s.redemptions.status, "pending"))
      .get(),
  ]);

  const involved = (id) => (activity.given.get(id) ?? 0) + (activity.received.get(id) ?? 0) > 0;
  const participation = people.length ? Math.round((people.filter((p) => involved(p.id)).length / people.length) * 100) : 0;
  const delta = prev30 ? Math.round(((now30 - prev30) / prev30) * 100) : 100;
  const maxWeek = Math.max(1, ...weeks.map((w) => w.n));
  const maxValue = Math.max(1, ...values.map((v) => Number(v.n)));
  const deptRows = depts
    .map((d) => {
      const members = people.filter((p) => p.departmentId === d.id);
      const active = members.filter((p) => involved(p.id)).length;
      return { ...d, size: members.length, pct: members.length ? Math.round((active / members.length) * 100) : 0 };
    })
    .filter((d) => d.size > 0)
    .sort((a, b) => b.pct - a.pct);
  const quiet = people
    .filter((p) => !involved(p.id))
    .map((p) => ({ ...p, isNew: Date.now() - p.joinedAt.getTime() < 45 * 86_400_000 }))
    .slice(0, 6);

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1 className="large-title">Overview</h1>
          <p>Company-wide recognition · last 30 days</p>
        </div>
        <PageHelp topic="admin-overview" />
      </header>

      <div className="stat-grid">
        <div className="stat">
          <span className="caption">Participation</span>
          <b>{participation}%</b>
          <span className="caption">of {people.length} active people</span>
        </div>
        <div className="stat">
          <span className="caption">Appreciations</span>
          <b>{num(now30)}</b>
          <span className={`delta ${delta >= 0 ? "delta-up" : "delta-down"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs previous 30 days
          </span>
        </div>
        <div className="stat">
          <span className="caption">Points awarded</span>
          <b>{num(Number(pointsRow?.n ?? 0))}</b>
          <span className="caption">from appreciations and badges</span>
        </div>
        <Link href={user.can("rewards.manage") ? "/admin/rewards" : "/admin"} className="stat">
          <span className="caption">Pending redemptions</span>
          <b style={{ color: Number(pending?.n) ? "var(--orange)" : undefined }}>{Number(pending?.n ?? 0)}</b>
          <span className="caption">{user.can("rewards.manage") ? "Review now →" : "Waiting for HR"}</span>
        </Link>
      </div>

      <div className="grid-2" style={{ marginTop: 16, gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)" }}>
        <section className="card card-pad">
          <h2 className="headline">Appreciations per week</h2>
          <div className="bars" role="img" aria-label="Appreciations per week, last 12 weeks">
            {weeks.map((w, i) => (
              <div key={i} className="bar-col" title={`${w.label}: ${w.n}`}>
                <span className="bar-val num">{w.n || ""}</span>
                <span className="bar" style={{ height: `${(w.n / maxWeek) * 100}%`, opacity: i === weeks.length - 1 ? 1 : 0.55 }} />
                <span className="bar-label">{i % 2 === 1 ? w.label : ""}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card card-pad">
          <h2 className="headline" style={{ marginBottom: 14 }}>
            Most recognised values
          </h2>
          {values.map((v) => (
            <div key={v.name} style={{ marginBottom: 12 }}>
              <div className="row" style={{ fontSize: 14, marginBottom: 5 }}>
                <span style={{ flex: 1 }}>{v.name}</span>
                <b className="num">{Number(v.n)}</b>
              </div>
              <div className="progress">
                <span style={{ width: `${(Number(v.n) / maxValue) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: 16, gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)" }}>
        <section className="card card-pad">
          <h2 className="headline" style={{ marginBottom: 6 }}>
            Participation by department
          </h2>
          <p className="caption" style={{ marginBottom: 12 }}>
            Share of people who gave or received recognition
          </p>
          {deptRows.map((d) => (
            <div key={d.id} className="row" style={{ padding: "7px 0", fontSize: 14 }}>
              <span style={{ width: 130 }}>{d.name}</span>
              <div className="progress" style={{ flex: 1, height: 8 }}>
                <span
                  style={{ width: `${d.pct}%`, background: d.pct >= 60 ? "var(--green)" : d.pct >= 35 ? "var(--orange)" : "var(--red)" }}
                />
              </div>
              <b className="num" style={{ width: 44, textAlign: "right" }}>
                {d.pct}%
              </b>
              <span className="caption num" style={{ width: 54, textAlign: "right" }}>
                {d.size} ppl
              </span>
            </div>
          ))}
        </section>
        <section className="card card-pad">
          <h2 className="headline" style={{ marginBottom: 6 }}>
            Not yet involved
          </h2>
          <p className="caption" style={{ marginBottom: 8 }}>
            No recognition given or received in 30 days
          </p>
          {quiet.length === 0 && (
            <p className="caption" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Icon name="check" size={14} style={{ color: "var(--green)" }} /> Everyone is involved.
            </p>
          )}
          {quiet.map((p) => (
            <Link key={p.id} href={`/people/${p.id}`} className="rail-row">
              <Avatar name={p.name} size={30} />
              <span style={{ flex: 1 }}>
                <b>{p.name}</b>
                <span className="caption">{p.isNew ? `New · joined ${formatDate(p.joinedAt)}` : p.title}</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
