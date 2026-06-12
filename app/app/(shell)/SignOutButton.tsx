"use client";

import { useClerk } from "@clerk/nextjs";

export function SignOutButton() {
  const { signOut } = useClerk();

  return (
    <button
      // Clerk handles the navigation after the session is cleared — no
      // manual router dance, no race against anything re-signing-in.
      onClick={() => void signOut({ redirectUrl: "/" })}
      className="text-sm text-muted transition hover:text-foreground"
    >
      Sign out
    </button>
  );
}
