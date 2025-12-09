"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { AuthProvider } from "@/components/auth/auth-context";
import { ThemeProvider } from "@/components/theme/theme-context";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.warn("Set NEXT_PUBLIC_CONVEX_URL to your Convex deployment URL.");
}

const convexClient = new ConvexReactClient(convexUrl || "http://localhost:3000");

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ConvexProvider client={convexClient}>
        <AuthProvider>{children}</AuthProvider>
      </ConvexProvider>
    </ThemeProvider>
  );
}
