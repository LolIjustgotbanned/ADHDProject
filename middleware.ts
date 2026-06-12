import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

// UX, not security: real authorization happens inside every Convex function
// via the auth context (helpers.currentUserId). This just keeps signed-out
// visitors from seeing an empty app shell — auth.protect() sends them to
// the sign-in page (NEXT_PUBLIC_CLERK_SIGN_IN_URL → /login).
export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  // All extensionless routes plus the root. Paths containing a dot (static
  // assets) and _next internals skip middleware entirely — acceptable
  // precisely because middleware is UX-only, never the authorization boundary.
  matcher: ["/((?!.*\\..*|_next).*)", "/"],
};
