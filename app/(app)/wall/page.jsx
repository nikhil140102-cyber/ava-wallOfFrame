import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getPeopleLite } from "@/lib/queries";
import { getOnThisDay, getWall, yearsSince } from "@/lib/memories";
import { MemoryWall } from "./MemoryWall";

export const metadata = { title: "Memory Wall" };

export default async function WallPage({ searchParams }) {
  const me = await requireUser();
  const sp = await searchParams;
  const everyone = sp.u === "all";
  const targetId = everyone ? me.id : sp.u || me.id;
  const target = await db
    .select({ id: s.users.id, name: s.users.name, title: s.users.title, joinedAt: s.users.joinedAt, managerId: s.users.managerId })
    .from(s.users)
    .where(eq(s.users.id, targetId))
    .get();
  if (!target) notFound();

  const people = await getPeopleLite();
  const thisYear = new Date().getFullYear();
  const years = everyone ? [thisYear, thisYear - 1, thisYear - 2] : yearsSince(target.joinedAt);
  const year = years.includes(Number(sp.y)) ? Number(sp.y) : years[0];

  const items = await getWall({
    userIds: everyone ? people.map((p) => p.id) : [target.id],
    year,
    viewer: me,
    highlights: everyone,
  });
  const onThisDay = !everyone && target.id === me.id && year === thisYear ? await getOnThisDay({ userId: me.id, viewer: me }) : [];
  // You can pin moments on your own wall; managers on their team's; HR and Super Admin on anyone's.
  const canPin = !everyone && (target.id === me.id || me.can("users.manage") || (me.can("team.view") && target.managerId === me.id));

  return (
    <MemoryWall
      key={`${everyone ? "all" : target.id}-${year}`}
      items={items}
      mode={everyone ? "all" : target.id === me.id ? "mine" : "person"}
      target={{ id: target.id, name: target.name, title: target.title }}
      meId={me.id}
      people={people.map((p) => ({ id: p.id, name: p.name }))}
      years={years}
      year={year}
      canPin={canPin}
      onThisDay={onThisDay}
    />
  );
}
