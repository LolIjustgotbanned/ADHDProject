import { FocusLog, ParkLog, WeeklyStats } from "@/components/Insights";

// Server Component: composition only, same as the main list page — the
// panels hold the live Convex subscriptions. Living inside (shell) keeps
// the header and the always-present capture bar.
export default function InsightsPage() {
  return (
    <div className="flex flex-col gap-10">
      <WeeklyStats />
      <FocusLog />
      <ParkLog />
    </div>
  );
}
