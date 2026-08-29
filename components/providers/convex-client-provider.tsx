"use client";
import * as React from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./auth-provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // Suppress external browser extension unhandled rejections/errors from polluting Next.js dev overlay
    const shouldIgnore = (err?: any, msg?: string, filename?: string, stack?: string) => {
      const combined = [
        msg,
        filename,
        stack,
        err?.stack,
        err?.message,
        err ? String(err) : "",
      ]
        .filter(Boolean)
        .join(" ");

      return (
        combined.includes("chrome-extension://") ||
        combined.includes("moz-extension://") ||
        combined.includes("safari-extension://") ||
        combined.includes("safari-web-extension://") ||
        combined.includes("M_ID") ||
        combined.includes("eppiocemhmnlbhjplcgkofciiegomcon")
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const stack = reason?.stack || reason?.toString() || "";
      if (shouldIgnore(reason, reason?.message, "", stack)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleError = (event: ErrorEvent) => {
      const filename = event.filename || "";
      const stack = event.error?.stack || "";
      if (shouldIgnore(event.error, event.message, filename, stack)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection, { capture: true });
    window.addEventListener("error", handleError, { capture: true });

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection, { capture: true } as any);
      window.removeEventListener("error", handleError, { capture: true } as any);
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
