"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";

// Closes the first-sign-in race: Clerk has authenticated the browser, but
// our users row — the id every other table keys on — is only created when
// users.store runs. Gate the app UI on the row existing (users.viewer
// non-null) so no screen ever renders against a half-provisioned account.
// Returning users pass through instantly: their viewer is already non-null,
// and store just refreshes profile fields in the background.
export function StoreUserOnSignIn({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const storeUser = useMutation(api.users.store);
  // Skipped while signed out — briefly during the sign-in handshake, or
  // because the session ended under us (handled by the redirect below).
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  // The middleware only runs on document navigations. If the session ends
  // while this tab is already open (sign-out in another tab, a revoked
  // session), nothing server-side will move us — so this tab takes itself
  // to /login instead of sitting on a loading screen forever.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || started.current) return;
    started.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // store is safe to retry (it upserts), and a one-shot call would strand
    // the user on the loading screen after a single flaky request.
    const attempt = (retriesLeft: number) => {
      storeUser({}).catch(() => {
        if (cancelled) return;
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
      // Re-arm so a later authenticated run (an auth blip, StrictMode's
      // dev remount) starts a fresh chain instead of being locked out by
      // a guard whose chain was just cancelled.
      started.current = false;
    };
  }, [isAuthenticated, storeUser]);

  if (viewer === undefined || viewer === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p role="status" className="text-sm leading-relaxed text-muted">
          {failed
            ? "Couldn’t finish setting up — check your connection, then reload this page."
            : "Setting things up…"}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
