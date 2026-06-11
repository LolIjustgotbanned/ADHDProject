"use client";

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TaskItem } from "./TaskItem";

type SectionStatus = "inbox" | "active";

export function TaskSection({
  status,
  title,
  emptyHint,
}: {
  status: SectionStatus;
  title: string;
  emptyHint: string;
}) {
  // Live subscription: anything that changes these tasks — capture, complete,
  // a reorder on another device — re-renders this list automatically.
  const tasks = useQuery(api.tasks.list, { status });
  // Today also surfaces tasks paused mid-focus ("interrupted") — an invisible
  // task is a lost task. The inbox section skips the extra subscription.
  const interrupted = useQuery(
    api.tasks.list,
    status === "active" ? { status: "interrupted" } : "skip"
  );

  // Optimistic update: write the new order into the local query cache the
  // moment the row is dropped, so it doesn't snap back while the mutation
  // round-trips. Convex replaces this with the server result when it lands.
  const reorder = useMutation(api.tasks.reorder).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.tasks.list, {
        status: args.status,
      });
      if (current === undefined) return;
      const byId = new Map(current.map((t) => [t._id, t]));
      const next = args.orderedIds.flatMap((id) => byId.get(id) ?? []);
      // Optimistic updates replay against fresh data while the mutation is in
      // flight — keep tasks the drag didn't know about (e.g. a capture from
      // another device) instead of dropping them. New ones land on top.
      const known = new Set<string>(args.orderedIds);
      const extras = current.filter((t) => !known.has(t._id));
      localStore.setQuery(api.tasks.list, { status: args.status }, [
        ...extras,
        ...next,
      ]);
    }
  );

  const sensors = useSensors(
    // The 5px threshold keeps taps (complete, move) from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!tasks || !over || active.id === over.id) return;
    const ids = tasks.map((t) => t._id);
    const oldIndex = ids.indexOf(active.id as Id<"tasks">);
    const newIndex = ids.indexOf(over.id as Id<"tasks">);
    if (oldIndex === -1 || newIndex === -1) return;
    // A rejected reorder (task deleted mid-drag, etc.) rolls the optimistic
    // update back on its own — swallowing the error just avoids an unhandled
    // rejection; the list visibly snaps to the server's order either way.
    reorder({ status, orderedIds: arrayMove(ids, oldIndex, newIndex) }).catch(
      () => {}
    );
  };

  const hasInterrupted = (interrupted?.length ?? 0) > 0;
  // Two independent subscriptions resolve at different moments — don't show
  // the "empty" hint while the paused list could still be on its way.
  const loading =
    tasks === undefined || (status === "active" && interrupted === undefined);

  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
        {title}
      </h2>

      {loading || tasks === undefined ? (
        // First load only — after that the subscription keeps data warm.
        <div className="mt-3 flex flex-col gap-2">
          <div className="h-12 animate-pulse rounded-xl bg-surface" />
          <div className="h-12 animate-pulse rounded-xl bg-surface" />
        </div>
      ) : tasks.length === 0 && !hasInterrupted ? (
        <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm leading-relaxed text-muted">
          {emptyHint}
        </p>
      ) : (
        <>
          {tasks.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
              // Expanded steps panels can change row heights mid-drag (live
              // updates from other devices) — keep re-measuring so the drop
              // lands where the user actually sees it.
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            >
              <SortableContext
                items={tasks.map((t) => t._id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="mt-3 flex flex-col gap-2">
                  {tasks.map((task) => (
                    <TaskItem key={task._id} task={task} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          {hasInterrupted && (
            <ul className="mt-2 flex flex-col gap-2">
              {interrupted!.map((task) => (
                <InterruptedRow key={task._id} task={task} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

// A task that was paused mid-focus by the Gate's "switch anyway" path.
// Quieter than a live row (dashed, translucent) but fully actionable:
// finish it, re-focus it, or send it back to the inbox. Not sortable —
// it's waiting, not queued.
function InterruptedRow({ task }: { task: Doc<"tasks"> }) {
  const completeTask = useMutation(api.tasks.complete);
  const updateTask = useMutation(api.tasks.update);
  const [completing, setCompleting] = useState(false);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (completeTimer.current !== null) clearTimeout(completeTimer.current);
    };
  }, []);

  const handleComplete = () => {
    if (completing) return;
    setCompleting(true);
    completeTimer.current = setTimeout(() => {
      // A rejection (task deleted elsewhere) un-sticks the row instead of
      // leaving an invisible ghost at opacity-0.
      completeTask({ taskId: task._id }).catch(() => setCompleting(false));
    }, 400);
  };

  return (
    <li
      className={`flex items-center gap-1 rounded-xl border border-dashed border-border bg-surface/60 py-1.5 pl-3 pr-2 transition-all duration-300 ${
        completing ? "translate-x-3 opacity-0" : ""
      }`}
    >
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
        className={`min-w-0 flex-1 break-words text-base leading-snug transition-colors duration-300 ${
          completing ? "text-muted line-through" : ""
        }`}
      >
        {task.title}
      </span>

      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
        paused
      </span>

      <Link
        href={`/app/focus/${task._id}`}
        aria-label={`Get back to “${task.title}”`}
        aria-disabled={completing}
        className={`flex min-h-11 shrink-0 items-center rounded-lg px-3 text-xs font-medium text-accent transition hover:bg-accent/10 ${
          completing ? "pointer-events-none opacity-50" : ""
        }`}
      >
        Resume
      </Link>

      <button
        type="button"
        disabled={completing}
        onClick={() =>
          updateTask({ taskId: task._id, status: "inbox" }).catch(() => {})
        }
        aria-label={`Move “${task.title}” to Inbox`}
        className="min-h-11 shrink-0 rounded-lg px-3 text-xs font-medium text-muted transition hover:bg-border/50 hover:text-foreground disabled:opacity-50"
      >
        <span aria-hidden>←</span> Inbox
      </button>
    </li>
  );
}
