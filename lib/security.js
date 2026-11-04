import "server-only";
import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import { and, count, eq, gte, lt, min } from "drizzle-orm";
import { db, schema as s } from "@/db";

// ---------------------------------------------------------------- Demo mode

/**
 * Demo mode = local development, or a site where the owner deliberately set SHOW_DEMO_ACCOUNTS=true.
 * Only demo mode shows the demo logins and lets the shared demo password through without a forced change.
 */
export const DEMO_MODE = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true";

// ---------------------------------------------------------------- Passwords

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

// Passwords people (and attackers) try first. Checked case-insensitively, ignoring spaces.
const COMMON = new Set(
  [
    "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword",
    "1234567890", "12345678910", "0123456789", "qwertyuiop", "qwerty123", "qwerty1234", "1q2w3e4r5t", "1qaz2wsx3edc",
    "iloveyou", "welcome1", "welcome123", "welcome@123", "letmein123", "admin12345", "administrator", "abc1234567",
    "changeme", "changeme123", "india12345", "india@123", "sunshine123", "football123", "monkey12345",
    "avazone123", "avazone", "avadhesh", "avadheshco", "avadhesh123", "wallofframes", "wallofframes123",
  ].map((p) => p.toLowerCase())
);

/** Returns a reason the password is too weak, or null when it's fine. */
export function passwordProblem(pw, { email = "", name = "" } = {}) {
  const p = String(pw ?? "");
  if (p.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (p.length > PASSWORD_MAX) return `Keep it under ${PASSWORD_MAX} characters.`;
  const flat = p.toLowerCase().replace(/\s+/g, "");
  if (COMMON.has(flat) || /^(.)\1+$/.test(flat)) return "That password is too common — pick something less guessable.";
  const local = String(email).split("@")[0].toLowerCase();
  if (local.length >= 4 && flat.includes(local)) return "Don't use your email address in your password.";
  const first = String(name).split(/\s+/)[0]?.toLowerCase() ?? "";
  if (first.length >= 4 && flat.startsWith(first) && flat.length - first.length < 6) return "Don't build your password from your name.";
  if (p.length < 16 && !(/[a-z]/i.test(p) && /[^a-z]/i.test(p))) return "Mix letters with numbers or symbols (or use a longer phrase of 16+ characters).";
  return null;
}

// No 0/O, 1/l/I — easy to read out over a call.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** A one-time password like "Kp7m-x9Qa-3Rtw" (12 random characters, ~70 bits, from the secure random generator). */
export function temporaryPassword() {
  const pick = (n) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
}

/**
 * A real bcrypt hash of a random string. Compared against when the email doesn't exist, so a wrong
 * email takes as long as a wrong password and nobody can tell which emails have accounts.
 */
export const DUMMY_HASH = "$2b$10$arnyA1tJTtxZKDfmPRJAUO0J/Gd0rRZgVGdAxDZTDePX8AlAy9YZS";

// ---------------------------------------------------------------- Who is asking

export async function clientIp() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : h.get("x-real-ip") ?? "").trim().slice(0, 64);
}

// ---------------------------------------------------------------- Sign-in limit

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILS_PER_EMAIL = 5; // per 15 minutes
export const MAX_FAILS_PER_IP = 30; // per 15 minutes (an office shares one IP, so this is generous)

/** How many ms this email / IP must wait before trying again (0 = go ahead). */
export async function loginWaitMs(email, ip) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const check = async (field, value, limit) => {
    if (!value) return 0;
    const row = await db
      .select({ n: count(), first: min(s.securityEvents.createdAt) })
      .from(s.securityEvents)
      .where(and(eq(s.securityEvents.kind, "login_failed"), eq(field, value), gte(s.securityEvents.createdAt, since)))
      .get();
    if (!row || row.n < limit) return 0;
    return Math.max(1000, new Date(row.first).getTime() + LOGIN_WINDOW_MS - Date.now());
  };
  return Math.max(await check(s.securityEvents.email, email, MAX_FAILS_PER_EMAIL), await check(s.securityEvents.ip, ip, MAX_FAILS_PER_IP));
}

/** Clears the failed tries for an email after a successful sign-in. */
export async function clearLoginFailures(email) {
  await db.delete(s.securityEvents).where(and(eq(s.securityEvents.kind, "login_failed"), eq(s.securityEvents.email, email)));
}

// ---------------------------------------------------------------- Security log

export async function logSecurity(kind, { email = "", userId = null, ip = "", detail = "" } = {}) {
  try {
    await db.insert(s.securityEvents).values({ kind, email: String(email).slice(0, 200), userId, ip, detail: String(detail).slice(0, 300) });
    // Server log too (Vercel → Logs), so attacks are visible even without opening the app.
    if (kind !== "login_ok") console.warn(`[security] ${kind}${email ? ` email=${email}` : ""}${ip ? ` ip=${ip}` : ""}${detail ? ` ${detail}` : ""}`);
    // Keep 90 days.
    if (Math.random() < 0.02) await db.delete(s.securityEvents).where(lt(s.securityEvents.createdAt, new Date(Date.now() - 90 * 86_400_000)));
  } catch {
    // Logging must never break sign-in.
  }
}
