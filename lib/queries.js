import "server-only";
import { and, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { db, schema } from "@/db";

const s = schema;

export function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getSettings() {
  const rows = await db.select().from(s.settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    companyName: map.company_name ?? "AvadheshCo",
    monthlyBudget: Number(map.monthly_budget ?? 200),
    allowSelf: map.allow_self === "true",
    ...pointRulesFrom(map),
  };
}

/** Point rules are decided by the Super Admin in Admin → Points Rules. */
export const POINT_RULE_DEFAULTS = {
  appreciationPoints: 20,
  badgeDefaultPoints: 50,
  welcome: { on: true, points: 100 },
  birthday: { on: true, points: 50 },
  anniversary: { on: true, points: 100 },
};

function pointRulesFrom(map) {
  const d = POINT_RULE_DEFAULTS;
  const num = (k, def) => (map[k] !== undefined && !Number.isNaN(Number(map[k])) ? Number(map[k]) : def);
  const rule = (name) => ({
    on: map[`auto_${name}_on`] !== undefined ? map[`auto_${name}_on`] === "true" : d[name].on,
    points: num(`auto_${name}_points`, d[name].points),
  });
  return {
    appreciationPoints: num("appreciation_points", d.appreciationPoints),
    badgeDefaultPoints: num("badge_default_points", d.badgeDefaultPoints),
    rules: { welcome: rule("welcome"), birthday: rule("birthday"), anniversary: rule("anniversary") },
  };
}

export async function getLevels() {
  return db.select().from(s.levels).orderBy(s.levels.minPoints);
}

export function levelFor(lifetime, levels) {
  let current = levels[0];
  let next = null;
  for (let i = 0; i < levels.length; i++) {
    if (lifetime >= levels[i].minPoints) {
      current = levels[i];
      next = levels[i + 1] ?? null;
    }
  }
  const progress = next ? (lifetime - current.minPoints) / (next.minPoints - current.minPoints) : 1;
  return { current, next, progress: Math.max(0, Math.min(1, progress)), toNext: next ? next.minPoints - lifetime : 0 };
}

/** Balance, lifetime points and monthly giving for a set of users in three small queries. */
export async function getPoints(userIds) {
  if (!userIds.length) return new Map();
  const rows = await db
    .select({
      userId: s.pointLedger.userId,
      balance: sql`coalesce(sum(${s.pointLedger.delta}), 0)`,
      lifetime: sql`coalesce(sum(case when ${s.pointLedger.delta} > 0 and ${s.pointLedger.reason} != 'refund' then ${s.pointLedger.delta} else 0 end), 0)`,
    })
    .from(s.pointLedger)
    .where(inArray(s.pointLedger.userId, userIds))
    .groupBy(s.pointLedger.userId);
  const map = new Map(userIds.map((id) => [id, { balance: 0, lifetime: 0 }]));
  for (const r of rows) map.set(r.userId, { balance: Number(r.balance), lifetime: Number(r.lifetime) });
  return map;
}

export async function getGivenThisMonth(userId) {
  const row = await db
    .select({ total: sql`coalesce(sum(${s.posts.pointsEach}), 0)` })
    .from(s.posts)
    .innerJoin(s.postRecipients, eq(s.postRecipients.postId, s.posts.id))
    .where(and(eq(s.posts.authorId, userId), gte(s.posts.createdAt, monthStart())))
    .get();
  return Number(row?.total ?? 0);
}

export async function getUnreadCount(userId) {
  const row = await db
    .select({ n: sql`count(*)` })
    .from(s.notifications)
    .where(and(eq(s.notifications.userId, userId), eq(s.notifications.read, false)))
    .get();
  return Number(row?.n ?? 0);
}

export async function getPeopleLite() {
  return db
    .select({ id: s.users.id, name: s.users.name, title: s.users.title, department: s.departments.name })
    .from(s.users)
    .leftJoin(s.departments, eq(s.users.departmentId, s.departments.id))
    .where(eq(s.users.active, true))
    .orderBy(s.users.name);
}

/** Feed posts with author, recipients, value, badge, reactions and comments resolved. */
export async function getFeed(viewerId, opts = {}) {
  let ids;
  if (opts.aboutUserId) {
    const asRecipient = await db
      .select({ id: s.postRecipients.postId })
      .from(s.postRecipients)
      .where(eq(s.postRecipients.userId, opts.aboutUserId));
    const asAuthor = await db.select({ id: s.posts.id }).from(s.posts).where(eq(s.posts.authorId, opts.aboutUserId));
    ids = [...new Set([...asRecipient, ...asAuthor].map((r) => r.id))];
    if (!ids.length) return [];
  }
  const conds = [];
  if (!opts.includeHidden) conds.push(eq(s.posts.hidden, false));
  if (ids) conds.push(inArray(s.posts.id, ids));
  if (opts.postId) conds.push(eq(s.posts.id, opts.postId));

  const rows = await db
    .select({
      post: s.posts,
      author: { id: s.users.id, name: s.users.name, title: s.users.title },
      value: s.companyValues.name,
      badge: { name: s.badges.name, icon: s.badges.icon, color: s.badges.color },
    })
    .from(s.posts)
    .innerJoin(s.users, eq(s.posts.authorId, s.users.id))
    .leftJoin(s.companyValues, eq(s.posts.valueId, s.companyValues.id))
    .leftJoin(s.badges, eq(s.posts.badgeId, s.badges.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(s.posts.createdAt))
    .limit(opts.limit ?? 40);

  const postIds = rows.map((r) => r.post.id);
  if (!postIds.length) return [];

  const [recips, reacts, comms, imgs] = await Promise.all([
    db
      .select({ postId: s.postRecipients.postId, id: s.users.id, name: s.users.name })
      .from(s.postRecipients)
      .innerJoin(s.users, eq(s.postRecipients.userId, s.users.id))
      .where(inArray(s.postRecipients.postId, postIds)),
    db
      .select({ postId: s.reactions.postId, id: s.users.id, name: s.users.name })
      .from(s.reactions)
      .innerJoin(s.users, eq(s.reactions.userId, s.users.id))
      .where(inArray(s.reactions.postId, postIds)),
    db
      .select({
        id: s.comments.id,
        postId: s.comments.postId,
        body: s.comments.body,
        createdAt: s.comments.createdAt,
        authorId: s.users.id,
        authorName: s.users.name,
      })
      .from(s.comments)
      .innerJoin(s.users, eq(s.comments.authorId, s.users.id))
      .where(inArray(s.comments.postId, postIds))
      .orderBy(s.comments.createdAt),
    db
      .select({ id: s.postImages.id, postId: s.postImages.postId, width: s.postImages.width, height: s.postImages.height })
      .from(s.postImages)
      .where(inArray(s.postImages.postId, postIds))
      .orderBy(s.postImages.position),
  ]);

  return rows.map((r) => {
    const reactors = reacts.filter((x) => x.postId === r.post.id);
    return {
      id: r.post.id,
      kind: r.post.kind,
      body: r.post.body,
      pointsEach: r.post.pointsEach,
      hidden: r.post.hidden,
      createdAt: r.post.createdAt.getTime(),
      author: r.author,
      value: r.value,
      badge: r.badge?.name ? r.badge : null,
      images: imgs.filter((x) => x.postId === r.post.id).map(({ id, width, height }) => ({ id, url: `/api/uploads/${id}`, width, height })),
      recipients: recips.filter((x) => x.postId === r.post.id).map(({ id, name }) => ({ id, name })),
      reactors: reactors.map(({ id, name }) => ({ id, name })),
      reacted: reactors.some((x) => x.id === viewerId),
      comments: comms
        .filter((c) => c.postId === r.post.id)
        .map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.getTime(), author: { id: c.authorId, name: c.authorName } })),
    };
  });
}

