"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

// Module scope so the client (and its live WebSocket to Convex) is created
// once for the whole app, not once per render.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Clerk owns identity; ConvexProviderWithClerk forwards Clerk's JWT (the
// "convex" template) to the Convex client so ctx.auth sees it server-side.
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
