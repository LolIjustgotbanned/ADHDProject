// Tells the Convex deployment to trust the JWTs that Convex Auth itself
// issues. CONVEX_SITE_URL is the deployment's own HTTP-actions URL — Convex
// provides it automatically; it is never set by hand. "convex" matches the
// audience claim stamped into those tokens.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
