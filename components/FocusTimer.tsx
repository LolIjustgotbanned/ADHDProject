"use client";

import { useEffect, useState } from "react";

// Counts up from the session's server-side start time, so it survives
// reloads and never drifts from what the session actually records.
export function FocusTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    // role="timer" carries the label legitimately (aria-label is invalid on a
    // plain paragraph) and is aria-live=off by default — no per-second chatter.
    <p
      role="timer"
      aria-label="Time focused"
      className="font-mono text-lg tabular-nums text-muted"
    >
      {hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds)}`
        : `${minutes}:${pad(seconds)}`}
    </p>
  );
}
