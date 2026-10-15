import { sqliteTable, text, integer, blob, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = sql`(unixepoch() * 1000)`;
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().default(now);

export const departments = sqliteTable("departments", {
  id: id(),
  name: text("name").notNull().unique(),
});

export const roles = sqliteTable("roles", {
  id: id(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#6B7280"),
  /** System roles can be edited but not deleted. "Super Admin" always keeps every permission. */
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  permissions: text("permissions", { mode: "json" })
    .$type()
    .notNull()
    .default(sql`'[]'`),
  createdAt: createdAt(),
});

export const users = sqliteTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    title: text("title").notNull().default(""),
    bio: text("bio").notNull().default(""),
    city: text("city").notNull().default(""),
    phone: text("phone").notNull().default(""),
    employeeCode: text("employee_code").notNull().default(""),
    /** "MM-DD" — month and day only, used for the automatic birthday bonus. */
    birthday: text("birthday").notNull().default(""),
    departmentId: text("department_id").references(() => departments.id),
    managerId: text("manager_id"),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    theme: text("theme", { enum: ["system", "light", "dark"] })
      .notNull()
      .default("system"),
    emailNotifications: integer("email_notifications", { mode: "boolean" }).notNull().default(true),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull().default(now),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("users_manager_idx").on(t.managerId)]
);

export const levels = sqliteTable("levels", {
  id: id(),
  name: text("name").notNull(),
  minPoints: integer("min_points").notNull(),
  color: text("color").notNull(),
  perk: text("perk").notNull().default(""),
});

export const companyValues = sqliteTable("company_values", {
  id: id(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const badges = sqliteTable("badges", {
  id: id(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  points: integer("points").notNull().default(50),
  /** Plain-language "how to earn it", shown on the badge sheet. */
  criteria: text("criteria").notNull().default(""),
  /** Retired badges disappear from the directory and pickers but stay on profiles of people who earned them. */
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
});

export const userBadges = sqliteTable(
  "user_badges",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    badgeId: text("badge_id")
      .notNull()
      .references(() => badges.id),
    awardedById: text("awarded_by_id"),
    awardedAt: integer("awarded_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeId] })]
);

export const posts = sqliteTable(
  "posts",
  {
    id: id(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", { enum: ["appreciation", "milestone", "announcement", "badge"] }).notNull(),
    body: text("body").notNull(),
    valueId: text("value_id"),
    badgeId: text("badge_id"),
    pointsEach: integer("points_each").notNull().default(0),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("posts_created_idx").on(t.createdAt)]
);

export const postRecipients = sqliteTable(
  "post_recipients",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
);

/** Photos attached to a post. The image bytes are stored in the database, so it works on Vercel and any serverless host. */
export const postImages = sqliteTable(
  "post_images",
  {
    id: id(),
    /** Null until the post is published — an upload that is never posted is cleaned up later. */
    postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    data: blob("data", { mode: "buffer" }).notNull(),
    width: integer("width").notNull().default(0),
    height: integer("height").notNull().default(0),
    size: integer("size").notNull().default(0),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("post_images_post_idx").on(t.postId)]
);

export const reactions = sqliteTable(
  "reactions",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
);

export const comments = sqliteTable("comments", {
  id: id(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

/** Every point movement. Balance = sum(delta). Lifetime (drives level) = sum of positive deltas. */
export const pointLedger = sqliteTable(
  "point_ledger",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    delta: integer("delta").notNull(),
    reason: text("reason", { enum: ["appreciation", "badge", "redemption", "refund", "adjustment", "auto"] }).notNull(),
    refId: text("ref_id"),
    /** Short human note, e.g. "Birthday bonus" or the reason for a manual adjustment. */
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_user_idx").on(t.userId)]
);

export const rewards = sqliteTable("rewards", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull(),
  icon: text("icon").notNull(),
  cost: integer("cost").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const redemptions = sqliteTable("redemptions", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  rewardId: text("reward_id")
    .notNull()
    .references(() => rewards.id),
  cost: integer("cost").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  note: text("note"),
  decidedById: text("decided_by_id"),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", { enum: ["appreciation", "comment", "badge", "reward", "nudge", "system", "reaction", "points"] }).notNull(),
    actorId: text("actor_id"),
    title: text("title").notNull(),
    link: text("link").notNull().default("/home"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("notif_user_idx").on(t.userId)]
);

export const reports = sqliteTable("reports", {
  id: id(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["open", "hidden", "dismissed"] })
    .notNull()
    .default("open"),
  createdAt: createdAt(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: id(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  createdAt: createdAt(),
});
