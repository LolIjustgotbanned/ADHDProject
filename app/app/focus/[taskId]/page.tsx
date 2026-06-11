"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { FocusGate } from "@/components/FocusGate";
import { FocusTimer } from "@/components/FocusTimer";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// Focus Mode — the heart of the app. One task, full screen, nothing else.
// This route deliberately lives OUTSIDE the (shell) layout group: no header,
// no capture bar, no controls hiding behind the overlay. While locked in,
// the rest of the app does not exist — for keyboards and screen readers too.
export default function FocusPage({
  params,
}: {
  params: { taskId: string };
}) {
  const taskId = params.taskId as Id<"tasks">;
  const router = useRouter();

  const active = useQuery(api.focus.getActiveSession);
  const startSession = useMutation(api.focus.startSession);
  const completeSession = useMutation(api.focus.completeSession);
  const completeTask = useMutation(api.tasks.complete);

  const [showTimer, setShowTimer] = useState(true);
  const [stepBusy, setStepBusy] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // The Gate: null = closed, "gate" = an exit attempt was intercepted,
  // "park" = the proactive Park-a-thought button.
  const [gate, setGate] = useState<null | "park" | "gate">(null);
  const [showParkedToast, setShowParkedToast] = useState(false);

  // Which task this page has ASKED to start vs which it was actually LOCKED
  // INTO. The distinction matters: "never started" should start a session;
  // "was locked in, now the session is gone" means it ended somewhere else
  // (another tab or device) and this page should leave quietly.
  const startedFor = useRef<string | null>(null);
  const lockedTask = useRef<string | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelArmed = useRef(false);
  const celebratingRef = useRef(false);
  celebratingRef.current = celebrating;

  const isMine = active != null && active.task._id === taskId;

  // Steps for this task (skipped until the session is ours). If any exist,
  // Focus Mode walks them one at a time — one thing on screen, always.
  const subtasks = useQuery(
    api.tasks.listSubtasks,
    isMine ? { parentId: taskId } : "skip"
  );
  const openSteps = (subtasks ?? []).filter((s) => s.status !== "done");
  const currentStep = openSteps[0]; // undefined → behave like a plain task
  const totalSteps = subtasks?.length ?? 0;
  const doneSteps = totalSteps - openSteps.length;
  const hasSteps = currentStep !== undefined;

  // Browser/gesture back is the most common exit attempt on phones — without
  // this it would bypass the Gate entirely. Push a sentinel history entry;
  // popping it re-arms the sentinel and opens the Gate instead of leaving.
  // Best-effort by nature: genuine exits use router.replace, which never
  // pops, so they are unaffected.
  useEffect(() => {
    if (!isMine || sentinelArmed.current) return;
    sentinelArmed.current = true;
    window.history.pushState({ lockinGate: true }, "");
    const onPopState = () => {
      if (celebratingRef.current) return; // finishing anyway — don't fight it
      window.history.pushState({ lockinGate: true }, "");
      setGate((g) => g ?? "gate");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isMine]);

  useEffect(() => {
    if (active === undefined || celebrating) return; // loading / finishing
    if (isMine) {
      lockedTask.current = taskId;
      startedFor.current = taskId;
      return;
    }
    if (lockedTask.current === taskId) {
      // We were locked in here and the session ended elsewhere.
      router.replace("/app");
      return;
    }
    if (startedFor.current === taskId) return; // start already in flight
    startedFor.current = taskId;
    // Bad/foreign/already-done task ids throw — quietly return to the list.
    startSession({ taskId }).catch(() => router.replace("/app"));
  }, [active, celebrating, isMine, taskId, startSession, router]);

  // Don't leave timers running past unmount (browser back) — a stale
  // navigation callback would yank the user out of whatever they're doing.
  useEffect(() => {
    return () => {
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    };
  }, []);

  // Esc is an exit attempt — it opens the Gate, same as the Back button.
  // While the Gate is open it handles its own Esc (which means "keep going").
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMine && !celebrating && gate === null) {
        setGate("gate");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMine, celebrating, gate]);

  // Keyboard and screen-reader users should land inside the takeover when it
  // opens (and get focus back when the Gate closes), not on <body>.
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isMine && !celebrating && gate === null) mainRef.current?.focus();
  }, [isMine, celebrating, gate]);

  const finishNow = useCallback(() => {
    if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    router.replace("/app");
  }, [router]);

  const handleDone = () => {
    if (!active || celebrating) return;
    setSaveFailed(false);
    setCelebrating(true);
    // The exit timer arms only once the save is CONFIRMED — armed up front,
    // a slow failure would navigate away before it could be shown.
    completeSession({ sessionId: active.session._id })
      .then(() => {
        exitTimer.current = setTimeout(finishNow, 1300);
      })
      .catch(() => {
        // The moment didn't actually save — stop celebrating and say so.
        setCelebrating(false);
        setSaveFailed(true);
      });
  };

  const handleParked = useCallback(() => {
    setShowParkedToast(true);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowParkedToast(false), 2500);
  }, []);

  // "Next →": finish the current step; the live query slides the next one in.
  const handleNextStep = () => {
    if (!currentStep || stepBusy) return;
    setStepBusy(true);
    setSaveFailed(false);
    completeTask({ taskId: currentStep._id })
      // A dead-feeling button mid-focus is the exact frustration this app
      // exists to avoid — failures get the same warm retry copy as Done.
      .catch(() => setSaveFailed(true))
      .finally(() => setStepBusy(false));
  };

  // The last open step IS finishing the task: complete the step, then the
  // session (which marks the parent done), with the usual celebration.
  const handleLastStep = () => {
    if (!active || !currentStep || stepBusy || celebrating) return;
    setStepBusy(true);
    setSaveFailed(false);
    setCelebrating(true);
    completeTask({ taskId: currentStep._id })
      .then(() => completeSession({ sessionId: active.session._id }))
      .then(() => {
        // Armed only after BOTH saves confirm — see handleDone.
        exitTimer.current = setTimeout(finishNow, 1300);
      })
      .catch(() => {
        setCelebrating(false);
        setSaveFailed(true);
      })
      .finally(() => setStepBusy(false));
  };

  if (celebrating) {
    return (
      // role="status" announces the text; focus moves here so the moment has
      // a home; tap or Enter skips the 1.3s wait.
      <div
        role="status"
        tabIndex={-1}
        ref={(el) => el?.focus()}
        onClick={finishNow}
        onKeyDown={(event) => {
          if (event.key === "Enter") finishNow();
        }}
        className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-background px-6 text-center outline-none"
      >
        <span className="flex h-24 w-24 animate-pop items-center justify-center rounded-full bg-accent motion-reduce:animate-none">
          <svg
            viewBox="0 0 24 24"
            className="h-12 w-12 text-accent-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden
          >
            <path
              d="M5 13l5 5L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="text-2xl font-semibold">Done. That’s one.</p>
        <p className="text-muted">Heading back to your list — tap to skip.</p>
      </div>
    );
  }

  // Loading, the session still starting up, or the steps not yet known —
  // waiting on both avoids a flash of the parent title before its first step.
  if (!isMine || subtasks === undefined) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="text-sm text-muted">Locking in…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Always-mounted live region: screen readers only announce text that
          CHANGES inside an existing region — a region mounted together with
          its content is unreliably (often never) read. */}
      <div
        role="status"
        className={
          showParkedToast
            ? "pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-surface px-4 py-2 text-sm shadow-lg shadow-black/30"
            : "sr-only"
        }
      >
        {showParkedToast ? (
          <>
            Parked — it’s in your inbox <span aria-hidden>✓</span>
          </>
        ) : null}
      </div>

      <header className="flex items-center justify-between pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        {/* An exit attempt — the Gate intercepts it. */}
        <button
          type="button"
          onClick={() => setGate("gate")}
          className="flex min-h-11 items-center text-sm text-muted transition hover:text-foreground"
        >
          <span aria-hidden>←</span>&nbsp;Back
        </button>
        <button
          type="button"
          onClick={() => setShowTimer((v) => !v)}
          className="flex min-h-11 items-center text-sm text-muted transition hover:text-foreground"
        >
          {showTimer ? "Hide timer" : "Show timer"}
        </button>
      </header>

      <main
        ref={mainRef}
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center outline-none"
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted">
          Locked in
        </p>
        {/* Persistent polite region: advancing a step swaps the heading, and
            the change (not the initial mount) gets announced. The timer lives
            OUTSIDE this region — it must never chatter. */}
        <div
          aria-live="polite"
          className="flex flex-col items-center gap-3"
        >
          {hasSteps ? (
            <>
              <p className="max-w-xl text-sm text-muted">{active.task.title}</p>
              <h1
                key={currentStep._id}
                className="max-w-xl animate-step text-balance text-3xl font-semibold leading-tight motion-reduce:animate-none sm:text-4xl"
              >
                {currentStep.title}
              </h1>
              {/* aria-atomic: announce "Step 3 of 4" as one unit — without it
                  only the changed number is read, context-free. */}
              <p aria-atomic="true" className="text-xs tabular-nums text-muted">
                Step {doneSteps + 1} of {totalSteps}
              </p>
            </>
          ) : (
            <h1 className="max-w-xl text-balance text-3xl font-semibold leading-tight sm:text-4xl">
              {active.task.title}
            </h1>
          )}
        </div>
        {showTimer && <FocusTimer startedAt={active.session.startedAt} />}
      </main>

      <footer className="flex flex-col items-center gap-3 pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]">
        {saveFailed && (
          <p className="text-sm text-muted">
            That didn’t save — give it another go?
          </p>
        )}
        {hasSteps && openSteps.length > 1 ? (
          <button
            type="button"
            onClick={handleNextStep}
            disabled={stepBusy}
            className="w-full max-w-sm rounded-2xl bg-accent px-6 py-4 text-lg font-semibold text-accent-foreground transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
          >
            Next <span aria-hidden>→</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={hasSteps ? handleLastStep : handleDone}
            disabled={stepBusy}
            className="w-full max-w-sm rounded-2xl bg-accent px-6 py-4 text-lg font-semibold text-accent-foreground transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
          >
            Done <span aria-hidden>✓</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setGate("park")}
          className="flex min-h-11 items-center text-sm text-muted transition hover:text-foreground"
        >
          Park a thought
        </button>
      </footer>

      {gate !== null && (
        <FocusGate
          sessionId={active.session._id}
          variant={gate}
          onClose={() => setGate(null)}
          onSwitch={() => router.replace("/app")}
          onParked={handleParked}
        />
      )}
    </div>
  );
}
