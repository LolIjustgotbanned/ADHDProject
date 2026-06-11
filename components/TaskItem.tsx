"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Buttons here keep a ≥44px hit area (Apple HIG) even where the visible
// control is smaller — most capture and triage happens on phones.
export function TaskItem({ task }: { task: Doc<"tasks"> }) {
  const completeTask = useMutation(api.tasks.complete);
  const updateTask = useMutation(api.tasks.update);
  const addSubtask = useMutation(api.tasks.addSubtask);
  // Steps (subtasks) for this row — also powers the n/m badge, so it stays
  // subscribed while collapsed. A tiny per-row indexed query; cheap at the
  // list sizes this app deals in.
  const subtasks = useQuery(api.tasks.listSubtasks, { parentId: task._id });

  // Local-only flag so the check + strike-through animation plays before the
  // row actually leaves the list (the mutation fires after a beat).
  const [completing, setCompleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [stepValue, setStepValue] = useState("");

  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (completeTimer.current !== null) clearTimeout(completeTimer.current);
    };
  }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const handleComplete = () => {
    if (completing) return;
    setCompleting(true);
    completeTimer.current = setTimeout(() => {
      // A rejection (task deleted elsewhere) un-sticks the row instead of
      // leaving an invisible ghost at opacity-0.
      completeTask({ taskId: task._id }).catch(() => setCompleting(false));
    }, 400);
  };

  const handleAddStep = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = stepValue.trim();
    if (title.length === 0) return;
    setStepValue("");
    // Restore on failure — the same never-lose-a-thought rule as capture.
    addSubtask({ parentId: task._id, title }).catch(() => setStepValue(title));
  };

  const inInbox = task.status === "inbox";
  const total = subtasks?.length ?? 0;
  const doneCount = subtasks?.filter((s) => s.status === "done").length ?? 0;

  return (
    <li
      ref={setNodeRef}
      // dnd-kit drives transform/transition inline while dragging; the
      // Tailwind classes below handle the completion animation when idle.
      // The dragged row itself gets transition "none" — otherwise the class's
      // transition-all would ease every pointermove and the row would lag
      // behind the cursor.
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? "none" : transition,
      }}
      className={`group flex flex-col rounded-xl border border-border bg-surface transition-all duration-300 ${
        isDragging ? "z-10 opacity-80 shadow-lg shadow-black/30" : ""
      } ${completing ? "translate-x-3 opacity-0" : ""}`}
    >
      <div className="flex items-center gap-1 py-1.5 pl-1 pr-2">
        {/* Dedicated drag handle — whole-row dragging would fight scrolling on
            touch screens. touch-none lets the pointer sensor own the gesture. */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-muted/70 transition hover:text-muted active:cursor-grabbing"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
            <circle cx="5.5" cy="4" r="1.3" />
            <circle cx="10.5" cy="4" r="1.3" />
            <circle cx="5.5" cy="8" r="1.3" />
            <circle cx="10.5" cy="8" r="1.3" />
            <circle cx="5.5" cy="12" r="1.3" />
            <circle cx="10.5" cy="12" r="1.3" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleComplete}
          aria-label={`Mark “${task.title}” done`}
          className="group/check flex h-11 w-11 shrink-0 items-center justify-center"
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
              completing
                ? "border-accent bg-accent"
                : "border-muted/70 group-hover/check:border-accent"
            }`}
          >
            <svg
              viewBox="0 0 16 16"
              className={`h-3.5 w-3.5 text-accent-foreground transition-opacity duration-200 ${
                completing ? "opacity-100" : "opacity-0"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                d="M3.5 8.5L6.5 11.5L12.5 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        <span
          className={`min-w-0 flex-1 select-text break-words text-base leading-snug transition-colors duration-300 ${
            completing ? "text-muted line-through" : ""
          }`}
        >
          {task.title}
        </span>

        {/* Steps toggle: a dedicated badge+chevron control, NOT the title —
            titles stay selectable, and the accessible name can carry the
            progress the badge shows. Badge hides on phones, where every
            pixel of title width counts. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={
            total > 0
              ? `Steps for “${task.title}” — ${doneCount} of ${total} done`
              : `Add steps to “${task.title}”`
          }
          className="flex min-h-11 w-11 shrink-0 items-center justify-center gap-1 rounded-lg text-muted transition hover:bg-border/50 hover:text-foreground sm:w-auto sm:px-2"
        >
          {total > 0 && (
            <span className="hidden text-xs tabular-nums sm:inline">
              {doneCount}/{total}
            </span>
          )}
          <svg
            viewBox="0 0 16 16"
            className={`h-4 w-4 shrink-0 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Icon-only below sm — five text controls per row would crush the
            title on a 375px phone, the platform where triage happens most. */}
        <Link
          href={`/app/focus/${task._id}`}
          aria-label={`Focus on “${task.title}”`}
          className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-medium text-accent transition hover:bg-accent/10 sm:w-auto sm:justify-start sm:px-3"
        >
          <span className="hidden sm:inline">Focus</span>
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 sm:hidden"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
          </svg>
        </Link>

        <button
          type="button"
          disabled={completing}
          onClick={() =>
            updateTask({
              taskId: task._id,
              status: inInbox ? "active" : "inbox",
            }).catch(() => {})
          }
          aria-label={`Move “${task.title}” to ${inInbox ? "Today" : "Inbox"}`}
          className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-medium text-muted transition hover:bg-border/50 hover:text-foreground disabled:opacity-50 sm:w-auto sm:px-3"
        >
          {inInbox ? (
            <>
              <span className="hidden sm:inline">Today&nbsp;</span>
              <span aria-hidden>→</span>
            </>
          ) : (
            <>
              <span aria-hidden>←</span>
              <span className="hidden sm:inline">&nbsp;Inbox</span>
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/60 px-3 pb-3 pt-1">
          {subtasks === undefined ? (
            <div className="my-2 h-8 animate-pulse rounded-lg bg-background/60" />
          ) : (
            <>
              {subtasks.length > 0 && (
                <ul className="flex flex-col">
                  {subtasks.map((subtask) => (
                    <SubtaskRow key={subtask._id} subtask={subtask} />
                  ))}
                </ul>
              )}
              <form onSubmit={handleAddStep} className="mt-1">
                <input
                  value={stepValue}
                  onChange={(event) => setStepValue(event.target.value)}
                  maxLength={200}
                  aria-label={`Add a step to “${task.title}”`}
                  placeholder={
                    subtasks.length === 0
                      ? "Break it down — what’s the first step?"
                      : "Add a step…"
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted/80 focus:border-accent focus:outline-none"
                />
              </form>
            </>
          )}
        </div>
      )}
    </li>
  );
}

