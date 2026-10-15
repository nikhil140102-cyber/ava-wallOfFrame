import { desc, eq, like } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { autoStats } from "@/lib/autopoints";
import { PointRules } from "./PointRules";

export const metadata = { title: "Points Rules" };

const DAY = 86_400_000;

/** Birthdays and work anniversaries coming up in the next `days` days. */
function upcoming(people, days = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * DAY);
    const md = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (const p of people) {
      if (p.birthday === md) out.push({ id: `b-${p.id}`, kind: "birthday", name: p.name, inDays: i, date: d.getTime() });
      const j = p.joinedAt;
      const years = d.getFullYear() - j.getFullYear();
      if (years >= 1 && j.getMonth() === d.getMonth() && j.getDate() === d.getDate())
        out.push({ id: `a-${p.id}`, kind: "anniversary", name: p.name, inDays: i, date: d.getTime(), years });
    }
  }
  return out;
}

export default async function PointsRulesPage() {
  await requirePermission("points.manage");
  const [settings, stats, people, recent] = await Promise.all([
    getSettings(),
    autoStats(),
    db
      .select({ id: s.users.id, name: s.users.name, birthday: s.users.birthday, joinedAt: s.users.joinedAt })
      .from(s.users)
      .where(eq(s.users.active, true)),
    db
      .select({
        id: s.pointLedger.id,
        delta: s.pointLedger.delta,
        note: s.pointLedger.note,
        at: s.pointLedger.createdAt,
        name: s.users.name,
      })
      .from(s.pointLedger)
      .innerJoin(s.users, eq(s.users.id, s.pointLedger.userId))
      .where(like(s.pointLedger.refId, "auto:%"))
      .orderBy(desc(s.pointLedger.createdAt))
      .limit(8),
  ]);
  return (
    <PointRules
      initial={{
        appreciationPoints: settings.appreciationPoints,
        monthlyBudget: settings.monthlyBudget,
        badgeDefaultPoints: settings.badgeDefaultPoints,
        rules: settings.rules,
      }}
      stats={stats}
      activeCount={people.length}
      upcoming={upcoming(people)}
      recent={recent.map((r) => ({ ...r, at: r.at.getTime() }))}
    />
  );
}
