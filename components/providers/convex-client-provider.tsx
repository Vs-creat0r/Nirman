"use client";
import * as React from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./auth-provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConvexProvider client={convex}>
        <ThemeProvider
          attribute="class"
          storageKey="nirman-theme"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </ConvexProvider>
    </AuthProvider>
  );
}