// One step inside the expanded editor: check off, or un-check to reopen.
// Steps never appear in the main lists — they only live here and in Focus
// Mode's one-at-a-time walker.
function SubtaskRow({ subtask }: { subtask: Doc<"tasks"> }) {
  const completeTask = useMutation(api.tasks.complete);
  const updateTask = useMutation(api.tasks.update);
  // In-flight guard: a fast check-then-uncheck would otherwise read stale
  // state twice and send the same mutation twice, eating the second tap.
  const [pending, setPending] = useState(false);
  const isDone = subtask.status === "done";

  const toggle = () => {
    if (pending) return;
    setPending(true);
    (isDone
      ? updateTask({ taskId: subtask._id, status: "active" }) // reopen
      : completeTask({ taskId: subtask._id })
    )
      .catch(() => {})
      .finally(() => setPending(false));
  };

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={
          isDone ? `Reopen “${subtask.title}”` : `Mark “${subtask.title}” done`
        }
        className="group/step flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
            isDone
              ? "border-accent bg-accent"
              : "border-muted/70 group-hover/step:border-accent"
          }`}
        >
          <svg
            viewBox="0 0 16 16"
            className={`h-3 w-3 text-accent-foreground transition-opacity duration-200 ${
              isDone ? "opacity-100" : "opacity-0"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              d="M3.5 8.5L6.5 11.5L12.5 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <span
        className={`min-w-0 flex-1 break-words py-2 text-sm leading-snug transition-colors duration-200 ${
          isDone ? "text-muted line-through" : ""
        }`}
      >
        {subtask.title}
      </span>
    </li>
  );
}
