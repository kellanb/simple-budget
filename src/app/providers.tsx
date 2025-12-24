"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { AuthProvider } from "@/components/auth/auth-context";
import { ThemeProvider } from "@/components/theme/theme-context";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();

if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is required. Dev: use the URL from `npx convex dev`. Prod: use the Convex dashboard URL.",
  );
}

const convexClient = new ConvexReactClient(convexUrl);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ConvexProvider client={convexClient}>
        <AuthProvider>{children}</AuthProvider>
      </ConvexProvider>
    </ThemeProvider>
  );
}
