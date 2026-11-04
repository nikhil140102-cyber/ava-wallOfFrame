import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_RENEW_AFTER, cookieOptions, signSession, verifySession } from "@/lib/session-token";

// Keeps active people signed in: once a sign-in cookie is a day old it's renewed for another 7 days.
// Someone who doesn't open the app for 7 days is signed out. (Password changes, resets and
// deactivation still sign people out immediately — that's checked against the database in lib/auth.js.)
export async function proxy(request) {
  const res = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return res;
  const session = await verifySession(token);
  if (!session) {
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (Date.now() / 1000 - session.iat > SESSION_RENEW_AFTER) {
    res.cookies.set(SESSION_COOKIE, await signSession(session.id, session.sv), cookieOptions());
  }
  return res;
}

export const config = {
  // Pages only — not static files, images or the photo API.
  matcher: ["/((?!_next/|api/|favicon|icon|apple-icon|manifest|robots|sitemap|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|css|js)$).*)"],
};
