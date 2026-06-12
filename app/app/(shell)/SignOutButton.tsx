"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <button
      // Demo mode: sessions are anonymous, so signing out abandons this
      // user's data for good — re-entering the app mints a fresh user.
      // Lands on the marketing page, the only place outside the app.
      onClick={() => void signOut().then(() => router.push("/"))}
      className="text-sm text-muted transition hover:text-foreground"
    >
      Sign out
    </button>
  );
}
