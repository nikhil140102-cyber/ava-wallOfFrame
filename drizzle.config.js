// Reads .env.local too, so `npm run setup` creates tables in whichever database the app uses.
import fs from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {}
// A local SQLite file needs its folder to exist before drizzle-kit can create it.
if (((process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL) ?? "file:").startsWith("file:"))
  fs.mkdirSync("data", { recursive: true });

export default {
  schema: "./db/schema.js",
  out: "./db/migrations",
  dialect: "turso",
  dbCredentials: {
    url: (process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL) ?? "file:./data/app.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
  },
};
