import Link from "next/link";

// The marketing landing — one screen, one job: route people to sign-up.
// A Server Component with no client or data dependencies of its own (the
// route still renders per request: the auth provider in the root layout
// reads cookies, which opts every route into dynamic rendering). Signed-in
// visitors who click through land on /login, and the middleware bounces
// them straight into /app.
const features = [
  {
    title: "Capture in two seconds",
    body: "One box, zero required fields. A stray thought lands in your inbox before it can take over.",
  },
  {
    title: "Lock in on one task",
    body: "Focus Mode shows the task you picked and nothing else — big tasks become one step at a time.",
  },
  {
    title: "A gate on the way out",
    body: "Tempted to switch? Park the thought and stay on track. Parking costs nothing; leaving takes one honest sentence.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
        <span className="font-medium tracking-tight">LockIn</span>
        <Link
          href="/login"
          className="flex min-h-11 items-center text-sm text-muted transition hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
          Finish what you start.
        </h1>
        <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted">
          LockIn is a task manager for minds that wander — built not for
          planning your day, but for the moment a distraction shows up.
        </p>
        <Link
          href="/login"
          className="mt-10 rounded-full bg-accent px-8 py-4 text-lg font-medium text-accent-foreground transition hover:opacity-90 active:scale-[0.99]"
        >
          Get started
        </Link>

        <ul className="mt-16 grid w-full gap-8 text-left sm:grid-cols-3 sm:gap-6">
          {features.map((feature) => (
            <li key={feature.title}>
              {/* One warm accent, used sparingly everywhere in the app —
                  here a quiet tick of it marks each promise. */}
              <span aria-hidden className="block h-1 w-8 rounded-full bg-accent" />
              <h2 className="mt-3 font-medium">{feature.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
