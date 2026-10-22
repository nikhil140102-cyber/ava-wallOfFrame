import Link from "next/link";
import { and, eq, like, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getLevels, getPoints, levelFor } from "@/lib/queries";
import { Avatar, LevelPill } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PageHelp } from "@/components/PageHelp";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("people.title") };
}

export default async function PeoplePage({ searchParams }) {
  await requireUser();
  const { t, fmt } = await getI18n();
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
          <h1 className="large-title">{t("people.title")}</h1>
          <p>
            {dept
              ? t("people.countDept", {
                  count: people.length,
                  n: fmt.num(people.length),
                  dept: depts.find((d) => d.id === dept)?.name ?? "",
                })
              : t("people.countCompany", { count: people.length, n: fmt.num(people.length) })}
          </p>
        </div>
        <PageHelp topic="people" />
      </header>

      <form className="toolbar" action="/people">
        <label className="search" style={{ width: 280 }}>
          <Icon name="search" size={16} />
          <input name="q" defaultValue={q} placeholder={t("people.searchPlaceholder")} aria-label={t("people.searchLabel")} />
        </label>
        {dept && <input type="hidden" name="dept" value={dept} />}
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <Link href={`/people${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="chip" aria-pressed={!dept}>
            {t("people.all")}
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
          <h3>{t("people.empty.title")}</h3>
          <p>{t("people.empty.body")}</p>
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
