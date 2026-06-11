import { QuickCapture } from "@/components/QuickCapture";
import { HeaderNav } from "./HeaderNav";
import { SignOutButton } from "./SignOutButton";

// Server Component shell: header + the always-present capture bar. Only the
// interactive leaves (capture input, nav, sign-out button) are client
// components.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-6 py-5">
        <span className="font-medium tracking-tight">LockIn</span>
        <div className="flex items-center gap-2">
          <HeaderNav />
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-6">
        <QuickCapture />
      </div>
      {/* Bottom padding keeps the floating capture button clear of task rows */}
      <main className="mx-auto max-w-2xl px-6 pb-28 pt-8">{children}</main>
    </div>
  );
}
