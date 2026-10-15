import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { getFeed } from "@/lib/queries";
import { ModerationQueue } from "./ModerationQueue";

export const metadata = { title: "Moderation" };

export default async function ModerationPage() {
  const user = await requirePermission("moderation.manage");
  const reports = await db
    .select({ r: s.reports, reporter: s.users.name })
    .from(s.reports)
    .innerJoin(s.users, eq(s.reports.reporterId, s.users.id))
    .orderBy(desc(s.reports.createdAt));
  const open = reports.filter((x) => x.r.status === "open");
  const postIds = [...new Set(open.map((x) => x.r.postId))];
  const openPosts = (await Promise.all(postIds.map((id) => getFeed(user.id, { postId: id, includeHidden: true })))).flat();
  const hiddenPosts = (await getFeed(user.id, { includeHidden: true, limit: 200 })).filter((p) => p.hidden);

  return (
    <ModerationQueue
      items={openPosts.map((p) => ({
        post: p,
        reports: open
          .filter((x) => x.r.postId === p.id)
          .map((x) => ({ id: x.r.id, reason: x.r.reason, reporter: x.reporter, at: x.r.createdAt.getTime() })),
      }))}
      hidden={hiddenPosts}
    />
  );
}
