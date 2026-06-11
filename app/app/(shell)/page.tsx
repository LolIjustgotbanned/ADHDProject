import { TaskSection } from "@/components/TaskSection";

// Server Component: composition only — the sections themselves are client
// components because they hold the live Convex subscriptions.
// Inbox sits on top so a fresh capture visibly lands right under the input.
export default function AppHome() {
  return (
    <div className="flex flex-col gap-10">
      <TaskSection
        status="inbox"
        title="Inbox"
        emptyHint="All clear. Got something on your mind? Capture it above."
      />
      <TaskSection
        status="active"
        title="Today"
        emptyHint="Nothing queued yet — pick one thing from your inbox."
      />
    </div>
  );
}
