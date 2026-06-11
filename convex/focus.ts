import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  GAP,
  completeTaskWithSteps,
  getOwnedTask,
  requireUserId,
  sectionTasks,
} from "./helpers";

// Focus sessions: one per user at a time. A session with endedAt unset IS the
// active one — there is no separate "current session" pointer to drift out
// of sync.

// Scans the user's sessions for the open one. Fine at MVP scale (the index
// is per-user); if session history grows huge, add endedAt to the index.
async function activeSessionOf(ctx: QueryCtx, userId: Id<"users">) {
  const sessions = await ctx.db
    .query("focusSessions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return sessions.find((s) => s.endedAt === undefined) ?? null;
}

// The focus view's single subscription: the open session joined with its
// task. Null when nothing is in focus (or signed out).
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const session = await activeSessionOf(ctx, userId);
    if (session === null) {
      return null;
    }
    const task = await ctx.db.get(session.taskId);
    if (task === null) {
      return null;
    }
    return { session, task };
  },
});

export const startSession = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const { task, userId } = await getOwnedTask(ctx, args.taskId);
    if (task.parentId !== undefined) {
      // Focus runs on the parent; subtasks are the steps inside it (Phase 5).
      throw new Error("Focus on the parent task — subtasks are steps within it");
    }
    if (task.status === "done") {
      throw new Error("That task is already done");
    }

    const existing = await activeSessionOf(ctx, userId);
    if (existing !== null) {
      if (existing.taskId === args.taskId) {
        // Re-entering the same task's focus (page reload, back/forward)
        // resumes the running session instead of restarting the clock.
        return existing._id;
      }
      // Switching focus without an explicit outcome: the old session ends as
      // "abandoned" — the honest label for walking away mid-task. The Gate
      // (Phase 4) exists to make this path rare.
      await ctx.db.patch(existing._id, {
        endedAt: Date.now(),
        outcome: "abandoned",
      });
    }

    // Focusing a task means it's being worked on now — pull it into the
    // active section (bottom, like any other section move).
    if (task.status !== "active") {
      const dest = await sectionTasks(ctx, userId, "active");
      await ctx.db.patch(args.taskId, {
        status: "active",
        sortOrder:
          dest.length === 0 ? 0 : dest[dest.length - 1].sortOrder + GAP,
      });
    }

    return await ctx.db.insert("focusSessions", {
      userId,
      taskId: args.taskId,
      startedAt: Date.now(),
    });
  },
});

export const completeSession = mutation({
  args: { sessionId: v.id("focusSessions") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.userId !== userId) {
      throw new Error("Session not found");
    }
    if (session.endedAt !== undefined) {
      // Already closed (double-tap) — keep the original outcome and times.
      return;
    }
    await ctx.db.patch(args.sessionId, {
      endedAt: Date.now(),
      outcome: "completed",
    });
    // Finishing the focus finishes the task itself — including any steps
    // still open (e.g. one added on another device a moment ago).
    const task = await ctx.db.get(session.taskId);
    if (task !== null) {
      await completeTaskWithSteps(ctx, task);
    }
  },
});

// Called by the Gate's "Switch anyway" path (Phase 4): the session ends with
// a logged reason, and the task is flagged interrupted — data, not judgment.
export const interruptSession = mutation({
  args: {
    sessionId: v.id("focusSessions"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.userId !== userId) {
      throw new Error("Session not found");
    }
    if (session.endedAt !== undefined) {
      // Already closed — a no-op regardless of payload, same as completeSession.
      return;
    }
    const reason = args.reason.trim();
    if (reason.length === 0) {
      throw new Error("A short reason helps future you — even one word");
    }
    if (reason.length > 280) {
      throw new Error("Keep the reason short (280 characters max)");
    }
    await ctx.db.patch(args.sessionId, {
      endedAt: Date.now(),
      outcome: "interrupted",
      interruptReason: reason,
    });
    const task = await ctx.db.get(session.taskId);
    if (task !== null && task.status === "active") {
      await ctx.db.patch(task._id, { status: "interrupted" });
    }
  },
});
