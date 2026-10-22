import "server-only";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getLevels, getSettings } from "./queries";

// The Memory Wall is built on the fly from what already happened in the app, so it fills itself in:
// thank-yous received, badges earned, level-ups, birthdays, work anniversaries, joining, rewards,
// bonus points and photos shared — plus the skills and achievements people pin themselves.

export const MEMORY_KINDS = {
  appreciation: { label: "Thank-you", icon: "sparkles", color: "#3355E6" },
  badge: { label: "Badge", icon: "award", color: "#7C3AED" },
  level: { label: "Level up", icon: "trophy", color: "#D97706" },
  birthday: { label: "Birthday", icon: "gift", color: "#DB2777" },
  anniversary: { label: "Anniversary", icon: "calendar", color: "#E8890C" },
  joined: { label: "Joined", icon: "personPlus", color: "#0891B2" },
  reward: { label: "Reward", icon: "gift", color: "#059669" },
  bonus: { label: "Bonus", icon: "star", color: "#E8890C" },
  shared: { label: "Shared", icon: "image", color: "#0F766E" },
  skill: { label: "Skill learned", icon: "book", color: "#0D9488" },
  certification: { label: "Certification", icon: "shield", color: "#4F46E5" },
  achievement: { label: "Achievement", icon: "trophy", color: "#CA8A04" },
  moment: { label: "Moment", icon: "heart", color: "#E11D48" },
};

/** Kinds shown on the company-wide wall (personal money matters like rewards stay on your own wall). */
const HIGHLIGHT_KINDS = new Set(["badge", "level", "anniversary", "joined", "skill", "certification", "achievement", "moment", "shared"]);

const first = (name) => name.split(" ")[0];
const imgUrl = (id) => `/api/uploads/${id}`;

/**
 * @param {object} o
 * @param {string[]} o.userIds  whose moments to collect
 * @param {number}  o.year
 * @param {object}  o.viewer    current user (from requireUser)
 * @param {boolean} [o.highlights] company wall: only the big moments, photo thank-yous only
 */
