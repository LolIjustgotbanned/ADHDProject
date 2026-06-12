// Tells the Convex deployment to trust JWTs issued by our Clerk instance.
// CLERK_JWT_ISSUER_DOMAIN is the Clerk Frontend API URL (per instance — dev
// and prod deployments each point at their own Clerk instance via
// `npx convex env set`). "convex" matches the name of the JWT template the
// Clerk dashboard's Convex integration creates.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
