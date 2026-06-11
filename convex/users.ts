import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

// The pattern every function in this app follows: derive the user from the
// auth context via getAuthUserId — never from a client-supplied argument.
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      // Signed out (or token expired). Returning null instead of throwing
      // lets the UI render a sane state during the sign-out transition.
      return null;
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      return null;
    }
    // Project only what the UI needs — auth bookkeeping fields (verification
    // timestamps etc.) stay private by default as the user doc grows.
    return { _id: user._id, name: user.name, email: user.email, image: user.image };
  },
});
