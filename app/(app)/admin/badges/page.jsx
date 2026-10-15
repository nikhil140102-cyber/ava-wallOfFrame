import { sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { BadgeManager } from "./BadgeManager";

export const metadata = { title: "Badge Studio" };

export default async function BadgeAdminPage() {
  await requirePermission("badges.manage");
  const [badges, counts, settings] = await Promise.all([
    db.select().from(s.badges).orderBy(s.badges.category, s.badges.points),
    db
      .select({ badgeId: s.userBadges.badgeId, n: sql`count(*)` })
      .from(s.userBadges)
      .groupBy(s.userBadges.badgeId),
    getSettings(),
  ]);
  const held = new Map(counts.map((c) => [c.badgeId, Number(c.n)]));
  return (
    <BadgeManager
      defaultPoints={settings.badgeDefaultPoints}
      badges={badges.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        criteria: b.criteria,
        category: b.category,
        icon: b.icon,
        color: b.color,
        points: b.points,
        active: b.active,
        holders: held.get(b.id) ?? 0,
      }))}
    />
  );
}
