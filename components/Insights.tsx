"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Feature 4: Park Log / Interruption Insights. Three quiet panels — the
// weekly sentence, this week's focus sessions, and every thought the Gate
// caught. Reads only: this page shows what already happened, it never asks
// for anything.

// Timestamps over relative labels ("2h ago"): Convex re-renders on data
// changes, not as time passes, so a relative label on an open page silently
// goes stale. A clock time never lies.
function whenLabel(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (date.toDateString() === now.toDateString()) {
    return time;
  }
  if (now.getTime() - ts < 7 * 24 * 60 * 60 * 1000) {
    return `${date.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

// Matches the section headers on the main list page.
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm leading-relaxed text-muted">
      {children}
    </p>
  );
}

function LoadingRows() {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="h-12 animate-pulse rounded-xl bg-surface" />
      <div className="h-12 animate-pulse rounded-xl bg-surface" />
    </div>
  );
}

// The headline — one warm sentence, not a dashboard.
export function WeeklyStats() {
  const stats = useQuery(api.insights.weeklyStats);

  if (stats === undefined || stats === null) {
    return <div className="h-9 w-4/5 animate-pulse rounded-xl bg-surface" />;
  }

  // The spec's sentence, built from only the non-zero counts — a giant bold
  // "finished 0 tasks" on a rough week is exactly the judgment this app
  // promised never to pass.
  const clauses: string[] = [];
  if (stats.parked > 0) {
    clauses.push(
      `parked ${count(stats.parked, "distraction", "distractions")}`
    );
  }
  if (stats.completed > 0) {
    clauses.push(`finished ${count(stats.completed, "task", "tasks")}`);
  }

  return (
    <div>
      <p className="text-balance text-2xl font-semibold leading-snug sm:text-3xl">
        {clauses.length > 0
          ? `You ${clauses.join(" and ")} this week.`
          : stats.interrupted > 0
            ? "A choppy week so far."
            : "A quiet week so far."}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {stats.interrupted > 0
          ? `You switched away ${count(
              stats.interrupted,
              "time",
              "times"
            )} — each one is logged below with your reason.`
          : clauses.length > 0
            ? "Counting the last 7 days."
            : "Lock in on one task and this page starts filling itself in."}
      </p>
    </div>
  );
}

// This week's finished focus sessions: what got done, what pulled you away.
export function FocusLog() {
  const log = useQuery(api.insights.focusLog);

  return (
    <section>
      <SectionHeading>This week in focus</SectionHeading>
      {log === undefined ? (
        <LoadingRows />
      ) : log.length === 0 ? (
        <EmptyHint>
          No focus sessions this week yet. Pick one task, lock in, and it
          lands here.
        </EmptyHint>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {log.map((entry) => (
            <li
              key={entry._id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              {/* Outcome as visible text, not a mystery icon — it reads the
                  same for eyes and screen readers. */}
              {entry.outcome === "completed" ? (
                <span className="mt-0.5 shrink-0 rounded-full border border-accent/40 px-2 py-0.5 text-[11px] text-accent">
                  done
                </span>
              ) : (
                <span className="mt-0.5 shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                  switched
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="break-words text-base leading-snug">
                  {entry.taskTitle ?? (
                    <span className="italic text-muted">
                      a task that’s no longer around
                    </span>
                  )}
                </p>
                {entry.interruptReason !== undefined && (
                  <p className="mt-1 break-words text-sm leading-relaxed text-muted">
                    “{entry.interruptReason}”
                  </p>
                )}
              </div>
              <span className="mt-1 shrink-0 text-xs tabular-nums text-muted">
                {whenLabel(entry.endedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Every thought the Gate caught, newest first — proof the system works.
// Read-only on purpose: parking already dropped each thought into the inbox
// the moment it was captured, so there is nothing left to do from here.
export function ParkLog() {
  const parked = useQuery(api.parked.listParked);

  return (
    <section>
      <SectionHeading>Park log</SectionHeading>
      {parked === undefined ? (
        <LoadingRows />
      ) : parked.length === 0 ? (
        <EmptyHint>
          Nothing parked yet. Distractions you park mid-focus are kept here —
          captured, not lost.
        </EmptyHint>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {parked.map((thought) => (
            <li
              key={thought._id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <p className="min-w-0 flex-1 break-words text-base leading-snug">
                {thought.content}
              </p>
              <span className="mt-1 shrink-0 text-xs tabular-nums text-muted">
                {whenLabel(thought._creationTime)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
