import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
  GAP,
  completeTaskWithSteps,
  currentUserId,
  getOwnedTask,
  requireUserId,
  sectionTasks,
  subtasksOf,
} from "./helpers";

// The two sections of the main list. "done"/"interrupted" tasks are reached
// through other views (insights), not created into directly.
const sectionStatus = v.union(v.literal("inbox"), v.literal("active"));
const anyStatus = v.union(
  v.literal("inbox"),
  v.literal("active"),
  v.literal("done"),
  v.literal("interrupted")
);

function cleanTitle(raw: string): string {
  const title = raw.trim();
  if (title.length === 0) {
    throw new Error("Title cannot be empty");
  }
  // Validators can't cap string size — enforce it here so a misbehaving
  // client can't flood storage.
  if (title.length > 200) {
    throw new Error("Title is too long (200 characters max)");
  }
  return title;
}

// Quick capture. Zero required fields beyond the title — friction at capture
// time means lost thoughts.
export const create = mutation({
  args: {
    title: v.string(),
    status: v.optional(sectionStatus),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const status = args.status ?? "inbox";
    const existing = await sectionTasks(ctx, userId, status);
    // New captures land on top — seeing the thought arrive is the reward.
    const sortOrder = existing.length === 0 ? 0 : existing[0].sortOrder - GAP;
    return await ctx.db.insert("tasks", {
      userId,
      title: cleanTitle(args.title),
      status,
      sortOrder,
    });
  },
});

export const list = query({
  args: { status: anyStatus },
  handler: async (ctx, args) => {
    const userId = await currentUserId(ctx);
    if (userId === null) {
      // Signed-out transition: show an empty list rather than an error.
      return [];
    }
    return await sectionTasks(ctx, userId, args.status);
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    status: v.optional(anyStatus),
  },
  handler: async (ctx, args) => {
    const { task, userId } = await getOwnedTask(ctx, args.taskId);
    const patch: Partial<Doc<"tasks">> = {};
    if (args.title !== undefined) {
      patch.title = cleanTitle(args.title);
    }
    if (args.status !== undefined && args.status !== task.status) {
      // Subtasks live under their parent, never in the main sections — the
      // only transitions that make sense for them are done and back.
      if (
        task.parentId !== undefined &&
        args.status !== "active" &&
        args.status !== "done"
      ) {
        throw new Error("Subtasks can only be completed or reopened");
      }
      patch.status = args.status;
      if (args.status === "done") {
        patch.completedAt = Date.now();
      } else {
        // Reopening clears the timestamp (patching undefined removes the field).
        patch.completedAt = undefined;
        if (task.parentId === undefined) {
          // Moved top-level tasks land at the bottom of their destination
          // section; reopened subtasks just keep their place among siblings.
          const dest = await sectionTasks(ctx, userId, args.status);
          patch.sortOrder =
            dest.length === 0 ? 0 : dest[dest.length - 1].sortOrder + GAP;
        }
      }
    }
    await ctx.db.patch(args.taskId, patch);
  },
});

export const complete = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const { task } = await getOwnedTask(ctx, args.taskId); // proves ownership
    if (task.status === "done") {
      // Double-tap or a second device racing: keep the original completion
      // time — insights depend on it.
      return;
    }
    await completeTaskWithSteps(ctx, task);
  },
});

// The client sends the full id order for one section after a drag. The server
// re-derives the section, applies the client's arrangement to the ids it
// mentioned — anything it didn't know about (say, a capture from another
// device mid-drag) keeps its current slot — then renumbers the whole section
// with fresh gaps so racing reorders can never leave duplicate sortOrders.
export const reorder = mutation({
  args: {
    status: sectionStatus,
    orderedIds: v.array(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.orderedIds.length > 500) {
      throw new Error("Too many tasks to reorder at once");
    }
    // Ownership of every id the client sent is non-negotiable. An id that no
    // longer resolves is merely stale (deleted elsewhere), not hostile.
    const sent = await Promise.all(args.orderedIds.map((id) => ctx.db.get(id)));
    for (const doc of sent) {
      if (doc !== null && doc.userId !== userId) {
        throw new Error("Task not found");
      }
    }
    const section = await sectionTasks(ctx, userId, args.status);
    const inSection = new Set(section.map((t) => t._id));
    const sentIds = new Set(args.orderedIds);
    // The client's desired order, restricted to tasks actually here right now.
    const clientOrder = args.orderedIds.filter((id) => inSection.has(id));
    // Walk the current section: slots holding a task the client arranged get
    // the client's order; everything else stays where it is.
    let next = 0;
    const finalIds = section.map((t) =>
      sentIds.has(t._id) ? clientOrder[next++] : t._id
    );
    for (let i = 0; i < finalIds.length; i++) {
      await ctx.db.patch(finalIds[i], { sortOrder: (i + 1) * GAP });
    }
  },
});

export const addSubtask = mutation({
  args: {
    parentId: v.id("tasks"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const { task: parent, userId } = await getOwnedTask(ctx, args.parentId);
    // One level only — Focus Mode walks a flat sequence of steps, and nested
    // hierarchies are exactly the planning rabbit hole this app avoids.
    if (parent.parentId !== undefined) {
      throw new Error("Subtasks cannot have their own subtasks");
    }
    const siblings = await subtasksOf(ctx, args.parentId);
    const sortOrder =
      siblings.length === 0
        ? 0
        : siblings[siblings.length - 1].sortOrder + GAP;
    return await ctx.db.insert("tasks", {
      userId,
      title: cleanTitle(args.title),
      // Subtasks live under their parent, never in the inbox/today lists
      // (every list query filters parentId === undefined).
      status: "active",
      parentId: args.parentId,
      sortOrder,
    });
  },
});

export const listSubtasks = query({
  args: { parentId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await currentUserId(ctx);
    if (userId === null) {
      return [];
    }
    const parent = await ctx.db.get(args.parentId);
    // Same shape as an empty result — existence of other users' ids is
    // never revealed.
    if (parent === null || parent.userId !== userId) {
      return [];
    }
    return await subtasksOf(ctx, args.parentId);
  },
});
