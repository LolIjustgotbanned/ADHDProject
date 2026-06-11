import { getAuthUserId } from "@convex-dev/auth/server";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Display order uses plain numbers with gaps, so dropping a task between two
// others never requires renumbering the whole list.
export const GAP = 1024;

export type TaskStatus = "inbox" | "active" | "done" | "interrupted";

// Auth helpers shared by every Convex function in the app.
//
// The rule: identity ALWAYS comes from the auth context, and any document id
// the client hands us is checked for ownership before it is read or written.
// Convex ids are not secrets — never rely on them being unguessable.

export async function requireUserId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not signed in");
  }
  return userId;
}

// Loads a task and proves the caller owns it. "Not found" covers both a
// missing doc and someone else's doc on purpose — revealing that a given id
// exists at all would leak information across accounts.
export async function getOwnedTask(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<"tasks">
) {
  const userId = await requireUserId(ctx);
  const task = await ctx.db.get(taskId);
  if (task === null || task.userId !== userId) {
    throw new Error("Task not found");
  }
  return { task, userId };
}

// Top-level tasks in one status, in display order. Subtasks (parentId set)
// never appear in these lists. MutationCtx is assignable to QueryCtx, so
// mutations can share this read helper.
export async function sectionTasks(
  ctx: QueryCtx,
  userId: Id<"users">,
  status: TaskStatus
): Promise<Doc<"tasks">[]> {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", userId).eq("status", status)
    )
    .collect();
  const topLevel = tasks.filter((t) => t.parentId === undefined);
  if (status === "done" || status === "interrupted") {
    // sortOrder is a section-position concept and stops meaning anything once
    // a task leaves its section — finished work reads newest-first instead.
    return topLevel.sort(
      (a, b) =>
        (b.completedAt ?? b._creationTime) - (a.completedAt ?? a._creationTime)
    );
  }
  return topLevel.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function subtasksOf(
  ctx: QueryCtx,
  parentId: Id<"tasks">
): Promise<Doc<"tasks">[]> {
  const subtasks = await ctx.db
    .query("tasks")
    .withIndex("by_parent", (q) => q.eq("parentId", parentId))
    .collect();
  return subtasks.sort((a, b) => a.sortOrder - b.sortOrder);
}

// Marks a task done. For parents, open steps complete with it — a done task
// must never leave invisible "active" subtasks floating beneath it (and a
// step added on another device mid-"Done" resolves to finished, matching
// what the user just declared about the whole task).
export async function completeTaskWithSteps(
  ctx: MutationCtx,
  task: Doc<"tasks">
) {
  const now = Date.now();
  if (task.status !== "done") {
    await ctx.db.patch(task._id, { status: "done", completedAt: now });
  }
  if (task.parentId === undefined) {
    const steps = await subtasksOf(ctx, task._id);
    for (const step of steps) {
      if (step.status !== "done") {
        await ctx.db.patch(step._id, { status: "done", completedAt: now });
      }
    }
  }
}