export async function getWall({ userIds, year, viewer, highlights = false }) {
  if (!userIds.length) return [];
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const inYear = (col) => and(gte(col, from), lt(col, to));
  const canSeePrivate = (uid) => uid === viewer.id || viewer.can("users.manage");

  const [people, settings, levels] = await Promise.all([
    db.select({ id: s.users.id, name: s.users.name, joinedAt: s.users.joinedAt }).from(s.users).where(inArray(s.users.id, userIds)),
    getSettings(),
    getLevels(),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  const [thanks, badges, ledger, redemptions, manual, sharedPosts] = await Promise.all([
    // Thank-yous received
    db
      .select({
        postId: s.posts.id,
        userId: s.postRecipients.userId,
        at: s.posts.createdAt,
        body: s.posts.body,
        points: s.posts.pointsEach,
        authorId: s.users.id,
        authorName: s.users.name,
        value: s.companyValues.name,
      })
      .from(s.postRecipients)
      .innerJoin(s.posts, eq(s.posts.id, s.postRecipients.postId))
      .innerJoin(s.users, eq(s.users.id, s.posts.authorId))
      .leftJoin(s.companyValues, eq(s.companyValues.id, s.posts.valueId))
      .where(
        and(
          inArray(s.postRecipients.userId, userIds),
          eq(s.posts.kind, "appreciation"),
          eq(s.posts.hidden, false),
          inYear(s.posts.createdAt)
        )
      ),
    // Badges earned
    db
      .select({
        userId: s.userBadges.userId,
        at: s.userBadges.awardedAt,
        badgeId: s.badges.id,
        name: s.badges.name,
        description: s.badges.description,
        icon: s.badges.icon,
        color: s.badges.color,
        points: s.badges.points,
        byId: s.userBadges.awardedById,
      })
      .from(s.userBadges)
      .innerJoin(s.badges, eq(s.badges.id, s.userBadges.badgeId))
      .where(and(inArray(s.userBadges.userId, userIds), inYear(s.userBadges.awardedAt))),
    // Whole ledger (needed to work out when each level was reached), plus automatic bonuses
    db
      .select({
        userId: s.pointLedger.userId,
        delta: s.pointLedger.delta,
        reason: s.pointLedger.reason,
        refId: s.pointLedger.refId,
        note: s.pointLedger.note,
        at: s.pointLedger.createdAt,
        id: s.pointLedger.id,
      })
      .from(s.pointLedger)
      .where(inArray(s.pointLedger.userId, userIds))
      .orderBy(asc(s.pointLedger.createdAt)),
    // Rewards approved
    db
      .select({
        id: s.redemptions.id,
        userId: s.redemptions.userId,
        at: s.redemptions.decidedAt,
        name: s.rewards.name,
        cost: s.redemptions.cost,
      })
      .from(s.redemptions)
      .innerJoin(s.rewards, eq(s.rewards.id, s.redemptions.rewardId))
      .where(and(inArray(s.redemptions.userId, userIds), eq(s.redemptions.status, "approved"), inYear(s.redemptions.decidedAt))),
    // Pinned by people themselves
    db
      .select()
      .from(s.memories)
      .where(and(inArray(s.memories.userId, userIds), inYear(s.memories.occurredAt))),
    // Milestones/announcements they posted with photos
    db
      .select({ id: s.posts.id, userId: s.posts.authorId, at: s.posts.createdAt, body: s.posts.body, kind: s.posts.kind })
      .from(s.posts)
      .where(
        and(
          inArray(s.posts.authorId, userIds),
          inArray(s.posts.kind, ["milestone", "announcement"]),
          eq(s.posts.hidden, false),
          inYear(s.posts.createdAt)
        )
      ),
  ]);

  // First photo of each post involved
  const postIds = [...new Set([...thanks.map((t) => t.postId), ...sharedPosts.map((p) => p.id)])];
  const photos = postIds.length
    ? await db
        .select({
          id: s.postImages.id,
          postId: s.postImages.postId,
          w: s.postImages.width,
          h: s.postImages.height,
          pos: s.postImages.position,
        })
        .from(s.postImages)
        .where(inArray(s.postImages.postId, postIds))
        .orderBy(asc(s.postImages.position))
    : [];
  const photoOf = new Map();
  const photoCount = new Map();
  for (const p of photos) {
    if (!photoOf.has(p.postId)) photoOf.set(p.postId, { url: imgUrl(p.id), w: p.w, h: p.h });
    photoCount.set(p.postId, (photoCount.get(p.postId) ?? 0) + 1);
  }
  const byIds = [...new Set(badges.map((b) => b.byId).filter(Boolean))];
  const givers = byIds.length
    ? await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, byIds))
    : [];
  const giverName = new Map(givers.map((g) => [g.id, g.name]));

  const items = [];
  const push = (kind, o) => items.push({ kind, ...MEMORY_KINDS[kind], ...o, userName: nameOf.get(o.userId) ?? "" });

  for (const t of thanks) {
    const photo = photoOf.get(t.postId) ?? null;
    if (highlights && !photo) continue;
    push("appreciation", {
      id: `appr-${t.postId}-${t.userId}`,
      userId: t.userId,
      at: t.at.getTime(),
      title: `Thanked by ${first(t.authorName)}`,
      subtitle: t.value ?? "",
      detail: t.body,
      points: t.points,
      photo,
      morePhotos: Math.max(0, (photoCount.get(t.postId) ?? 0) - 1),
      link: `/posts/${t.postId}`,
      by: { id: t.authorId, name: t.authorName },
    });
  }
  for (const b of badges) {
    push("badge", {
      id: `badge-${b.badgeId}-${b.userId}`,
      userId: b.userId,
      at: b.at.getTime(),
      title: `Earned ${b.name}`,
      subtitle: b.description,
      detail: b.byId ? `Awarded by ${giverName.get(b.byId) ?? "a colleague"}` : "",
      points: b.points,
      icon: b.icon,
      color: b.color,
      link: "/badges",
    });
  }

  // Level-ups: walk each person's ledger and note the day their lifetime points crossed a level.
  const climbing = levels.filter((l) => l.minPoints > 0).sort((a, b) => a.minPoints - b.minPoints);
  const lifetime = new Map();
  for (const r of ledger) {
    if (r.delta > 0 && r.reason !== "refund") {
      const before = lifetime.get(r.userId) ?? 0;
      const after = before + r.delta;
      lifetime.set(r.userId, after);
      // If one entry jumps several levels, keep only the highest one reached.
      const reached = climbing.filter((l) => before < l.minPoints && after >= l.minPoints).pop();
      if (reached && r.at >= from && r.at < to)
        push("level", {
          id: `level-${reached.id}-${r.userId}`,
          userId: r.userId,
          at: r.at.getTime(),
          title: `Reached ${reached.name}`,
          subtitle: `${reached.minPoints.toLocaleString()} lifetime points`,
          detail: reached.perk ? `Perk unlocked: ${reached.perk}` : "",
          color: reached.color,
          levelName: reached.name,
        });
    }
    if (r.at < from || r.at >= to) continue;
    const ref = r.refId ?? "";
    if (ref.startsWith("auto:birthday:"))
      push("birthday", {
        id: `bday-${r.id}`,
        userId: r.userId,
        at: r.at.getTime(),
        title: "Happy birthday!",
        subtitle: `+${r.delta} birthday points`,
        emoji: "🎂",
      });
    else if (ref.startsWith("auto:anniversary:"))
      push("anniversary", {
        id: `anniv-${r.id}`,
        userId: r.userId,
        at: r.at.getTime(),
        title: r.note.replace(" work anniversary", "") + " at " + settings.companyName,
        subtitle: `+${r.delta} anniversary points`,
        emoji: "🎉",
      });
    else if (ref.startsWith("manual:") && r.delta > 0 && canSeePrivate(r.userId) && !highlights)
      push("bonus", {
        id: `bonus-${r.id}`,
        userId: r.userId,
        at: r.at.getTime(),
        title: "Bonus points",
        subtitle: `+${r.delta} points`,
        detail: r.note,
        emoji: "⭐",
      });
  }

  for (const p of people) {
    if (p.joinedAt >= from && p.joinedAt < to)
      push("joined", {
        id: `joined-${p.id}`,
        userId: p.id,
        at: p.joinedAt.getTime(),
        title: `Joined ${settings.companyName}`,
        subtitle: "Day one",
        emoji: "👋",
      });
  }
  for (const r of redemptions) {
    if (highlights || !canSeePrivate(r.userId)) continue;
    push("reward", {
      id: `reward-${r.id}`,
      userId: r.userId,
      at: r.at.getTime(),
      title: r.name,
      subtitle: `Redeemed for ${r.cost.toLocaleString()} points`,
      link: "/rewards",
    });
  }
  // Posts created by pinning a moment are already on the wall as that moment.
  const pinnedPosts = new Set(
    (
      await db
        .select({ postId: s.memories.postId })
        .from(s.memories)
        .where(inArray(s.memories.postId, sharedPosts.length ? sharedPosts.map((p) => p.id) : ["-"]))
    ).map((r) => r.postId)
  );
  for (const p of sharedPosts) {
    const photo = photoOf.get(p.id);
    if (!photo || pinnedPosts.has(p.id)) continue;
    push("shared", {
      id: `shared-${p.id}`,
      userId: p.userId,
      at: p.at.getTime(),
      title: p.kind === "announcement" ? "Shared news" : "Shared a moment",
      detail: p.body,
      photo,
      morePhotos: Math.max(0, (photoCount.get(p.id) ?? 0) - 1),
      link: `/posts/${p.id}`,
    });
  }
  for (const m of manual) {
    if (m.private && !canSeePrivate(m.userId)) continue;
    const labels = { skill: "Learned", certification: "Certified", achievement: "", moment: "" };
    push(m.kind, {
      id: `mem-${m.id}`,
      memoryId: m.id,
      userId: m.userId,
      at: m.occurredAt.getTime(),
      title: labels[m.kind] ? `${labels[m.kind]}: ${m.title}` : m.title,
      plainTitle: m.title,
      detail: m.detail,
      photo: m.imageId ? { url: imgUrl(m.imageId) } : null,
      private: m.private,
      link: m.postId ? `/posts/${m.postId}` : null,
      removable: m.userId === viewer.id || m.createdById === viewer.id || viewer.can("users.manage"),
    });
  }

  items.sort((a, b) => b.at - a.at);
  return highlights ? items.filter((i) => HIGHLIGHT_KINDS.has(i.kind) || i.photo).slice(0, 160) : items;
}

