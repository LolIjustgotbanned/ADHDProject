"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const [status, setStatus] = useState<Status>("idle");

  const handleEmailSignIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Without redirectTo, the post-auth redirect lands on SITE_URL's root
    // (the marketing page) — we want people inside the app immediately.
    formData.set("redirectTo", "/app");
    setStatus("sending");
    // "resend" is the provider id of the Resend magic-link provider
    // configured in convex/auth.ts.
    signIn("resend", formData)
      .then(() => setStatus("sent"))
      .catch(() => setStatus("error"));
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">LockIn</h1>
        <p className="mt-2 text-muted">One thing at a time. Let’s get you in.</p>

        {status === "sent" ? (
          <div className="mt-10 rounded-xl border border-border bg-surface p-6">
            <p className="font-medium">Link sent ✓</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Check your inbox — clicking the link signs you straight in. You
              can close this tab.
            </p>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleEmailSignIn}
              className="mt-10 flex flex-col gap-3"
            >
              {/* Must be named "email" — the auth provider reads it from FormData. */}
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                aria-label="Email address"
                placeholder="you@example.com"
                className="rounded-xl border border-border bg-surface px-4 py-3 placeholder:text-muted/80 focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {status === "sending" ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>

            {status === "error" && (
              <p className="mt-3 text-sm text-muted">
                That didn’t go through. Mind trying again?
              </p>
            )}

            <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted/70">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              onClick={() =>
                void signIn("google", { redirectTo: "/app" }).catch(() =>
                  setStatus("error")
                )
              }
              className="mt-6 w-full rounded-xl border border-border bg-surface px-4 py-3 font-medium transition hover:border-muted/50"
            >
              Continue with Google
            </button>
          </>
        )}
      </div>
    </main>
  );
}
