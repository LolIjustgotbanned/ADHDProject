import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Every route renders per request (as they always have — the old auth
// provider read cookies, which forced the same thing; now this line does).
// It also lets `next build` succeed without Clerk keys: static prerender
// would execute ClerkProvider at build time and demand the publishable key.
// When the key IS present at build, Next still inlines it into the client
// bundle (NEXT_PUBLIC_* is build-time) — fine, it's publishable by design;
// only CLERK_SECRET_KEY stays server-side.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  // viewport-fit=cover lets env(safe-area-inset-*) resolve on iOS, so fixed
  // elements (the floating capture button) can dodge the home indicator.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "LockIn — finish what you start",
  description:
    "A task manager for minds that wander: one task on screen, every distraction caught for later.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Clerk needs no server-side wrapper out here — ClerkProvider lives in
    // ConvexClientProvider, and clerkMiddleware carries the session cookies.
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