/** Years someone has been around, newest first — for the year switcher. */
export function yearsSince(joinedAt) {
  const now = new Date().getFullYear();
  const start = Math.min(now, new Date(joinedAt).getFullYear());
  return Array.from({ length: now - start + 1 }, (_, i) => now - i);
}

const monthDay = (d) => `${d.getMonth()}-${d.getDate()}`;

/**
 * “On this day” — moments from today’s date in earlier years, like Facebook Memories.
 * Returns [{ yearsAgo, year, items }] newest first. Only for years the person has been here.
 */
export async function getOnThisDay({ userId, viewer, date = new Date() }) {
  const person = await db.select({ joinedAt: s.users.joinedAt }).from(s.users).where(eq(s.users.id, userId)).get();
  if (!person) return [];
  const today = monthDay(date);
  const thisYear = date.getFullYear();
  const out = [];
  for (const year of yearsSince(person.joinedAt).filter((y) => y < thisYear)) {
    const items = (await getWall({ userIds: [userId], year, viewer })).filter((i) => monthDay(new Date(i.at)) === today);
    if (items.length) out.push({ yearsAgo: thisYear - year, year, items });
  }
  return out;
}

/**
 * Daily reminders, run once a day alongside the automatic points:
 *  • “You have memories from 1 year ago today” for everyone with an On-this-day moment
 *  • on 31 December, “Your {year} in frames is complete”
 */
