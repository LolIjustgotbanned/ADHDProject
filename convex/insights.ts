import { query } from "./_generated/server";
import { currentUserId } from "./helpers";

// Insights: the numbers behind focus. Everything here is a read-only view
// over history that focus.ts and parked.ts already recorded — no new state.

// "This week" is a rolling 7-day window, not a calendar week. The server
// doesn't know the user's timezone, so any "start of week" boundary would be
// wrong for someone; a trailing window is honest everywhere. One caveat of
// computing it with Date.now(): Convex re-runs a query when its DATA changes,
// not as time passes — a page left open all day keeps the window from its
// last refresh. At MVP scale that staleness is invisible.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const weeklyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (userId === null) {
      // Signed-out transition: render nothing rather than an error.
      return null;
    }
    const since = Date.now() - WEEK_MS;

    // Full per-user scans, same trade-off as focus.ts: fine at MVP scale.
    // If history ever grows huge, these become indexed range queries.
    const [tasks, sessions, parked] = await Promise.all([
      ctx.db
        .query("tasks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("focusSessions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("parkedThoughts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    return {
      // Every completion counts, in focus or off the list — being generous
      // here costs nothing and the number exists to encourage. Top-level
      // only: finishing a five-step task is one finish, not six.
      completed: tasks.filter(
        (t) =>
          t.parentId === undefined &&
          t.completedAt !== undefined &&
          t.completedAt >= since
      ).length,
      // Interruptions are events, not task states — the same task switched
      // away from twice counts twice.
      interrupted: sessions.filter(
        (s) =>
          s.outcome === "interrupted" &&
          s.endedAt !== undefined &&
          s.endedAt >= since
      ).length,
      parked: parked.filter((p) => p._creationTime >= since).length,
    };
  },
});

// The week's focus story, newest first: every session that ended with an
// explicit outcome, joined with its task's title. Open sessions aren't
// history yet. "Abandoned" sessions (focus switched without going through
// the Gate) stay out: the spec surfaces completions and interruptions, and
// a row that says "you walked away" with no reason attached reads as blame.
export const focusLog = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (userId === null) {
      return [];
    }
    const since = Date.now() - WEEK_MS;
    const sessions = await ctx.db
      .query("focusSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const entries = [];
    for (const session of sessions) {
      if (session.endedAt === undefined || session.endedAt < since) continue;
      if (
        session.outcome !== "completed" &&
        session.outcome !== "interrupted"
      ) {
        continue;
      }
      // The session's own userId was already checked; its task is the same
      // user's by construction (startSession proves ownership on create).
      const task = await ctx.db.get(session.taskId);
      entries.push({
        _id: session._id,
        outcome: session.outcome,
        endedAt: session.endedAt,
        interruptReason: session.interruptReason,
        // Tasks can't be deleted today, but a join should never explode if
        // that ever changes — the UI renders a quiet placeholder for null.
        taskTitle: task === null ? null : task.title,
      });
    }
    // by_user iterates in start order; the log reads in ended order.
    entries.sort((a, b) => b.endedAt - a.endedAt);
    return entries;
  },
});
