import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { BadgeBrowser } from "./BadgeBrowser";

export const metadata = { title: "Badges" };

export default async function BadgesPage() {
  const user = await requireUser();
  const [badges, holders] = await Promise.all([
    db.select().from(s.badges).orderBy(s.badges.category, s.badges.points),
    db
      .select({ badgeId: s.userBadges.badgeId, userId: s.users.id, name: s.users.name, title: s.users.title, at: s.userBadges.awardedAt })
      .from(s.userBadges)
      .innerJoin(s.users, eq(s.userBadges.userId, s.users.id)),
  ]);
  const data = badges
    .filter((b) => b.active || holders.some((h) => h.badgeId === b.id && h.userId === user.id))
    .map((b) => {
      const h = holders.filter((x) => x.badgeId === b.id);
      const mine = h.find((x) => x.userId === user.id);
      return {
        ...b,
        earnedAt: mine ? mine.at.getTime() : null,
        holders: h.map((x) => ({ id: x.userId, name: x.name, title: x.title })),
      };
    });
  return <BadgeBrowser badges={data.map(({ createdAt: _c, createdById: _b, ...b }) => b)} canManage={user.can("badges.manage")} />;
}
