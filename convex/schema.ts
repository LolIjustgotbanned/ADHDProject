import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Convex Auth stores its state (users, sessions, verification codes) as
  // regular tables in OUR database — there is no external auth service.
  // Spreading authTables in is required or auth deploys fail.
  ...authTables,

  tasks: defineTable({
    // A real foreign key into Convex Auth's users table, not a plain string —
    // Convex validates it on write and getAuthUserId() returns exactly this type.
    userId: v.id("users"),
    title: v.string(),
    status: v.union(
      v.literal("inbox"),
      v.literal("active"),
      v.literal("done"),
      v.literal("interrupted")
    ),
    parentId: v.optional(v.id("tasks")), // present only on subtasks
    sortOrder: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_parent", ["parentId"]),

  focusSessions: defineTable({
    userId: v.id("users"),
    taskId: v.id("tasks"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    outcome: v.optional(
      v.union(
        v.literal("completed"),
        v.literal("interrupted"),
        v.literal("abandoned")
      )
    ),
    interruptReason: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  parkedThoughts: defineTable({
    userId: v.id("users"),
    focusSessionId: v.id("focusSessions"),
    content: v.string(),
    convertedToTask: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["focusSessionId"]),
});
