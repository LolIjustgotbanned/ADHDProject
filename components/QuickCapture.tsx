"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";

// Feature 1: Quick Capture. Zero required fields, no project/tag/date —
// the only job is getting a thought out of the user's head in under
// 2 seconds, before it can hijack whatever they were doing.
export function QuickCapture() {
  const createTask = useMutation(api.tasks.create);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [failed, setFailed] = useState(false);
  // Read by screen readers only — sighted users see the task land in the inbox.
  const [announcement, setAnnouncement] = useState("");

  // Global shortcuts: plain "c" anywhere outside a text field, or Cmd/Ctrl+K
  // from anywhere at all.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable ?? false);
      // A focused drag handle mid keyboard-reorder has aria-pressed="true";
      // stealing focus at that moment would silently cancel the drag.
      const dragging = target?.getAttribute?.("aria-pressed") === "true";
      // Cmd/Ctrl+K deliberately overrides the browser's search-bar shortcut —
      // the same convention as Linear or Slack.
      const cmdK =
        event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      const plainC =
        event.key.toLowerCase() === "c" &&
        !typing &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey;
      if ((cmdK || plainC) && !dragging) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = value.trim();
    if (!title) return;
    // Clear first — capture has to feel instant. If the save fails (offline,
    // expired session), restore the text: a thought must never be lost.
    setValue("");
    setFailed(false);
    createTask({ title })
      .then(() => setAnnouncement(`Added to inbox: ${title}`))
      .catch(() => {
        setValue(title);
        setFailed(true);
        inputRef.current?.focus();
      });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (failed) setFailed(false);
          }}
          maxLength={200}
          enterKeyHint="done"
          aria-label="Quick capture"
          placeholder="What’s on your mind?"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-12 placeholder:text-muted/80 focus:border-accent focus:outline-none"
        />
        {/* Desktop-only shortcut hint — phones get the floating button instead */}
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border px-2 py-0.5 text-xs text-muted sm:block"
        >
          C
        </kbd>
      </form>

      {failed && (
        <p className="mt-2 text-sm text-muted">
          That didn’t save — your thought is still here. Try again?
        </p>
      )}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Floating capture button — thumb reach on phones, hidden on desktop.
          The bottom offset respects the iOS home-indicator safe area. */}
      <button
        type="button"
        aria-label="Capture a thought"
        onClick={() => inputRef.current?.focus()}
        className="fixed bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-black/40 transition active:scale-95 sm:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}
