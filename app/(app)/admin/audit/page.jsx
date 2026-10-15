import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { formatDate, timeAgo } from "@/lib/format";
import { PageHelp } from "@/components/PageHelp";

export const metadata = { title: "Audit Log" };

export default async function AuditPage() {
  await requirePermission("audit.view");
  const rows = await db
    .select({ a: s.auditLogs, actor: s.users.name })
    .from(s.auditLogs)
    .leftJoin(s.users, eq(s.auditLogs.actorId, s.users.id))
    .orderBy(desc(s.auditLogs.createdAt))
    .limit(200);
  return (
    <main className="page" style={{ maxWidth: 960 }}>
      <header className="page-head">
        <div>
          <h1 className="large-title">Audit Log</h1>
          <p>Every change to roles, people, rewards and settings. Kept permanently.</p>
        </div>
        <PageHelp topic="admin-audit" />
      </header>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, actor }) => (
              <tr key={a.id}>
                <td className="caption" title={formatDate(a.createdAt)} style={{ whiteSpace: "nowrap" }}>
                  {timeAgo(a.createdAt.getTime())}
                </td>
                <td>
                  <span className="row" style={{ gap: 8 }}>
                    <Avatar name={actor ?? "System"} size={24} />
                    <span style={{ whiteSpace: "nowrap" }}>{actor ?? "System"}</span>
                  </span>
                </td>
                <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{a.action}</td>
                <td className="secondary">{a.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">No changes recorded yet.</div>}
      </div>
    </main>
  );
}
