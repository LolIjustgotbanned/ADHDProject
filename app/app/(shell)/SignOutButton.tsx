"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <button
      onClick={() => void signOut().then(() => router.push("/login"))}
      className="text-sm text-muted transition hover:text-foreground"
    >
      Sign out
    </button>
  );
}