export async function sendMemoryReminders(date = new Date()) {
  const key = date.toISOString().slice(0, 10);
  const last = await db.select().from(s.settings).where(eq(s.settings.key, "memories_last_run")).get();
  if (last?.value === key) return 0;
  await db
    .insert(s.settings)
    .values({ key: "memories_last_run", value: key })
    .onConflictDoUpdate({ target: s.settings.key, set: { value: key } });

  const people = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.active, true));
  const yearEnd = date.getMonth() === 11 && date.getDate() === 31;
  const rows = [];
  for (const p of people) {
    const viewer = { id: p.id, can: () => false };
    const groups = await getOnThisDay({ userId: p.id, viewer, date });
    if (groups.length) {
      const n = groups.reduce((a, g) => a + g.items.length, 0);
      const oldest = groups[groups.length - 1].yearsAgo;
      const when =
        groups.length === 1 ? `${groups[0].yearsAgo} year${groups[0].yearsAgo > 1 ? "s" : ""} ago today` : `${oldest} years of this day`;
      rows.push({
        userId: p.id,
        kind: "memory",
        title: `🕰️ You have ${n} ${n === 1 ? "memory" : "memories"} from ${when}`,
        link: "/wall#on-this-day",
      });
    }
    if (yearEnd)
      rows.push({
        userId: p.id,
        kind: "memory",
        title: `📸 Your ${date.getFullYear()} in frames is complete — take a look back`,
        link: "/wall",
      });
  }
  if (rows.length) await db.insert(s.notifications).values(rows);
  return rows.length;
}
