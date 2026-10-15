import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local development: a SQLite file (file:./data/app.db).
// Vercel / production: a hosted Turso (libSQL) database — set DATABASE_URL (libsql://…) and DATABASE_AUTH_TOKEN.
const url = (process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL) ?? "file:./data/app.db";
const isFile = url.startsWith("file:");

if (isFile && process.env.VERCEL) {
  throw new Error(
    "DATABASE_URL is not set to a hosted database. Vercel can't keep a local SQLite file — create a free Turso database and add " +
      "DATABASE_URL (libsql://…) and DATABASE_AUTH_TOKEN in Vercel → Project → Settings → Environment Variables, then redeploy."
  );
}

// The network-only client has no native binary, so it runs anywhere (Vercel, edge, serverless).
// The full client (with the native SQLite engine) is only loaded for local file databases.
const { createClient } = isFile ? await import("@libsql/client") : await import("@libsql/client/web");

const globalForDb = globalThis;
const client = globalForDb.client ?? createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
