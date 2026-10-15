import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { getLevels, getPoints } from "@/lib/queries";
import { LevelEditor } from "./LevelEditor";

export const metadata = { title: "Levels" };

export default async function LevelsPage() {
  await requirePermission("levels.manage");
  const [levels, users] = await Promise.all([getLevels(), db.select({ id: s.users.id }).from(s.users).where(eq(s.users.active, true))]);
  const points = await getPoints(users.map((u) => u.id));
  return <LevelEditor levels={levels} lifetimes={[...points.values()].map((p) => p.lifetime)} />;
}
