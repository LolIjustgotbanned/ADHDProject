import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { GAP, currentUserId, requireUserId, sectionTasks } from "./helpers";

// Parked thoughts: distractions captured mid-focus. Each one lands in the
// inbox as a task immediately (one place to check, zero extra steps) and
// keeps a row here so insights can answer "how many distractions did focus
// catch this week?".

function cleanContent(raw: string): string {
  const content = raw.trim();
  if (content.length === 0) {
    throw new Error("Nothing to park yet — type the thought first");
  }
  // Matches the task-title cap so a parked thought always becomes a task
  // without truncation.
  if (content.length > 200) {
    throw new Error("Keep it short (200 characters max) — just enough to find the thread again");
  }
  return content;
}

// Same placement rule as tasks.create: new captures land on top of the inbox.
async function insertInboxTask(
  ctx: MutationCtx,
  userId: Id<"users">,
  title: string
) {
  const inbox = await sectionTasks(ctx, userId, "inbox");
  const sortOrder = inbox.length === 0 ? 0 : inbox[0].sortOrder - GAP;
  return await ctx.db.insert("tasks", {
    userId,
    title,
    status: "inbox",
    sortOrder,
  });
}

export const parkThought = mutation({
  args: {
    sessionId: v.id("focusSessions"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.userId !== userId) {
      throw new Error("Session not found");
    }
    const content = cleanContent(args.content);
    await insertInboxTask(ctx, userId, content);
    return await ctx.db.insert("parkedThoughts", {
      userId,
      focusSessionId: args.sessionId,
      content,
      convertedToTask: true, // it went straight to the inbox
    });
  },
});

export const listParked = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (userId === null) {
      return [];
    }
    // Index order is _creationTime within the user — desc gives newest first.
    return await ctx.db
      .query("parkedThoughts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Promotes a not-yet-converted parked thought to an inbox task. The main
// park flow converts immediately, so this mostly serves rows created by any
// future "park without inbox" path — and the Park Log's re-add affordance.
export const convertToTask = mutation({
  args: { parkedId: v.id("parkedThoughts") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const parked = await ctx.db.get(args.parkedId);
    if (parked === null || parked.userId !== userId) {
      throw new Error("Thought not found");
    }
    if (parked.convertedToTask) {
      return null; // already a task — nothing to do
    }
    const taskId = await insertInboxTask(ctx, userId, parked.content);
    await ctx.db.patch(args.parkedId, { convertedToTask: true });
    return taskId;
  },
});
