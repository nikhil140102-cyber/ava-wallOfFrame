import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { RewardAdmin } from "./RewardAdmin";

export const metadata = { title: "Reward Approvals" };

export default async function RewardAdminPage() {
  await requirePermission("rewards.manage");
  const decider = alias(s.users, "decider");
  const [requests, rewards] = await Promise.all([
    db
      .select({
        r: s.redemptions,
        reward: s.rewards.name,
        icon: s.rewards.icon,
        user: s.users.name,
        userId: s.users.id,
        decidedBy: decider.name,
      })
      .from(s.redemptions)
      .innerJoin(s.rewards, eq(s.redemptions.rewardId, s.rewards.id))
      .innerJoin(s.users, eq(s.redemptions.userId, s.users.id))
      .leftJoin(decider, eq(s.redemptions.decidedById, decider.id))
      .orderBy(desc(s.redemptions.createdAt)),
    db.select().from(s.rewards).orderBy(s.rewards.cost),
  ]);
  return (
    <RewardAdmin
      requests={requests.map((x) => ({
        id: x.r.id,
        reward: x.reward,
        icon: x.icon,
        user: x.user,
        userId: x.userId,
        cost: x.r.cost,
        status: x.r.status,
        note: x.r.note,
        createdAt: x.r.createdAt.getTime(),
        decidedAt: x.r.decidedAt?.getTime() ?? null,
        decidedBy: x.decidedBy,
      }))}
      rewards={rewards}
    />
  );
}
