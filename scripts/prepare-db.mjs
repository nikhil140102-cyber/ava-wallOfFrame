// Runs on Vercel before `next build` (the "vercel-build" script):
//   1. checks the required environment variables and explains what's missing,
//   2. creates or updates the tables in your Turso database,
//   3. loads the demo company the first time (when the database has no users yet).
//      On a live deployment the demo accounts get a RANDOM one-time password (printed once in this build log,
//      which only people on your Vercel team can see) instead of the public "avazone123", and everyone must
//      choose their own password at first sign-in.
// Set SEED_DEMO_DATA=false to start with an empty company instead.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client/web";

try {
  process.loadEnvFile(".env.local");
} catch {}

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
client.close();

if (people === 0 && process.env.SEED_DEMO_DATA !== "false") {
  const live = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
  if (live && !process.env.DEMO_PASSWORD) {
    process.env.DEMO_PASSWORD = randomBytes(12).toString("base64url");
    console.log("→ Empty database: loading the demo company.");
    console.log(`  One-time password for every demo account: ${process.env.DEMO_PASSWORD}`);
    console.log("  (Shown only here. Each person must choose a new password the first time they sign in.)");
  } else {
    console.log("→ Empty database: loading the demo company (password for every demo account: avazone123)…");
  }
  run("npx tsx db/seed.js");
} else {
  console.log(`→ Database already has ${people} people — leaving the data alone.`);
}
