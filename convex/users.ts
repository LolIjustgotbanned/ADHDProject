import { mutation, query } from "./_generated/server";
import { currentUserId, requireUserId } from "./helpers";

// The pattern every function in this app follows: derive the user from the
// auth context — never from a client-supplied argument.
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (userId === null) {
      // Signed out, or signed in before users.store has run. Clients gate
      // the app UI on this becoming non-null.
      return null;
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      return null;
    }
    // Project only what the UI needs — keep the row's shape private by
    // default as it grows.
    return { _id: user._id, name: user.name, email: user.email, image: user.image };
  },
});

// Mirrors the Clerk identity into our users table. Clients call this once
// after sign-in; queries that ran before it lands see a null viewer, which
// is exactly the gap the UI gate covers. Re-running refreshes the profile
// fields, so a name change in Clerk shows up here on next sign-in.
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not signed in");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", identity.subject)
      )
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        name: identity.name,
        email: identity.email,
        image: identity.pictureUrl,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      externalId: identity.subject,
      name: identity.name,
      email: identity.email,
      image: identity.pictureUrl,
    });
  },
});

// Erases the account and everything it owns. Exists for the iOS app: the
// App Store requires in-app account deletion (guideline 5.1.1(v)).
//
// Convex caps how much one mutation (one atomic transaction) may read and
// write, and years of tasks and sessions can exceed that — so the erase
// works in bounded batches: each call clears up to BATCH docs and reports
// whether it finished. Callers loop until { done: true }. Leaves (thoughts,
// sessions, tasks) go before the user row so no batch boundary can strand
// rows whose owner is already gone — the row (and with it requireUserId)
// survives until the final call. Each individual call either fully commits
// or fully rolls back; the Clerk-side user is deleted by the client only
// after done comes back true.
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const BATCH = 1000; // comfortably under Convex's per-transaction limits
    let remaining = BATCH;
    for (const table of ["parkedThoughts", "focusSessions", "tasks"] as const) {
      if (remaining === 0) break;
      const docs = await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(remaining);
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
      remaining -= docs.length;
    }
    if (remaining === 0) {
      // Budget spent — there may be more rows; the caller comes back.
      return { done: false };
    }
    // Every table handed back fewer docs than asked, so all three are empty.
    await ctx.db.delete(userId);
    return { done: true };
  },
});
