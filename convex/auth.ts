import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // These providers execute on Convex's servers, so their secrets come from
  // the deployment environment (npx convex env set AUTH_RESEND_KEY /
  // AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET) — never from .env.local.
  providers: [
    Resend({
      // Resend's shared dev sender. Until a domain is verified with Resend,
      // magic links only deliver to the email you signed up to Resend with.
      from: "LockIn <onboarding@resend.dev>",
    }),
    Google,
    // Demo mode, for now: entering the app silently creates a throwaway
    // user, so there is no login screen. Every function still derives its
    // identity from auth context — only the sign-in ceremony is gone. Remove
    // this (and restore the login page) before real users bring real data.
    Anonymous,
  ],
});
