import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { TalkRoom } from "./TalkRoom";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("talk.title") };
}

// Open Talk: everyone can post, with their name or anonymously.
// For anonymous messages the author is removed HERE, on the server — it never reaches anyone's browser.
export default async function TalkPage() {
  const user = await requireUser();
  const canModerate = user.can("moderation.manage");
  const rows = await db
    .select({
      id: s.talkMessages.id,
      body: s.talkMessages.body,
      anonymous: s.talkMessages.anonymous,
      replyToId: s.talkMessages.replyToId,
      reports: s.talkMessages.reports,
      createdAt: s.talkMessages.createdAt,
      authorId: s.talkMessages.authorId,
      name: s.users.name,
      title: s.users.title,
    })
    .from(s.talkMessages)
    .leftJoin(s.users, eq(s.users.id, s.talkMessages.authorId))
    .orderBy(desc(s.talkMessages.createdAt))
    .limit(150);
  const messages = rows.reverse().map((r) => ({
    id: r.id,
    body: r.body,
    replyToId: r.replyToId,
    at: r.createdAt.getTime(),
    anonymous: r.anonymous,
    author: r.anonymous ? null : { id: r.authorId, name: r.name ?? "", title: r.title ?? "" },
    mine: r.authorId === user.id,
    reports: canModerate ? r.reports : 0,
  }));
  return <TalkRoom messages={messages} canModerate={canModerate} />;
}
