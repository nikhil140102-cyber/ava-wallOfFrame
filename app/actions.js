"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { assertPermission, getCurrentUser } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { getGivenThisMonth, getPoints, getSettings } from "@/lib/queries";
import { isPermission, SUPER_ADMIN_ONLY } from "@/lib/permissions";
import { grantWelcome, runDailyAutoPoints } from "@/lib/autopoints";
import { attachImages, MAX_PER_POST, removeImagesFor, removeUpload, saveUpload } from "@/lib/uploads";

async function audit(actorId, action, target = "") {
  await db.insert(s.auditLogs).values({ actorId, action, target });
}

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new Error("You need to sign in again.");
  return u;
}

function fail(e) {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form and try again." };
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}

async function notify(userIds, n) {
  const uniq = [...new Set(userIds)];
  if (uniq.length) await db.insert(s.notifications).values(uniq.map((userId) => ({ ...n, userId })));
}

async function usersWith(permission) {
  const roles = await db.select().from(s.roles);
  const roleIds = roles.filter((r) => r.name === "Super Admin" || r.permissions.includes(permission)).map((r) => r.id);
  if (!roleIds.length) return [];
  const rows = await db
    .select({ id: s.users.id })
    .from(s.users)
    .where(and(inArray(s.users.roleId, roleIds), eq(s.users.active, true)));
  return rows.map((r) => r.id);
}

