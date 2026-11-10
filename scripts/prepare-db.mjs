// Runs on Vercel before `next build` (the "vercel-build" script):
//   1. checks the required environment variables and explains what's missing,
//   2. creates or updates the tables in your Turso database,
//   3. loads the demo company the first time (when the database has no users yet).
//      Every demo account starts on "avazone123" and must choose its own password at first sign-in.
// Set RESET_PASSWORDS_TO to put every existing account back on one password (see below).
// Set SEED_DEMO_DATA=false to start with an empty company instead.
import { execSync } from "node:child_process";
import { createClient } from "@libsql/client/web";

try {
  process.loadEnvFile(".env.local");
} catch {}

// Preview builds (Dependabot updates, test branches) never touch the database: they could otherwise change
// the live tables from code that hasn't been merged yet. They only check that the app still builds.
if (process.env.VERCEL_ENV === "preview") {
  console.log("→ Preview build: skipping the database step (only Production deployments update the database).");
  process.exit(0);
}

const url = (process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL) ?? "";
const missing = [];
if (!url || url.startsWith("file:"))
  missing.push("DATABASE_URL  → your Turso database URL, e.g. libsql://wall-of-frames-yourname.turso.io");
if (url.startsWith("libsql://") && !(process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN))
  missing.push("DATABASE_AUTH_TOKEN  → from `turso db tokens create <db>` or the Turso dashboard");
if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET  → any long random string (32+ characters)");
else if (process.env.SESSION_SECRET.length < 32)
  missing.push("SESSION_SECRET  → is too short; use 32+ random characters (node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\")");
if (process.env.SHOW_DEMO_ACCOUNTS === "true")
  console.warn("\n⚠ SHOW_DEMO_ACCOUNTS=true: the sign-in page will list demo accounts. Remove it for a real company.\n");

if (missing.length) {
  console.error("\n✗ Wall of Frames can't be deployed yet. Add these in Vercel → Project → Settings → Environment Variables:\n");
  for (const m of missing) console.error("   • " + m);
  console.error("\nThen redeploy. Full steps: README → Deploy to Vercel.\n");
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });

console.log("→ Creating / updating tables in your database…");
run("npx drizzle-kit push --force");

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });
const { rows } = await client.execute("select count(*) as n from users");
const people = Number(rows[0].n);

// One-time password reset: set RESET_PASSWORDS_TO (e.g. avazone123) in Vercel → Settings → Environment
// Variables (Production) and deploy. Everyone can then sign in with it and is asked to choose their own
// password straight away. DELETE the variable afterwards, or every deploy resets everyone again.
const resetTo = process.env.RESET_PASSWORDS_TO;
if (resetTo && people > 0) {
  const { default: bcrypt } = await import("bcryptjs");
  const hash = await bcrypt.hash(resetTo, 10);
  const r = await client.execute({
    sql: "update users set password_hash = ?, must_change_password = 1, session_version = session_version + 1",
    args: [hash],
  });
  // Clear any "too many tries" pauses so nobody is locked out after the reset.
  await client.execute("delete from security_events where kind in ('login_failed', 'login_locked', 'login_blocked')");
  console.log(`→ RESET_PASSWORDS_TO is set: every password (${r.rowsAffected} people) is now "${resetTo}".`);
  console.log("  Each person chooses their own password right after signing in.");
  console.log("  ⚠ Now DELETE RESET_PASSWORDS_TO in Vercel → Settings → Environment Variables.");
}
client.close();

if (people === 0 && process.env.SEED_DEMO_DATA !== "false") {
  // Live site: everyone starts on "avazone123" (or DEMO_PASSWORD if you set one) and must choose their
  // own password the first time they sign in.
  process.env.DEMO_PASSWORD ||= "avazone123";
  console.log(`→ Empty database: loading the demo company. Password for every demo account: ${process.env.DEMO_PASSWORD}`);
  console.log("  Each person chooses their own password right after signing in.");
  run("npx tsx db/seed.js");
} else {
  console.log(`→ Database already has ${people} people — leaving the data alone.`);
}
