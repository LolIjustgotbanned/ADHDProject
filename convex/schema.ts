import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Identity lives in Clerk; this table is our mirror of it. One row per
  // Clerk user, created by users.store on first sign-in. Keyed by the JWT's
  // `subject` claim (the Clerk user id) — NOT tokenIdentifier, which embeds
  // the issuer domain and would break if dev/prod Clerk instances change.
  // Keeping a first-party users table means every other table can hold a
  // real v.id("users") foreign key that Convex validates on write.
  users: defineTable({
    externalId: v.string(), // Clerk user id (JWT `subject`)
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
  }).index("by_external_id", ["externalId"]),

  tasks: defineTable({
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
