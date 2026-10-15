import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { NotificationList } from "./NotificationList";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await db
    .select({ n: s.notifications, actor: s.users.name })
    .from(s.notifications)
    .leftJoin(s.users, eq(s.notifications.actorId, s.users.id))
    .where(eq(s.notifications.userId, user.id))
    .orderBy(desc(s.notifications.createdAt))
    .limit(100);
  const items = rows.map((r) => ({
    id: r.n.id,
    kind: r.n.kind,
    title: r.n.title,
    link: r.n.link,
    read: r.n.read,
    createdAt: r.n.createdAt.getTime(),
    actor: r.actor,
  }));
  return (
    <main className="page page-narrow">
      <NotificationList items={items} />
    </main>
  );
}
