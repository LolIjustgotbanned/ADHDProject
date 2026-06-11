import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
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
    // The server provider must wrap <html> (not sit inside it) so Server
    // Components and middleware can share the auth token via cookies.
    <ConvexAuthNextjsServerProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
