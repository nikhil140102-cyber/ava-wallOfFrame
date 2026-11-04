// Sign-in cookie helpers that work anywhere (server actions, pages and proxy.js).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "wof_session";
/** A sign-in lasts 7 days and is renewed automatically while the person keeps using the app. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
/** Renew once the cookie is a day old. */
export const SESSION_RENEW_AFTER = 60 * 60 * 24;

export function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!s) {
      throw new Error(
        "SESSION_SECRET is not set. Add a long random value in Vercel → Project → Settings → Environment Variables " +
          "(or in .env.local when running locally), then redeploy."
      );
    }
    if (s.length < 32) throw new Error("SESSION_SECRET is too short — use at least 32 random characters, then redeploy.");
  }
  return new TextEncoder().encode(s ?? "dev-only-secret-change-me-dev-only-secret");
}

/** sub = user id, sv = the user's session version when they signed in. */
export async function signSession(userId, sessionVersion) {
  return new SignJWT({ sub: userId, sv: sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(sessionSecret());
}

/** → { id, sv, iat } or null. */
export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { id: payload.sub, sv: Number(payload.sv ?? 0), iat: Number(payload.iat ?? 0) };
  } catch {
    return null;
  }
}

export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
});
