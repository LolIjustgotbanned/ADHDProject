import { EnsureSignedIn } from "@/components/EnsureSignedIn";

// Covers every /app route — the (shell) pages AND the focus takeover, which
// deliberately lives outside the shell. Pass-through except for the demo-mode
// auto sign-in; the visual chrome stays in (shell)/layout.tsx.
export default function AppRoot({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <EnsureSignedIn />
      {children}
    </>
  );
}
