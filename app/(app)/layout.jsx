import { and, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getGivenThisMonth, getLevels, getPeopleLite, getPoints, getSettings, getUnreadCount, levelFor } from "@/lib/queries";
import { AppShell } from "@/components/shell/AppShell";
import { runDailyAutoPoints } from "@/lib/autopoints";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }) {
  const user = await requireUser();
  // Birthdays and work anniversaries: the first visit of the day hands out today's automatic points.
  await runDailyAutoPoints();
  const [settings, levels, points, used, unread, people, values, badges] = await Promise.all([
    getSettings(),
    getLevels(),
    getPoints([user.id]),
    getGivenThisMonth(user.id),
    getUnreadCount(user.id),
    getPeopleLite(),
    db
      .select({ id: s.companyValues.id, name: s.companyValues.name, description: s.companyValues.description })
      .from(s.companyValues)
      .where(eq(s.companyValues.active, true)),
    db
      .select({ id: s.badges.id, name: s.badges.name, icon: s.badges.icon, color: s.badges.color, category: s.badges.category })
      .from(s.badges)
      .where(eq(s.badges.active, true))
      .orderBy(s.badges.category, s.badges.name),
  ]);
  const pts = points.get(user.id);
  const lvl = levelFor(pts.lifetime, levels);

  const pendingRedemptions = user.can("rewards.manage")
    ? Number(
        (
          await db
            .select({ n: sql`count(*)` })
            .from(s.redemptions)
            .where(eq(s.redemptions.status, "pending"))
            .get()
        )?.n ?? 0
      )
    : 0;
  const openReports = user.can("moderation.manage")
    ? Number(
        (
          await db
            .select({ n: sql`count(distinct ${s.reports.postId})` })
            .from(s.reports)
            .where(and(eq(s.reports.status, "open")))
            .get()
        )?.n ?? 0
      )
    : 0;

  const data = {
    companyName: settings.companyName,
    me: {
      id: user.id,
      name: user.name,
      title: user.title,
      department: user.department,
      roleName: user.role.name,
      roleColor: user.role.color,
    },
    permissions: [...user.permissions],
    level: {
      name: lvl.current.name,
      color: lvl.current.color,
      nextName: lvl.next?.name ?? null,
      progress: lvl.progress,
      toNext: lvl.toNext,
    },
    balance: pts.balance,
    budget: { monthly: settings.monthlyBudget, used },
    appreciationPoints: settings.appreciationPoints,
    allowSelf: settings.allowSelf,
    unread,
    pendingRedemptions,
    openReports,
    people,
    values,
    badges,
  };

  return <AppShell data={data}>{children}</AppShell>;
}
