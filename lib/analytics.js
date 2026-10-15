import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";

const DAY = 86_400_000;

/** Per-user activity in a window: appreciations given / received and last time they were recognised. */
export async function getActivity(sinceDays) {
  const since = new Date(Date.now() - sinceDays * DAY);
  const [given, received, lastRecognised] = await Promise.all([
    db
      .select({ userId: s.posts.authorId, n: sql`count(*)` })
      .from(s.posts)
      .where(and(eq(s.posts.kind, "appreciation"), gte(s.posts.createdAt, since)))
      .groupBy(s.posts.authorId),
    db
      .select({ userId: s.postRecipients.userId, n: sql`count(*)` })
      .from(s.postRecipients)
      .innerJoin(s.posts, eq(s.posts.id, s.postRecipients.postId))
      .where(and(eq(s.posts.kind, "appreciation"), gte(s.posts.createdAt, since)))
      .groupBy(s.postRecipients.userId),
    db
      .select({ userId: s.postRecipients.userId, at: sql`max(${s.posts.createdAt})` })
      .from(s.postRecipients)
      .innerJoin(s.posts, eq(s.posts.id, s.postRecipients.postId))
      .groupBy(s.postRecipients.userId),
  ]);
  return {
    given: new Map(given.map((r) => [r.userId, Number(r.n)])),
    received: new Map(received.map((r) => [r.userId, Number(r.n)])),
    last: new Map(lastRecognised.map((r) => [r.userId, Number(r.at)])),
  };
}

export async function countAppreciations(fromDaysAgo, toDaysAgo = 0) {
  const row = await db
    .select({ n: sql`count(*)` })
    .from(s.posts)
    .where(
      and(
        eq(s.posts.kind, "appreciation"),
        gte(s.posts.createdAt, new Date(Date.now() - fromDaysAgo * DAY)),
        lt(s.posts.createdAt, new Date(Date.now() - toDaysAgo * DAY))
      )
    )
    .get();
  return Number(row?.n ?? 0);
}

export async function weeklyCounts(weeks) {
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const n = await countAppreciations((w + 1) * 7, w * 7);
    const d = new Date(Date.now() - w * 7 * DAY);
    out.push({ label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), n });
  }
  return out;
}
