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
    /** Preferred language (code from lib/i18n/locales.js); empty = follow the browser. */
    locale: text("locale").notNull().default(""),
    theme: text("theme", { enum: ["system", "light", "dark"] })
      .notNull()
      .default("system"),
    emailNotifications: integer("email_notifications", { mode: "boolean" }).notNull().default(true),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull().default(now),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
    /** Set after an invite, a reset or a weak password: the person must pick a new password before using the app. */
    mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
    /** Bumped on password change/reset/deactivation — every older sign-in cookie stops working. */
    sessionVersion: integer("session_version").notNull().default(0),
    passwordChangedAt: integer("password_changed_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("users_manager_idx").on(t.managerId)]
);

/** Sign-in activity: failed / blocked / successful sign-ins and denied actions. Used for the sign-in limit and the Security log. */
export const securityEvents = sqliteTable(
  "security_events",
  {
    id: id(),
    kind: text("kind", {
      enum: ["login_ok", "login_failed", "login_blocked", "login_locked", "password_changed", "password_reset", "permission_denied", "sessions_revoked"],
    }).notNull(),
    email: text("email").notNull().default(""),
    userId: text("user_id"),
    ip: text("ip").notNull().default(""),
    detail: text("detail").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("security_email_idx").on(t.email, t.createdAt), index("security_ip_idx").on(t.ip, t.createdAt)]
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
    /** Set when the photo belongs to a Memory Wall moment instead of (or as well as) a post. */
    memoryId: text("memory_id"),
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
    kind: text("kind", {
      enum: ["appreciation", "comment", "badge", "reward", "nudge", "system", "reaction", "points", "memory"],
    }).notNull(),
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

/**
 * Moments people add to their Memory Wall themselves (a skill learned, a certification, an achievement).
 * Everything else on the wall — badges, thank-yous, level-ups, birthdays, anniversaries, rewards —
 * is collected automatically from existing activity, so it never needs to be entered twice.
 */
export const memories = sqliteTable(
  "memories",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", { enum: ["skill", "certification", "achievement", "moment"] }).notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    imageId: text("image_id"),
    postId: text("post_id"),
    private: integer("private", { mode: "boolean" }).notNull().default(false),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull().default(now),
    createdById: text("created_by_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("memories_user_idx").on(t.userId)]
);

/** The scrolling announcement bar at the top of the app. Only people with "feed.announce" can add to it. */
export const announcements = sqliteTable("announcements", {
  id: id(),
  text: text("text").notNull(),
  tone: text("tone", { enum: ["info", "celebrate", "urgent"] }).notNull().default("info"),
  /** Hidden automatically after this moment (null = until someone ends it). */
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").references(() => users.id),
  createdAt: createdAt(),
});

/* ── Open Talk: company-wide chat ─────────────────────────────────────────
   authorId is always stored (so people can delete their own messages and abuse can be stopped),
   but for anonymous messages it is NEVER sent to the browser or shown to anyone in the app. */
export const talkMessages = sqliteTable(
  "talk_messages",
  {
    id: id(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    anonymous: integer("anonymous", { mode: "boolean" }).notNull().default(false),
    body: text("body").notNull(),
    replyToId: text("reply_to_id"),
    reports: integer("reports").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("talk_created_idx").on(t.createdAt)]
);

/* ── Pulse surveys (HR) ─────────────────────────────────────────────────── */
export const surveys = sqliteTable("surveys", {
  id: id(),
  title: text("title").notNull(),
  intro: text("intro").notNull().default(""),
  /** Anonymous: HR sees only totals, never who answered what. */
  anonymous: integer("anonymous", { mode: "boolean" }).notNull().default(true),
  /** once = answer one time; daily = once a day; weekly = once a week (Mon–Sun). */
  frequency: text("frequency", { enum: ["once", "daily", "weekly"] }).notNull().default("once"),
  /** "YYYY-MM-DD", India time. */
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").references(() => users.id),
  createdAt: createdAt(),
});

export const surveyQuestions = sqliteTable("survey_questions", {
  id: id(),
  surveyId: text("survey_id")
    .notNull()
    .references(() => surveys.id),
  position: integer("position").notNull().default(0),
  /** scale = 1–5 stars · mood = 5 faces · nps = 0–10 · choice = pick one · multi = pick several · yesno · text */
  type: text("type", { enum: ["scale", "mood", "nps", "choice", "multi", "yesno", "text"] }).notNull(),
  prompt: text("prompt").notNull(),
  options: text("options", { mode: "json" })
    .$type()
    .notNull()
    .default(sql`'[]'`),
  required: integer("required", { mode: "boolean" }).notNull().default(true),
});

export const surveyResponses = sqliteTable(
  "survey_responses",
  {
    id: id(),
    surveyId: text("survey_id")
      .notNull()
      .references(() => surveys.id),
    /** Kept only to stop people answering twice in the same period; never shown for anonymous surveys. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    /** "once", "2026-11-18" (daily) or "2026-11-16" (weekly: the Monday of that week). */
    period: text("period").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("survey_resp_idx").on(t.surveyId, t.period, t.userId)]
);

export const surveyAnswers = sqliteTable(
  "survey_answers",
  {
    id: id(),
    responseId: text("response_id")
      .notNull()
      .references(() => surveyResponses.id),
    questionId: text("question_id")
      .notNull()
      .references(() => surveyQuestions.id),
    /** Number as text for scale/mood/nps, option text for choice/yesno, JSON array for multi, free text for text. */
    value: text("value").notNull(),
  },
  (t) => [index("survey_ans_q_idx").on(t.questionId)]
);
