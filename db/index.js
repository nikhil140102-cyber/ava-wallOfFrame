import { drizzle } from "drizzle-orm/libsql";
import fs from "node:fs";
import * as schema from "./schema";

// Local development: a SQLite file (file:./data/app.db).
// Vercel / production: a hosted Turso (libSQL) database — set DATABASE_URL (libsql://…) and DATABASE_AUTH_TOKEN.
const configured = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
// While `next build` runs, nothing is read from the database. A Preview build (e.g. a Dependabot update) may have
// no database settings at all, so it builds against a placeholder address that is never contacted.
const building = process.env.NEXT_PHASE === "phase-production-build";
const placeholder = building && process.env.VERCEL && !configured?.startsWith("libsql:") && !configured?.startsWith("http");
const url = placeholder ? "libsql://database-not-configured.invalid" : (configured ?? "file:./data/app.db");
const isFile = url.startsWith("file:");

if (isFile && process.env.VERCEL) {
  throw new Error(
    "DATABASE_URL is not set to a hosted database. Vercel can't keep a local SQLite file — create a free Turso database and add " +
      "DATABASE_URL (libsql://…) and DATABASE_AUTH_TOKEN in Vercel → Project → Settings → Environment Variables, then redeploy."
  );
}

// A fresh checkout has no data/ folder yet — create it so the local SQLite file can be opened.
if (isFile) fs.mkdirSync("data", { recursive: true });

// The network-only client has no native binary, so it runs anywhere (Vercel, edge, serverless).
// The full client (with the native SQLite engine) is only loaded for local file databases.
const { createClient } = isFile ? await import("@libsql/client") : await import("@libsql/client/web");

const globalForDb = globalThis;
const client = globalForDb.client ?? createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
