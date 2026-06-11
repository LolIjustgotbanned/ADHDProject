"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The shell's two destinations. Client component only because the active
// page comes from usePathname — aria-current carries it for screen readers,
// the brighter text for everyone else.
const links = [
  { href: "/app", label: "Tasks" },
  { href: "/app/insights", label: "Insights" },
] as const;

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition ${
              active ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
