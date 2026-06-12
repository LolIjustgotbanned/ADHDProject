# LockIn

A task manager for people with ADHD whose core problem is task-hopping. Most
ADHD apps help you plan; LockIn intervenes **in the moment** — it makes
abandoning a task harder than finishing it, and makes capturing distractions
effortless so they stop hijacking your focus.

## Stack

- **Next.js 14** (App Router, TypeScript strict) + **Tailwind CSS**
- **Convex** — the entire backend: database, typed queries/mutations, real-time
  reactivity. All data logic lives in `convex/`; components only ever talk to
  it through `useQuery` / `useMutation`.
- **Clerk** — identity for both this web app and the native iOS app (email
  verification codes, Google, Sign in with Apple). Convex validates Clerk's
  JWTs; our `users` table mirrors one row per Clerk user.

## Running locally

Two terminals, both from this directory:

```bash
npx convex dev   # syncs convex/ functions to your dev deployment, watches for changes
npm run dev      # Next.js on http://localhost:3000
```

`npx convex dev` writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to
`.env.local` on first run. `convex/_generated/` is codegen output — never edit
it by hand.

## Clerk setup (one-time)

1. Create a Clerk application (clerk.com) with **Email verification code**,
   **Google**, and **Apple** enabled, then run its **Convex integration**
   (Configure → Integrations → Convex) — that creates the JWT template named
   `convex` and shows the issuer domain (the Frontend API URL).
2. Tell each Convex deployment to trust it:

   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-instance>.clerk.accounts.dev
   npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN <production instance domain>
   ```

3. Put the Clerk keys in `.env.local` (and in Vercel for prod):

   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   ```

Dev instances ship shared Google OAuth credentials, so Google sign-in works
locally with zero extra setup; the production instance needs real Google
credentials and (for iOS) the Sign in with Apple configuration.

## Layout

- `convex/` — schema + all backend functions (the only place data is read or written)
- `app/` — routes: `/` landing, `/login` (Clerk), `/app` task list, `/app/focus/[taskId]`, `/app/insights`
- `components/` — client components (anything using Convex hooks or interactivity)
- `middleware.ts` — signed-out redirect for `/app/*` via Clerk. UX only: real
  authorization happens inside every Convex function via `helpers.currentUserId`.
