import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isLoginPage = createRouteMatcher(["/login"]);
const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    // These redirects are UX, not security — real authorization happens in
    // every Convex function via getAuthUserId(). Middleware just keeps
    // signed-out visitors from seeing an empty app shell.
    if (isLoginPage(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/app");
    }
    if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/login");
    }
  },
  // Auth cookies are session-only by default (gone when the browser closes);
  // 30 days keeps people signed in on their own devices.
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } }
);

export const config = {
  // All extensionless routes plus the root. Paths containing a dot (static
  // assets) and _next internals skip middleware entirely — acceptable
  // precisely because middleware is UX-only, never the authorization boundary.
  matcher: ["/((?!.*\\..*|_next).*)", "/"],
};
