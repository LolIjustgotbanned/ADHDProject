"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useRef, useState } from "react";

// Demo mode's doorman: a visitor who ARRIVES under /app signed out gets an
// anonymous session, silently. Three subtleties, all earned in review:
//
//   1. Only a tree that MOUNTED signed-out may auto-sign-in. Without that,
//      "Sign out" loses a race — the auth state flips before navigation
//      commits, the effect re-runs, and signing out would silently mint a
//      fresh user and leave the browser signed in.
//   2. signIn has no retry of its own (the library only retries token
//      refresh), so one flaky request would strand the visitor in an app
//      that LOOKS healthy — empty lists render like a fresh account — but
//      can never save. Bounded retries, then an honest banner.
//   3. Two tabs racing both mint a user and one orphans. The Web Locks API
//      (the same primitive the auth library uses for refresh) serializes
//      them; the loser re-checks and adopts the winner's session instead.
export function EnsureSignedIn() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [failed, setFailed] = useState(false);
  // Latched on the FIRST settled auth observation — see subtlety 1.
  const decided = useRef(false);
  // Fresh value for callbacks that outlive a render (retry timers, lock).
  const authedRef = useRef(isAuthenticated);
  authedRef.current = isAuthenticated;

  useEffect(() => {
    if (isLoading || decided.current) return;
    decided.current = true;
    if (isAuthenticated) return; // mounted signed-in — never auto-sign-in

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const attempt = (retriesLeft: number) => {
      const run = async () => {
        // Re-checked inside the lock: the other tab may have won meanwhile.
        if (cancelled || authedRef.current) return;
        await signIn("anonymous");
      };
      const attempted =
        typeof navigator !== "undefined" && "locks" in navigator
          ? navigator.locks.request("lockin-anon-signin", run)
          : run();
      attempted.catch(() => {
        if (cancelled || authedRef.current) return;
        if (retriesLeft > 0) {
          timer = setTimeout(() => attempt(retriesLeft - 1), 1500);
        } else {
          setFailed(true);
        }
      });
    };
    attempt(2);

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [isLoading, isAuthenticated, signIn]);

  if (!failed || isAuthenticated) return null;
  return (
    // Persistent once shown; without it the dead session masquerades as a
    // healthy empty account and every capture fails with retry copy that
    // can't ever succeed.
    <p
      role="status"
      className="mx-auto w-full max-w-2xl px-6 pt-4 text-sm text-muted"
    >
      Couldn’t start your session — check your connection, then reload this
      page.
    </p>
  );
}
