import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { AnnouncementsEditor } from "./AnnouncementsEditor";

export const metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

// Only HR Admin, Super Admin (or any role given "Post announcements") can open this page.
export default async function AnnouncementsPage() {
  await requirePermission("feed.announce");
  const rows = await db
    .select({
      id: s.announcements.id,
      text: s.announcements.text,
      tone: s.announcements.tone,
      endsAt: s.announcements.endsAt,
      active: s.announcements.active,
      createdAt: s.announcements.createdAt,
      author: s.users.name,
    })
    .from(s.announcements)
    .leftJoin(s.users, eq(s.users.id, s.announcements.createdBy))
    .orderBy(desc(s.announcements.createdAt))
    .limit(60);
  const now = Date.now();
  const list = rows.map((r) => ({
    id: r.id,
    text: r.text,
    tone: r.tone,
    author: r.author ?? "",
    createdAt: r.createdAt?.getTime() ?? 0,
    endsAt: r.endsAt?.getTime() ?? null,
    live: r.active && (!r.endsAt || r.endsAt.getTime() > now),
  }));
  return <AnnouncementsEditor list={list} />;
}