function tempPassword() {
  const words = ["maple", "river", "orbit", "cedar", "ember", "lumen", "pixel", "harbor"];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ---------------------------------------------------------------- Auth

export async function login(_, form) {
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.select().from(s.users).where(eq(s.users.email, email)).get();
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { ok: false, error: "That email and password don't match." };
  }
  if (!user.active) return { ok: false, error: "This account has been deactivated. Contact HR." };
  await createSession(user.id);
  await db.update(s.users).set({ lastSeenAt: new Date() }).where(eq(s.users.id, user.id));
  redirect("/home");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ---------------------------------------------------------------- Recognition

const appreciationSchema = z.object({
  recipientIds: z.array(z.string()).min(1, "Choose at least one person."),
  valueId: z.string().min(1, "Choose a company value."),
  badgeId: z.string().nullable(),
  body: z.string().trim().min(3, "Write a short message.").max(500),
  pointsEach: z.number().int().optional(), // ignored — the Super Admin sets this in Points Rules
  imageIds: z.array(z.string()).max(MAX_PER_POST, `Add up to ${MAX_PER_POST} photos.`).optional().default([]),
});

export async function giveAppreciation(input) {
  try {
    const user = await assertPermission("recognition.give");
    const data = appreciationSchema.parse(input);
    const settings = await getSettings();
    if (!settings.allowSelf && data.recipientIds.includes(user.id)) throw new Error("You can't recognise yourself.");
    // Points are given automatically at the amount the Super Admin set — the giver doesn't choose.
    data.pointsEach = settings.appreciationPoints;
    const used = await getGivenThisMonth(user.id);
    const cost = data.pointsEach * data.recipientIds.length;
    if (used + cost > settings.monthlyBudget) {
      throw new Error(`That's ${cost} points — you have ${settings.monthlyBudget - used} left to give this month.`);
    }
    if (data.badgeId && !user.can("badges.award")) {
      // Anyone can attach a "thank you" badge from the Culture group; other badges need badges.award.
      const b = await db.select().from(s.badges).where(eq(s.badges.id, data.badgeId)).get();
      if (!b || b.category !== "Culture") throw new Error("Only managers can attach that badge.");
    }
    if (data.badgeId) {
      const b = await db.select().from(s.badges).where(eq(s.badges.id, data.badgeId)).get();
      if (!b?.active) throw new Error("That badge has been retired.");
    }

    const postId = crypto.randomUUID();
    await db.insert(s.posts).values({
      id: postId,
      authorId: user.id,
      kind: "appreciation",
      body: data.body,
      valueId: data.valueId,
      badgeId: data.badgeId,
      pointsEach: data.pointsEach,
    });
    try {
      await attachImages(postId, data.imageIds, user.id);
    } catch (e) {
      await db.delete(s.posts).where(eq(s.posts.id, postId));
      throw e;
    }
    await db.insert(s.postRecipients).values(data.recipientIds.map((userId) => ({ postId, userId })));
    if (data.pointsEach) {
      await db
        .insert(s.pointLedger)
        .values(data.recipientIds.map((userId) => ({ userId, delta: data.pointsEach, reason: "appreciation", refId: postId })));
    }
    if (data.badgeId) {
      await db
        .insert(s.userBadges)
        .values(data.recipientIds.map((userId) => ({ userId, badgeId: data.badgeId, awardedById: user.id })))
        .onConflictDoNothing();
    }
    const value = await db.select().from(s.companyValues).where(eq(s.companyValues.id, data.valueId)).get();
    await notify(data.recipientIds, {
      kind: "appreciation",
      actorId: user.id,
      title: `${user.name} appreciated you for ${value?.name ?? "great work"}${data.pointsEach ? ` (+${data.pointsEach} points)` : ""}`,
      link: `/posts/${postId}`,
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { postId } };
  } catch (e) {
    return fail(e);
  }
}

/** Undo within two minutes — the Apple way: let people act, then let them take it back. */
export async function undoAppreciation(postId) {
  try {
    const user = await me();
    const post = await db.select().from(s.posts).where(eq(s.posts.id, postId)).get();
    if (!post || post.authorId !== user.id) throw new Error("You can only undo your own post.");
    if (Date.now() - post.createdAt.getTime() > 120_000) throw new Error("Too late to undo — you can still delete it from the post menu.");
    await db.delete(s.pointLedger).where(and(eq(s.pointLedger.refId, postId), eq(s.pointLedger.reason, "appreciation")));
    if (post.badgeId) {
      const recips = await db.select().from(s.postRecipients).where(eq(s.postRecipients.postId, postId));
      for (const r of recips) {
        await db
          .delete(s.userBadges)
          .where(and(eq(s.userBadges.userId, r.userId), eq(s.userBadges.badgeId, post.badgeId), eq(s.userBadges.awardedById, user.id)));
      }
    }
    await db.delete(s.notifications).where(eq(s.notifications.link, `/posts/${postId}`));
    await removeImagesFor(postId);
    await db.delete(s.posts).where(eq(s.posts.id, postId));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function postAnnouncement(body, imageIds = []) {
  try {
    const user = await assertPermission("feed.announce");
    const text = z.string().trim().min(3, "Write something first.").max(800).parse(body);
    const ids = z.array(z.string()).max(MAX_PER_POST, `Add up to ${MAX_PER_POST} photos.`).parse(imageIds);
    const id = crypto.randomUUID();
    await db.insert(s.posts).values({ id, authorId: user.id, kind: "announcement", body: text });
    try {
      await attachImages(id, ids, user.id);
    } catch (e) {
      await db.delete(s.posts).where(eq(s.posts.id, id));
      throw e;
    }
    revalidatePath("/home");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleReaction(postId) {
  try {
    const user = await assertPermission("feed.comment");
    const existing = await db
      .select()
      .from(s.reactions)
      .where(and(eq(s.reactions.postId, postId), eq(s.reactions.userId, user.id)))
      .get();
    if (existing) await db.delete(s.reactions).where(and(eq(s.reactions.postId, postId), eq(s.reactions.userId, user.id)));
    else await db.insert(s.reactions).values({ postId, userId: user.id });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addComment(postId, body) {
  try {
    const user = await assertPermission("feed.comment");
    const text = z.string().trim().min(1, "Write a comment first.").max(500).parse(body);
    await db.insert(s.comments).values({ postId, authorId: user.id, body: text });
    const post = await db.select().from(s.posts).where(eq(s.posts.id, postId)).get();
    const recips = await db.select().from(s.postRecipients).where(eq(s.postRecipients.postId, postId));
    if (post) {
      await notify(
        [post.authorId, ...recips.map((r) => r.userId)].filter((id) => id !== user.id),
        {
          kind: "comment",
          actorId: user.id,
          title: `${user.name} commented: “${text.slice(0, 60)}${text.length > 60 ? "…" : ""}”`,
          link: `/posts/${postId}`,
        }
      );
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteComment(commentId) {
  try {
    const user = await me();
    const c = await db.select().from(s.comments).where(eq(s.comments.id, commentId)).get();
    if (!c) throw new Error("Comment not found.");
    if (c.authorId !== user.id && !user.can("moderation.manage")) throw new Error("You can only delete your own comments.");
    await db.delete(s.comments).where(eq(s.comments.id, commentId));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reportPost(postId, reason) {
  try {
    const user = await me();
    const text = z.string().trim().min(3, "Tell us briefly what's wrong.").max(200).parse(reason);
    await db.insert(s.reports).values({ postId, reporterId: user.id, reason: text });
    await notify(await usersWith("moderation.manage"), {
      kind: "system",
      title: "A post was reported and needs review",
      link: "/admin/moderation",
    });
    return { ok: true, message: "Thanks — the HR team will take a look." };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePost(postId) {
  try {
    const user = await me();
    const post = await db.select().from(s.posts).where(eq(s.posts.id, postId)).get();
    if (!post) throw new Error("Post not found.");
    if (post.authorId !== user.id && !user.can("moderation.manage")) throw new Error("You can only delete your own posts.");
    // Points already received stay with the recipients — deleting a post never takes points back.
    await db.delete(s.notifications).where(eq(s.notifications.link, `/posts/${postId}`));
    await removeImagesFor(postId);
    await db.delete(s.posts).where(eq(s.posts.id, postId));
    if (post.authorId !== user.id) await audit(user.id, "Deleted post", postId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Notifications

export async function markNotificationsRead(ids) {
  try {
    const user = await me();
    const cond = ids?.length
      ? and(eq(s.notifications.userId, user.id), inArray(s.notifications.id, ids))
      : eq(s.notifications.userId, user.id);
    await db.update(s.notifications).set({ read: true }).where(cond);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Rewards

export async function redeemReward(rewardId) {
  try {
    const user = await assertPermission("rewards.redeem");
    const reward = await db
      .select()
      .from(s.rewards)
      .where(and(eq(s.rewards.id, rewardId), eq(s.rewards.active, true)))
      .get();
    if (!reward) throw new Error("That reward isn't available any more.");
    const pts = (await getPoints([user.id])).get(user.id);
    if (pts.balance < reward.cost) throw new Error(`You need ${reward.cost - pts.balance} more points for this.`);
    const id = crypto.randomUUID();
    await db.insert(s.redemptions).values({ id, userId: user.id, rewardId, cost: reward.cost });
    await db.insert(s.pointLedger).values({ userId: user.id, delta: -reward.cost, reason: "redemption", refId: id });
    await notify(await usersWith("rewards.manage"), {
      kind: "reward",
      actorId: user.id,
      title: `${user.name} requested ${reward.name}`,
      link: "/admin/rewards",
    });
    revalidatePath("/", "layout");
    return { ok: true, data: undefined, message: `${reward.name} requested. Points are held until HR approves.` };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelRedemption(id) {
  try {
    const user = await me();
    const r = await db.select().from(s.redemptions).where(eq(s.redemptions.id, id)).get();
    if (!r || r.userId !== user.id) throw new Error("Redemption not found.");
    if (r.status !== "pending") throw new Error("Only pending requests can be cancelled.");
    await db.delete(s.pointLedger).where(and(eq(s.pointLedger.refId, id), eq(s.pointLedger.reason, "redemption")));
    await db.delete(s.redemptions).where(eq(s.redemptions.id, id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function decideRedemption(id, approve, note) {
  try {
    const user = await assertPermission("rewards.manage");
    const r = await db
      .select({ red: s.redemptions, reward: s.rewards, userName: s.users.name })
      .from(s.redemptions)
      .innerJoin(s.rewards, eq(s.redemptions.rewardId, s.rewards.id))
      .innerJoin(s.users, eq(s.redemptions.userId, s.users.id))
      .where(eq(s.redemptions.id, id))
      .get();
    if (!r || r.red.status !== "pending") throw new Error("This request was already handled.");
    await db
      .update(s.redemptions)
      .set({ status: approve ? "approved" : "rejected", decidedById: user.id, decidedAt: new Date(), note: note ?? null })
      .where(eq(s.redemptions.id, id));
    if (!approve) await db.insert(s.pointLedger).values({ userId: r.red.userId, delta: r.red.cost, reason: "refund", refId: id });
    await notify([r.red.userId], {
      kind: "reward",
      actorId: user.id,
      title: approve
        ? `Your ${r.reward.name} request was approved 🎉`
        : `Your ${r.reward.name} request was declined — ${r.red.cost} points refunded`,
      link: "/rewards",
    });
    await audit(user.id, approve ? "Approved redemption" : "Declined redemption", `${r.reward.name} · ${r.userName}`);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const rewardSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Give the reward a name."),
  description: z.string().trim().max(200),
  category: z.string().trim().min(2),
  icon: z.string().min(1),
  cost: z.number().int().min(10, "Cost must be at least 10 points.").max(100000),
  active: z.boolean(),
});

export async function saveReward(input) {
  try {
    const user = await assertPermission("rewards.manage");
    const data = rewardSchema.parse(input);
    if (data.id) await db.update(s.rewards).set(data).where(eq(s.rewards.id, data.id));
    else await db.insert(s.rewards).values({ ...data, id: undefined });
    await audit(user.id, data.id ? "Updated reward" : "Created reward", data.name);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Badges & team

export async function awardBadge(userId, badgeId, message) {
  try {
    const user = await assertPermission("badges.award");
    const badge = await db.select().from(s.badges).where(eq(s.badges.id, badgeId)).get();
    if (!badge || !badge.active) throw new Error("That badge isn't available.");
    if (userId === user.id) throw new Error("You can't award a badge to yourself.");
    const exists = await db
      .select()
      .from(s.userBadges)
      .where(and(eq(s.userBadges.userId, userId), eq(s.userBadges.badgeId, badgeId)))
      .get();
    if (exists) throw new Error("They already have this badge.");
    await db.insert(s.userBadges).values({ userId, badgeId, awardedById: user.id });
    await db.insert(s.pointLedger).values({ userId, delta: badge.points, reason: "badge", refId: badgeId });
    const postId = crypto.randomUUID();
    await db
      .insert(s.posts)
      .values({ id: postId, authorId: user.id, kind: "badge", badgeId, body: message.trim() || `Awarded the ${badge.name} badge.` });
    await db.insert(s.postRecipients).values({ postId, userId });
    await notify([userId], {
      kind: "badge",
      actorId: user.id,
      title: `${user.name} awarded you the ${badge.name} badge (+${badge.points} points)`,
      link: `/posts/${postId}`,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function nudge(userId) {
  try {
    const user = await assertPermission("team.nudge");
    const target = await db.select().from(s.users).where(eq(s.users.id, userId)).get();
    if (!target || (target.managerId !== user.id && !user.can("users.manage"))) throw new Error("You can only nudge your own team.");
    const recent = await db
      .select({ n: sql`count(*)` })
      .from(s.notifications)
      .where(
        and(
          eq(s.notifications.userId, userId),
          eq(s.notifications.kind, "nudge"),
          gte(s.notifications.createdAt, new Date(Date.now() - 7 * 86_400_000))
        )
      )
      .get();
    if (Number(recent?.n) > 0) throw new Error(`${target.name.split(" ")[0]} was already nudged this week.`);
    await notify([userId], {
      kind: "nudge",
      actorId: user.id,
      title: `${user.name}: who helped you this week? Take a minute to recognise them.`,
      link: "/home?recognize=1",
    });
    return { ok: true, message: `Nudge sent to ${target.name.split(" ")[0]}.` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Users

const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const userSchema = z.object({
  name: z.string().trim().min(2, "Enter a full name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  title: z.string().trim().max(80),
  departmentId: z.string().nullable(),
  managerId: z.string().nullable(),
  roleId: z.string().min(1),
  employeeCode: z.string().trim().max(20).optional().default(""),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d\s()-]*$/, "Phone can only have numbers, spaces and + ( ) -.")
    .optional()
    .default(""),
  city: z.string().trim().max(60).optional().default(""),
  birthday: z
    .string()
    .refine((v) => v === "" || MD.test(v), "Pick a valid birthday.")
    .optional()
    .default(""),
  joinedAt: z.number().int().optional(),
});

/** Roles only someone with "Manage roles" may hand out or edit people in. */
function isProtectedRole(role) {
  return role.name === "Super Admin" || role.permissions.includes("roles.manage");
}

async function guardRoleAssignment(actor, roleId) {
  const role = await db.select().from(s.roles).where(eq(s.roles.id, roleId)).get();
  if (!role) throw new Error("Role not found.");
  // Without roles.manage (e.g. HR) you can assign any role except Super Admin or a role that can itself manage roles.
  if (!actor.can("roles.manage") && isProtectedRole(role)) {
    throw new Error(`Only someone who manages roles can assign “${role.name}”.`);
  }
  return role;
}

export async function inviteUser(input) {
  try {
    const actor = await assertPermission("users.manage");
    const { joinedAt, ...data } = userSchema.parse(input);
    await guardRoleAssignment(actor, data.roleId);
    const exists = await db.select().from(s.users).where(eq(s.users.email, data.email)).get();
    if (exists) throw new Error("Someone with that email already exists.");
    const password = tempPassword();
    const id = crypto.randomUUID();
    await db.insert(s.users).values({
      ...data,
      id,
      joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
      passwordHash: await bcrypt.hash(password, 10),
    });
    await audit(actor.id, "Invited user", data.name);
    const welcomed = await grantWelcome(id);
    revalidatePath("/", "layout");
    return { ok: true, data: { password, welcomed } };
  } catch (e) {
    return fail(e);
  }
}

const FIELD_LABELS = {
  name: "name",
  email: "email",
  title: "job title",
  employeeCode: "employee ID",
  phone: "phone",
  city: "city",
  birthday: "birthday",
  joinedAt: "joining date",
  departmentId: "department",
  managerId: "manager",
};

/** HR and the Super Admin (anyone with users.manage) can edit every detail of a person. */
export async function updateUser(id, input) {
  try {
    const actor = await assertPermission("users.manage");
    const target = await db.select().from(s.users).where(eq(s.users.id, id)).get();
    if (!target) throw new Error("User not found.");
    // HR can edit everyone except the Super Admin (and anyone else who manages roles).
    if (id !== actor.id && !actor.can("roles.manage")) {
      const targetRole = await db.select().from(s.roles).where(eq(s.roles.id, target.roleId)).get();
      if (targetRole && isProtectedRole(targetRole)) throw new Error(`Only the Super Admin can edit ${target.name}'s details.`);
    }
    const patch = {};
    if (input.roleId && input.roleId !== target.roleId) {
      if (id === actor.id) throw new Error("You can't change your own role.");
      const role = await guardRoleAssignment(actor, input.roleId);
      patch.roleId = input.roleId;
      await audit(actor.id, "Changed role", `${target.name} → ${role.name}`);
    }
    if (input.active !== undefined && input.active !== target.active) {
      if (id === actor.id) throw new Error("You can't deactivate yourself.");
      patch.active = input.active;
      await audit(actor.id, input.active ? "Reactivated user" : "Deactivated user", target.name);
    }

    const details = userSchema.partial().parse(Object.fromEntries(Object.entries(input).filter(([k]) => k in FIELD_LABELS)));
    if (details.managerId !== undefined && details.managerId === id) throw new Error("Someone can't be their own manager.");
    if (details.email && details.email !== target.email) {
      const clash = await db.select().from(s.users).where(eq(s.users.email, details.email)).get();
      if (clash) throw new Error("Someone else already uses that email.");
    }
    if (details.joinedAt !== undefined) {
      if (details.joinedAt > Date.now()) throw new Error("The joining date can't be in the future.");
      details.joinedAt = new Date(details.joinedAt);
    }
    const changed = [];
    for (const [k, v] of Object.entries(details)) {
      const before = target[k] instanceof Date ? target[k].getTime() : target[k];
      const after = v instanceof Date ? v.getTime() : v;
      if ((before ?? null) !== (after ?? null)) {
        patch[k] = v;
        changed.push(FIELD_LABELS[k]);
      }
    }
    if (changed.length) await audit(actor.id, "Edited details", `${target.name}: ${changed.join(", ")}`);
    if (Object.keys(patch).length) await db.update(s.users).set(patch).where(eq(s.users.id, id));
    revalidatePath("/", "layout");
    return { ok: true, data: { changed } };
  } catch (e) {
    return fail(e);
  }
}

export async function resetPassword(id) {
  try {
    const actor = await assertPermission("users.manage");
    const target = await db.select().from(s.users).where(eq(s.users.id, id)).get();
    if (!target) throw new Error("User not found.");
    const password = tempPassword();
    await db
      .update(s.users)
      .set({ passwordHash: await bcrypt.hash(password, 10) })
      .where(eq(s.users.id, id));
    await audit(actor.id, "Reset password", target.name);
    return { ok: true, data: { password } };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Roles

const roleSchema = z.object({
  name: z.string().trim().min(2, "Give the role a name.").max(40),
  description: z.string().trim().max(160),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  permissions: z
    .array(z.string())
    .refine((ps) => ps.every((p) => isPermission(p)), "Unknown permission.")
    // Some permissions (like Points Rules) belong to the Super Admin alone and are never stored on other roles.
    .transform((ps) => ps.filter((p) => !SUPER_ADMIN_ONLY.includes(p))),
});

export async function createRole(input) {
  try {
    const actor = await assertPermission("roles.manage");
    const data = roleSchema.parse(input);
    const exists = await db.select().from(s.roles).where(eq(s.roles.name, data.name)).get();
    if (exists) throw new Error("A role with that name already exists.");
    const id = crypto.randomUUID();
    await db.insert(s.roles).values({ ...data, id });
    await audit(actor.id, "Created role", data.name);
    revalidatePath("/admin/roles");
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateRole(id, input) {
  try {
    const actor = await assertPermission("roles.manage");
    const role = await db.select().from(s.roles).where(eq(s.roles.id, id)).get();
    if (!role) throw new Error("Role not found.");
    if (role.name === "Super Admin" && (input.permissions || (input.name && input.name !== role.name))) {
      throw new Error("Super Admin always has every permission and can't be renamed.");
    }
    if (role.id === actor.role.id && input.permissions && !input.permissions.includes("roles.manage")) {
      throw new Error("You can't remove “Manage roles” from your own role — you'd lock yourself out.");
    }
    const data = roleSchema.partial().parse(input);
    await db.update(s.roles).set(data).where(eq(s.roles.id, id));
    if (data.permissions) {
      const added = data.permissions.filter((p) => !role.permissions.includes(p));
      const removed = role.permissions.filter((p) => !data.permissions.includes(p));
      await audit(
        actor.id,
        "Changed permissions",
        `${role.name}: ${[...added.map((p) => `+${p}`), ...removed.map((p) => `−${p}`)].join(", ")}`
      );
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRole(id) {
  try {
    const actor = await assertPermission("roles.manage");
    const role = await db.select().from(s.roles).where(eq(s.roles.id, id)).get();
    if (!role) throw new Error("Role not found.");
    if (role.isSystem) throw new Error("System roles can't be deleted.");
    const fallback = await db.select().from(s.roles).where(eq(s.roles.name, "Employee")).get();
    if (!fallback) throw new Error("The Employee role is missing.");
    const moved = await db.update(s.users).set({ roleId: fallback.id }).where(eq(s.users.roleId, id)).returning({ id: s.users.id });
    await db.delete(s.roles).where(eq(s.roles.id, id));
    await audit(actor.id, "Deleted role", `${role.name}${moved.length ? ` (${moved.length} moved to Employee)` : ""}`);
    revalidatePath("/admin/roles");
    return {
      ok: true,
      message: moved.length ? `${moved.length} ${moved.length === 1 ? "person" : "people"} moved to Employee.` : undefined,
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Levels, values, settings

const levelSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string().trim().min(2),
    minPoints: z.number().int().min(0),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    perk: z.string().trim().max(120),
  })
);

export async function saveLevels(input) {
  try {
    const actor = await assertPermission("levels.manage");
    const levels = levelSchema.parse(input).sort((a, b) => a.minPoints - b.minPoints);
    if (levels[0]?.minPoints !== 0) throw new Error("The first level must start at 0 points.");
    for (let i = 1; i < levels.length; i++)
      if (levels[i].minPoints === levels[i - 1].minPoints) throw new Error("Two levels can't start at the same points.");
    for (const l of levels) await db.update(s.levels).set(l).where(eq(s.levels.id, l.id));
    await audit(actor.id, "Updated levels", levels.map((l) => `${l.name} ${l.minPoints}`).join(" · "));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const settingsSchema = z.object({
  companyName: z.string().trim().min(2),
  allowSelf: z.boolean(),
});

export async function saveSettings(input) {
  try {
    const actor = await assertPermission("settings.manage");
    const d = settingsSchema.parse(input);
    const rows = [
      { key: "company_name", value: d.companyName },
      { key: "allow_self", value: String(d.allowSelf) },
    ];
    for (const r of rows)
      await db
        .insert(s.settings)
        .values(r)
        .onConflictDoUpdate({ target: s.settings.key, set: { value: r.value } });
    await audit(actor.id, "Updated company settings");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveValue(input) {
  try {
    const actor = await assertPermission("settings.manage");
    const name = z.string().trim().min(2, "Name the value.").max(40).parse(input.name);
    if (input.id)
      await db
        .update(s.companyValues)
        .set({ name, description: input.description, active: input.active })
        .where(eq(s.companyValues.id, input.id));
    else await db.insert(s.companyValues).values({ name, description: input.description });
    await audit(actor.id, input.id ? "Updated value" : "Added value", name);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Moderation

export async function resolveReport(reportId, action) {
  try {
    const actor = await assertPermission("moderation.manage");
    const r = await db.select().from(s.reports).where(eq(s.reports.id, reportId)).get();
    if (!r) throw new Error("Report not found.");
    await db
      .update(s.reports)
      .set({ status: action === "hide" ? "hidden" : "dismissed" })
      .where(eq(s.reports.postId, r.postId));
    if (action === "hide") await db.update(s.posts).set({ hidden: true }).where(eq(s.posts.id, r.postId));
    await audit(actor.id, action === "hide" ? "Hid reported post" : "Dismissed report", r.reason);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function restorePost(postId) {
  try {
    const actor = await assertPermission("moderation.manage");
    await db.update(s.posts).set({ hidden: false }).where(eq(s.posts.id, postId));
    await audit(actor.id, "Restored post", postId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Personal settings

export async function updateProfile(input) {
  try {
    const user = await me();
    const d = z.object({ title: z.string().trim().max(80), bio: z.string().trim().max(240), city: z.string().trim().max(60) }).parse(input);
    await db.update(s.users).set(d).where(eq(s.users.id, user.id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setPreferences(input) {
  try {
    const user = await me();
    await db.update(s.users).set(input).where(eq(s.users.id, user.id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function changePassword(current, next) {
  try {
    const user = await me();
    const row = await db.select().from(s.users).where(eq(s.users.id, user.id)).get();
    if (!row || !(await bcrypt.compare(current, row.passwordHash))) throw new Error("Your current password isn't right.");
    z.string().min(8, "Use at least 8 characters.").parse(next);
    await db
      .update(s.users)
      .set({ passwordHash: await bcrypt.hash(next, 10) })
      .where(eq(s.users.id, user.id));
    return { ok: true, message: "Password changed." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Badge catalogue

const badgeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Give the badge a name.").max(40, "Keep the name under 40 characters."),
  description: z.string().trim().min(3, "Add a one-line description.").max(120),
  criteria: z.string().trim().max(300),
  category: z.string().trim().min(2, "Choose or type a category.").max(30),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour."),
  points: z.number().int().min(0).max(1000),
  active: z.boolean(),
});

export async function saveBadge(input) {
  try {
    const actor = await assertPermission("badges.manage");
    const data = badgeSchema.parse(input);
    // How many points a badge is worth is the Super Admin's call. Others keep the current value (or the default for new badges).
    if (!actor.can("points.manage")) {
      const existing = data.id ? await db.select().from(s.badges).where(eq(s.badges.id, data.id)).get() : null;
      data.points = existing ? existing.points : (await getSettings()).badgeDefaultPoints;
    }
    const clash = await db.select().from(s.badges).where(eq(s.badges.name, data.name)).get();
    if (clash && clash.id !== data.id) throw new Error("A badge with that name already exists.");
    let id = data.id;
    if (id) {
      const before = await db.select().from(s.badges).where(eq(s.badges.id, id)).get();
      if (!before) throw new Error("Badge not found.");
      await db
        .update(s.badges)
        .set({ ...data, id: undefined })
        .where(eq(s.badges.id, id));
      const what = before.active !== data.active ? (data.active ? "Restored badge" : "Retired badge") : "Updated badge";
      await audit(actor.id, what, data.name);
    } else {
      id = crypto.randomUUID();
      await db.insert(s.badges).values({ ...data, id, createdById: actor.id });
      await audit(actor.id, "Created badge", `${data.name} · ${data.category} · ${data.points} pts`);
    }
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBadge(id) {
  try {
    const actor = await assertPermission("badges.manage");
    const badge = await db.select().from(s.badges).where(eq(s.badges.id, id)).get();
    if (!badge) throw new Error("Badge not found.");
    const held = await db
      .select({ n: sql`count(*)` })
      .from(s.userBadges)
      .where(eq(s.userBadges.badgeId, id))
      .get();
    if (Number(held?.n) > 0) throw new Error("People already hold this badge — retire it instead so their profiles keep it.");
    await db.update(s.posts).set({ badgeId: null }).where(eq(s.posts.badgeId, id));
    await db.delete(s.badges).where(eq(s.badges.id, id));
    await audit(actor.id, "Deleted badge", badge.name);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Points rules (Super Admin only)

const ruleSchema = z.object({ on: z.boolean(), points: z.number().int().min(0).max(5000) });
const pointRulesSchema = z.object({
  appreciationPoints: z.number().int().min(0, "Points can't be negative.").max(500, "Keep it under 500 points per appreciation."),
  monthlyBudget: z.number().int().min(0).max(100000),
  badgeDefaultPoints: z.number().int().min(0).max(1000),
  rules: z.object({ welcome: ruleSchema, birthday: ruleSchema, anniversary: ruleSchema }),
});

export async function savePointRules(input) {
  try {
    const actor = await assertPermission("points.manage");
    const d = pointRulesSchema.parse(input);
    const before = await getSettings();
    const rows = [
      ["appreciation_points", d.appreciationPoints],
      ["monthly_budget", d.monthlyBudget],
      ["badge_default_points", d.badgeDefaultPoints],
      ...["welcome", "birthday", "anniversary"].flatMap((k) => [
        [`auto_${k}_on`, d.rules[k].on],
        [`auto_${k}_points`, d.rules[k].points],
      ]),
    ];
    for (const [key, v] of rows)
      await db
        .insert(s.settings)
        .values({ key, value: String(v) })
        .onConflictDoUpdate({ target: s.settings.key, set: { value: String(v) } });

    const label = { welcome: "Welcome bonus", birthday: "Birthday", anniversary: "Work anniversary" };
    const changes = [];
    if (before.appreciationPoints !== d.appreciationPoints)
      changes.push(`Per appreciation ${before.appreciationPoints} → ${d.appreciationPoints}`);
    if (before.monthlyBudget !== d.monthlyBudget) changes.push(`Monthly budget ${before.monthlyBudget} → ${d.monthlyBudget}`);
    if (before.badgeDefaultPoints !== d.badgeDefaultPoints)
      changes.push(`New badge default ${before.badgeDefaultPoints} → ${d.badgeDefaultPoints}`);
    for (const k of Object.keys(label)) {
      const b = before.rules[k];
      const a = d.rules[k];
      if (b.on !== a.on) changes.push(`${label[k]} ${a.on ? "on" : "off"}`);
      if (b.points !== a.points) changes.push(`${label[k]} ${b.points} → ${a.points}`);
    }
    await audit(actor.id, "Changed point rules", changes.join(" · ") || "No changes");
    // Apply straight away, so a birthday today is celebrated without waiting for tomorrow.
    const given = await runDailyAutoPoints({ force: true });
    revalidatePath("/", "layout");
    return { ok: true, data: { given } };
  } catch (e) {
    return fail(e);
  }
}

/** Manually give or take points — e.g. a spot bonus or correcting a mistake. Always needs a reason. */
export async function adjustPoints(userId, input) {
  try {
    const actor = await assertPermission("points.manage");
    const { delta, note } = z
      .object({
        delta: z
          .number()
          .int()
          .refine((n) => n !== 0, "Enter an amount.")
          .refine((n) => Math.abs(n) <= 10000, "That's too many points at once."),
        note: z.string().trim().min(3, "Add a short reason — the person will see it.").max(120),
      })
      .parse(input);
    const target = await db.select().from(s.users).where(eq(s.users.id, userId)).get();
    if (!target) throw new Error("User not found.");
    if (delta < 0) {
      const bal = (await getPoints([userId])).get(userId)?.balance ?? 0;
      if (bal + delta < 0) throw new Error(`${target.name.split(" ")[0]} only has ${bal} points.`);
    }
    await db.insert(s.pointLedger).values({ userId, delta, reason: "adjustment", note, refId: `manual:${crypto.randomUUID()}` });
    await notify([userId], {
      kind: "points",
      actorId: actor.id,
      title: delta > 0 ? `You received ${delta} bonus points — ${note}` : `${-delta} points were adjusted — ${note}`,
      link: "/rewards",
    });
    await audit(actor.id, delta > 0 ? "Gave points" : "Took points", `${target.name}: ${delta > 0 ? "+" : ""}${delta} · ${note}`);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Recent point movements for one person — shown in the Edit Person sheet. */
export async function getUserLedger(userId) {
  try {
    await assertPermission("users.manage");
    const rows = await db
      .select({
        id: s.pointLedger.id,
        delta: s.pointLedger.delta,
        reason: s.pointLedger.reason,
        note: s.pointLedger.note,
        at: s.pointLedger.createdAt,
      })
      .from(s.pointLedger)
      .where(eq(s.pointLedger.userId, userId))
      .orderBy(sql`${s.pointLedger.createdAt} desc`)
      .limit(6);
    const balance = (await getPoints([userId])).get(userId)?.balance ?? 0;
    return { ok: true, data: { balance, rows: rows.map((r) => ({ ...r, at: r.at.getTime() })) } };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- Photos

/** Upload one photo before posting. The browser resizes it first; the server checks type and size again. */
export async function uploadImage(form) {
  try {
    const user = await me();
    if (!user.can("recognition.give") && !user.can("feed.announce")) throw new Error("You don't have permission to do that.");
    const file = form.get("file");
    const img = await saveUpload(file, user.id, { width: form.get("width"), height: form.get("height") });
    return { ok: true, data: img };
  } catch (e) {
    return fail(e);
  }
}

export async function discardImage(id) {
  try {
    const user = await me();
    await removeUpload(String(id), user.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
