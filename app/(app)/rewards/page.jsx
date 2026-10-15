import { and, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getPoints } from "@/lib/queries";
import { RewardStore } from "./RewardStore";

export const metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const user = await requireUser();
  const [rewards, mine, points] = await Promise.all([
    db.select().from(s.rewards).where(eq(s.rewards.active, true)).orderBy(s.rewards.cost),
    db
      .select({ r: s.redemptions, name: s.rewards.name, icon: s.rewards.icon })
      .from(s.redemptions)
      .innerJoin(s.rewards, eq(s.redemptions.rewardId, s.rewards.id))
      .where(and(eq(s.redemptions.userId, user.id)))
      .orderBy(desc(s.redemptions.createdAt)),
    getPoints([user.id]),
  ]);
  const pts = points.get(user.id);
  return (
    <RewardStore
      balance={pts.balance}
      lifetime={pts.lifetime}
      canRedeem={user.can("rewards.redeem")}
      rewards={rewards.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        icon: r.icon,
        cost: r.cost,
      }))}
      history={mine.map((m) => ({
        id: m.r.id,
        name: m.name,
        icon: m.icon,
        cost: m.r.cost,
        status: m.r.status,
        createdAt: m.r.createdAt.getTime(),
        note: m.r.note,
      }))}
    />
  );
}
