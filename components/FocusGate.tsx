"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";

// The Gate — and its gentler sibling. Two ways in:
//   variant="park": the proactive "Park a thought" button. Capture the
//     distraction, stay locked in.
//   variant="gate": an exit attempt (Back / Esc / browser back). Parking is
//     deliberately the most prominent path; switching away asks for one
//     honest sentence.
// Gentle friction, never punishment — every string here stays warm.
export function FocusGate({
  sessionId,
  variant,
  onClose,
  onSwitch,
  onParked,
}: {
  sessionId: Id<"focusSessions">;
  variant: "park" | "gate";
  onClose: () => void;
  onSwitch: () => void;
  onParked: () => void;
}) {
  const parkThought = useMutation(api.parked.parkThought);
  const interruptSession = useMutation(api.focus.interruptSession);

  const [thought, setThought] = useState("");
  const [reason, setReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  // Which mutation is in flight, if any. While a save is pending the Gate
  // refuses to dismiss — a typed thought must never be lost to a slow save.
  const [busy, setBusy] = useState<null | "park" | "switch">(null);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const parkInputRef = useRef<HTMLInputElement>(null);
  // Fresh values for the document-level key handler below.
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const safeClose = () => {
    if (busy === null) onClose();
  };

  // Esc and Tab are handled at the DOCUMENT level (capture phase): a React
  // handler on the dialog div goes dead whenever focus falls to <body> —
  // e.g. after clicking the card's padding — and Tab must be caught even
  // then, or keyboard focus wanders into the obscured page behind the modal.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation(); // the page's own Esc listener stays out of it
        if (busyRef.current === null) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (dialog === null) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, [href]'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!dialog.contains(document.activeElement)) {
        // Focus escaped (or never arrived) — pull it back in.
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const handlePark = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy !== null || thought.trim().length === 0) return;
    setBusy("park");
    setError(null);
    // The input keeps its value until the save confirms — a parked thought
    // must never be lost to a flaky connection.
    parkThought({ sessionId, content: thought })
      .then(() => {
        onParked();
        onClose();
      })
      .catch(() => {
        setBusy(null);
        setError("That didn’t save — it’s still here, try again?");
      });
  };

  const handleSwitch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy !== null || reason.trim().length === 0) return;
    setBusy("switch");
    setError(null);
    interruptSession({ sessionId, reason })
      .then(onSwitch)
      .catch(() => {
        setBusy(null);
        setError("That didn’t go through — mind trying again?");
      });
  };

  return (
    // Pressing the dimmed backdrop = "keep going". pointerdown (not click)
    // with a target check, so drag-selecting text in an input and releasing
    // over the backdrop can never dismiss the Gate and eat the thought.
    // Bottom sheet on phones, centered card from sm up.
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 sm:items-center"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) safeClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        className="w-full rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl sm:pb-6"
      >
        <h2 id="gate-title" className="text-xl font-semibold">
          {variant === "gate" ? "What’s pulling you away?" : "Park it for later"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {variant === "gate"
            ? "Park the thought — it lands in your inbox, and you stay on track."
            : "It lands in your inbox, safe until you’re done here."}
        </p>

        <form onSubmit={handlePark} className="mt-5 flex flex-col gap-3">
          <input
            ref={parkInputRef}
            autoFocus
            value={thought}
            onChange={(event) => setThought(event.target.value)}
            maxLength={200}
            aria-label="The thought to park"
            aria-describedby="gate-error"
            placeholder="What just popped into your head?"
            className="rounded-xl border border-border bg-background px-4 py-3 placeholder:text-muted/80 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy !== null || thought.trim().length === 0}
            className="rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy === "park"
              ? "Parking…"
              : variant === "gate"
                ? "Park it and stay"
                : "Park it"}
          </button>
        </form>

        {/* Persistent live region: screen readers only announce text that
            CHANGES inside an existing region, never mount-with-content. */}
        <p role="status" id="gate-error" className="mt-2 min-h-5 text-sm">
          {error ?? ""}
        </p>

        {variant === "gate" ? (
          <div className="mt-4 border-t border-border pt-4">
            {!reasonOpen ? (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={safeClose}
                  className="flex min-h-11 items-center text-sm text-muted transition hover:text-foreground"
                >
                  Keep going
                </button>
                {/* Quiet by design — switching is allowed, never invited. */}
                <button
                  type="button"
                  onClick={() => setReasonOpen(true)}
                  className="flex min-h-11 items-center text-sm text-muted underline-offset-4 transition hover:text-foreground hover:underline"
                >
                  Switch anyway
                </button>
              </div>
            ) : (
              <form onSubmit={handleSwitch} className="flex flex-col gap-3">
                <label htmlFor="switch-reason" className="text-sm text-muted">
                  Okay — what’s pulling you away? One sentence is plenty.
                </label>
                <input
                  id="switch-reason"
                  autoFocus
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={280}
                  aria-describedby="gate-error"
                  placeholder="e.g. urgent email I have to answer"
                  className="rounded-xl border border-border bg-background px-4 py-3 placeholder:text-muted/80 focus:border-accent focus:outline-none"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      // Collapsing the form unmounts the focused button —
                      // hand focus somewhere sensible, not <body>.
                      setReasonOpen(false);
                      parkInputRef.current?.focus();
                    }}
                    className="flex min-h-11 items-center text-sm text-muted transition hover:text-foreground"
                  >
                    Never mind
                  </button>
                  <button
                    type="submit"
                    disabled={busy !== null || reason.trim().length === 0}
                    className="flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium transition hover:border-muted/50 disabled:opacity-50"
                  >
                    {busy === "switch" ? "Saving…" : "Save & switch"}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={safeClose}
            className="mt-2 flex min-h-11 items-center text-sm text-muted transition hover:text-foreground"
          >
            Never mind
          </button>
        )}
      </div>
    </div>
  );
}
