import "server-only";
import { and, eq, like } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSettings } from "./queries";

// Automatic points. The Super Admin decides the amounts in Admin → Points Rules; the app gives them out by itself.
// Every grant carries a unique ref (e.g. "auto:birthday:2026:<userId>") so nobody is ever paid twice for the same event.

const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const monthDay = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Give points for one event, once. Returns true if points were given now. */
export async function grantAuto(userId, { refId, points, note, title }) {
  if (!points || points <= 0) return false;
  const done = await db
    .select({ id: s.pointLedger.id })
    .from(s.pointLedger)
    .where(and(eq(s.pointLedger.userId, userId), eq(s.pointLedger.refId, refId)))
    .get();
  if (done) return false;
  await db.insert(s.pointLedger).values({ userId, delta: points, reason: "auto", refId, note });
  await db.insert(s.notifications).values({ userId, kind: "points", title: `${title} (+${points} points)`, link: "/rewards" });
  return true;
}

/** Welcome bonus — called when HR or the Super Admin adds a new person. */
export async function grantWelcome(userId) {
  const { rules } = await getSettings();
  if (!rules.welcome.on) return false;
  return grantAuto(userId, {
    refId: `auto:welcome:${userId}`,
    points: rules.welcome.points,
    note: "Welcome bonus",
    title: "Welcome to the team! Here's a welcome bonus",
  });
}

/**
 * Birthdays and work anniversaries. Runs at most once a day (on the first page view of the day),
 * or immediately when `force` is set — e.g. right after the Super Admin saves the rules.
 */
export async function runDailyAutoPoints({ force = false } = {}) {
  const now = new Date();
  const today = todayKey(now);
  if (!force) {
    const last = await db.select().from(s.settings).where(eq(s.settings.key, "auto_last_run")).get();
    if (last?.value === today) return 0;
  }
  await db
    .insert(s.settings)
    .values({ key: "auto_last_run", value: today })
    .onConflictDoUpdate({ target: s.settings.key, set: { value: today } });

  const { rules } = await getSettings();
  if (!rules.birthday.on && !rules.anniversary.on) return 0;
  const md = monthDay(now);
  const year = now.getFullYear();
  const people = await db
    .select({ id: s.users.id, name: s.users.name, birthday: s.users.birthday, joinedAt: s.users.joinedAt })
    .from(s.users)
    .where(eq(s.users.active, true));

  let given = 0;
  for (const p of people) {
    if (rules.birthday.on && p.birthday === md) {
      if (
        await grantAuto(p.id, {
          refId: `auto:birthday:${year}:${p.id}`,
          points: rules.birthday.points,
          note: "Birthday bonus",
          title: `Happy birthday, ${p.name.split(" ")[0]}! 🎂`,
        })
      )
        given++;
    }
    const years = year - p.joinedAt.getFullYear();
    if (rules.anniversary.on && years >= 1 && monthDay(p.joinedAt) === md) {
      if (
        await grantAuto(p.id, {
          refId: `auto:anniversary:${year}:${p.id}`,
          points: rules.anniversary.points,
          note: `${years}-year work anniversary`,
          title: `Happy ${years}-year work anniversary! 🎉`,
        })
      )
        given++;
    }
  }
  return given;
}

/** How many automatic grants have gone out this year, by kind — shown on the Points Rules page. */
export async function autoStats() {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ refId: s.pointLedger.refId, delta: s.pointLedger.delta })
    .from(s.pointLedger)
    .where(like(s.pointLedger.refId, "auto:%"));
  const out = { welcome: { count: 0, points: 0 }, birthday: { count: 0, points: 0 }, anniversary: { count: 0, points: 0 } };
  for (const r of rows) {
    const [, kind, y] = r.refId.split(":");
    if (!out[kind]) continue;
    if (kind !== "welcome" && Number(y) !== year) continue;
    out[kind].count++;
    out[kind].points += r.delta;
  }
  return out;
}
