import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { getActivity } from "@/lib/analytics";
import { getLevels, getPoints, levelFor } from "@/lib/queries";
import { TeamTable } from "./TeamTable";
import { PageHelp } from "@/components/PageHelp";

export const metadata = { title: "My Team" };

export default async function TeamPage() {
  const user = await requirePermission("team.view");
  const reports = await db
    .select({ id: s.users.id, name: s.users.name, title: s.users.title, joinedAt: s.users.joinedAt, active: s.users.active })
    .from(s.users)
    .where(eq(s.users.managerId, user.id))
    .orderBy(s.users.name);
  const active = reports.filter((r) => r.active);
  const [activity, levels, points] = await Promise.all([getActivity(30), getLevels(), getPoints(active.map((r) => r.id))]);
  const rows = active.map((r) => {
    const lvl = levelFor(points.get(r.id).lifetime, levels);
    const given = activity.given.get(r.id) ?? 0;
    const received = activity.received.get(r.id) ?? 0;
    return {
      id: r.id,
      name: r.name,
      title: r.title,
      level: { name: lvl.current.name, color: lvl.current.color },
      given,
      received,
      lastRecognised: activity.last.get(r.id) ?? null,
      newJoiner: Date.now() - r.joinedAt.getTime() < 45 * 86_400_000,
      quiet: given === 0,
    };
  });
  const participating = rows.filter((r) => r.given + r.received > 0).length;
  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1 className="large-title">My Team</h1>
          <p>
            {rows.length} direct {rows.length === 1 ? "report" : "reports"} · last 30 days
          </p>
        </div>
        <PageHelp topic="team" />
      </header>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat">
          <span className="caption">Participation</span>
          <b>{rows.length ? Math.round((participating / rows.length) * 100) : 0}%</b>
          <span className="caption">gave or received recognition</span>
        </div>
        <div className="stat">
          <span className="caption">Appreciations given</span>
          <b>{rows.reduce((n, r) => n + r.given, 0)}</b>
        </div>
        <div className="stat">
          <span className="caption">Appreciations received</span>
          <b>{rows.reduce((n, r) => n + r.received, 0)}</b>
        </div>
        <div className="stat">
          <span className="caption">Quiet this month</span>
          <b style={{ color: rows.some((r) => r.quiet) ? "var(--orange)" : undefined }}>{rows.filter((r) => r.quiet).length}</b>
          <span className="caption">haven&apos;t recognised anyone</span>
        </div>
      </div>
      <TeamTable rows={rows} canNudge={user.can("team.nudge")} canAward={user.can("badges.award")} />
    </main>
  );
}
