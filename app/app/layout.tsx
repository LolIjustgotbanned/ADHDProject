import { StoreUserOnSignIn } from "@/components/StoreUserOnSignIn";

// Covers every /app route — the (shell) pages AND the focus takeover, which
// deliberately lives outside the shell. Pass-through except for the
// first-sign-in gate; the visual chrome stays in (shell)/layout.tsx.
export default function AppRoot({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <StoreUserOnSignIn>{children}</StoreUserOnSignIn>;
}
