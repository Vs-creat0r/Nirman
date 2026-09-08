import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "nirman_session";

/**
 * Soft edge gate: redirect to /login if the session cookie is absent on any /dashboard route.
 * Presence-only (not validity) — real auth is still enforced server-side in convex/.
 * XSS hardening (httpOnly cookie) is deferred to P1-4.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
