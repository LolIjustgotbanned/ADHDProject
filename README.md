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
- **Convex Auth** (`@convex-dev/auth`) — email magic links (Resend) + Google
  OAuth. Auth state lives in our own Convex database.

## Running locally

Two terminals, both from this directory:

```bash
npx convex dev   # syncs convex/ functions to your dev deployment, watches for changes
npm run dev      # Next.js on http://localhost:3000
```

`npx convex dev` writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to
`.env.local` on first run. `convex/_generated/` is codegen output — never edit
it by hand.

## Auth secrets (one-time setup)

Auth providers run on Convex's servers, so their secrets live on the Convex
deployment — **not** in `.env.local`:

```bash
npx convex env set AUTH_RESEND_KEY <your Resend API key>
npx convex env set AUTH_GOOGLE_ID <your Google OAuth client id>
npx convex env set AUTH_GOOGLE_SECRET <your Google OAuth client secret>
```

Notes:

- **Resend**: until you verify a domain, magic links only deliver to the email
  you signed up to Resend with.
- **Google OAuth** (Google Cloud console → Credentials → OAuth client):
  - Authorized JavaScript origin: `http://localhost:3000`
  - Authorized redirect URI:
    `https://<your-deployment>.convex.site/api/auth/callback/google`
    (the deployment's `.site` URL — same as `NEXT_PUBLIC_CONVEX_URL` with
    `.cloud` swapped for `.site`)
- `SITE_URL`, `JWT_PRIVATE_KEY` and `JWKS` were set by `npx @convex-dev/auth`
  during setup.

## Layout

- `convex/` — schema + all backend functions (the only place data is read or written)
- `app/` — routes: `/` landing, `/login`, `/app` task list, `/app/focus/[taskId]`, `/app/insights`
- `components/` — client components (anything using Convex hooks or interactivity)
- `middleware.ts` — signed-out redirect for `/app/*`. UX only: real
  authorization happens inside every Convex function via `getAuthUserId`.
