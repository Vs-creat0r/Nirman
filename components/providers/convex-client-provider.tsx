"use client";
import * as React from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./auth-provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // Suppress external browser extension unhandled rejections from polluting Next.js dev overlay
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const stack = reason?.stack || reason?.toString() || "";
      if (
        stack.includes("chrome-extension://") ||
        stack.includes("moz-extension://") ||
        reason?.message?.includes("M_ID")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleError = (event: ErrorEvent) => {
      const filename = event.filename || "";
      const stack = event.error?.stack || "";
      if (
        filename.includes("chrome-extension://") ||
        filename.includes("moz-extension://") ||
        stack.includes("chrome-extension://") ||
        event.message?.includes("M_ID")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

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
