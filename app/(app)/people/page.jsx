import Link from "next/link";
import { and, eq, like, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getLevels, getPoints, levelFor } from "@/lib/queries";
import { Avatar, LevelPill } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PageHelp } from "@/components/PageHelp";

export const metadata = { title: "People" };

export default async function PeoplePage({ searchParams }) {
  await requireUser();
  const { q = "", dept = "" } = await searchParams;
  const depts = await db.select().from(s.departments).orderBy(s.departments.name);
  const term = `%${q.trim()}%`;
  const people = await db
    .select({ id: s.users.id, name: s.users.name, title: s.users.title, department: s.departments.name, city: s.users.city })
    .from(s.users)
    .leftJoin(s.departments, eq(s.users.departmentId, s.departments.id))
    .where(
      and(
        eq(s.users.active, true),
        dept ? eq(s.users.departmentId, dept) : undefined,
        q ? or(like(s.users.name, term), like(s.users.title, term)) : undefined
      )
    )
    .orderBy(s.users.name);
  const [levels, points] = await Promise.all([getLevels(), getPoints(people.map((p) => p.id))]);

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1 className="large-title">People</h1>
          <p>
            {people.length} {people.length === 1 ? "person" : "people"}
            {dept ? ` in ${depts.find((d) => d.id === dept)?.name}` : " across the company"}
          </p>
        </div>
        <PageHelp topic="people" />
      </header>

      <form className="toolbar" action="/people">
        <label className="search" style={{ width: 280 }}>
          <Icon name="search" size={16} />
          <input name="q" defaultValue={q} placeholder="Search name or title" aria-label="Search people" />
        </label>
        {dept && <input type="hidden" name="dept" value={dept} />}
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <Link href={`/people${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="chip" aria-pressed={!dept}>
            All
          </Link>
          {depts.map((d) => (
            <Link
              key={d.id}
              href={`/people?dept=${d.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="chip"
              aria-pressed={dept === d.id}
            >
              {d.name}
            </Link>
          ))}
        </div>
      </form>

      {people.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="search" size={26} />
          </span>
          <h3>No one found</h3>
          <p>Try a different name, or clear the department filter.</p>
        </div>
      ) : (
        <div className="people-grid">
          {people.map((p) => {
            const lvl = levelFor(points.get(p.id).lifetime, levels);
            return (
              <Link key={p.id} href={`/people/${p.id}`} className="person-card">
                <Avatar name={p.name} size={64} ring={lvl.current.color} />
                <b>{p.name}</b>
                <span className="caption">{p.title}</span>
                <span className="caption">{p.department}</span>
                <span style={{ marginTop: 8 }}>
                  <LevelPill name={lvl.current.name} color={lvl.current.color} size="sm" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