export async function getLeaderboard(sinceDays, departmentId) {
  const conds = [gte(s.pointLedger.delta, 1), inArray(s.pointLedger.reason, ["appreciation", "badge"])];
  if (sinceDays) conds.push(gte(s.pointLedger.createdAt, new Date(Date.now() - sinceDays * 86_400_000)));
  const q = db
    .select({
      id: s.users.id,
      name: s.users.name,
      title: s.users.title,
      department: s.departments.name,
      points: sum(s.pointLedger.delta).mapWith(Number),
    })
    .from(s.pointLedger)
    .innerJoin(s.users, eq(s.pointLedger.userId, s.users.id))
    .leftJoin(s.departments, eq(s.users.departmentId, s.departments.id))
    .where(and(...conds, eq(s.users.active, true), departmentId ? eq(s.users.departmentId, departmentId) : undefined))
    .groupBy(s.users.id)
    .orderBy(desc(sum(s.pointLedger.delta)))
    .limit(20);
  return q;
}

export async function getUpcomingCelebrations() {
  // Work anniversaries in the next 30 days, from joinedAt.
  const people = await db
    .select({ id: s.users.id, name: s.users.name, joinedAt: s.users.joinedAt })
    .from(s.users)
    .where(eq(s.users.active, true));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = people
    .map((p) => {
      const j = p.joinedAt;
      let next = new Date(today.getFullYear(), j.getMonth(), j.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, j.getMonth(), j.getDate());
      const years = next.getFullYear() - j.getFullYear();
      const inDays = Math.round((next.getTime() - today.getTime()) / 86_400_000);
      return { id: p.id, name: p.name, years, inDays };
    })
    .filter((x) => x.years >= 1 && x.inDays <= 45)
    .sort((a, b) => a.inDays - b.inDays)
    .slice(0, 4);
  return items;
}
