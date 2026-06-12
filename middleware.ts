import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

// Demo mode, for now: no login page, so no redirects — visiting /app signs
// you in anonymously on the client (see components/EnsureSignedIn.tsx). The
// middleware itself must stay: it carries Convex Auth's cookie/token
// plumbing that server components and the OAuth callback rely on. When real
// sign-in returns, the signed-out /app -> /login redirect comes back here.
export default convexAuthNextjsMiddleware(undefined, {
  // Auth cookies are session-only by default (gone when the browser closes);
  // 30 days keeps people signed in on their own devices.
  cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
});

export const config = {
  // All extensionless routes plus the root. Paths containing a dot (static
  // assets) and _next internals skip middleware entirely — acceptable
  // precisely because middleware is UX-only, never the authorization boundary.
  matcher: ["/((?!.*\\..*|_next).*)", "/"],
};
