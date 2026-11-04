import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, cookieOptions, signSession, verifySession } from "./session-token";

export async function createSession(userId, sessionVersion = 0) {
  (await cookies()).set(SESSION_COOKIE, await signSession(userId, sessionVersion), cookieOptions());
}

/** → { id, sv, iat } for a valid cookie, or null. The user's current session version is checked in lib/auth.js. */
export async function readSession() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}
