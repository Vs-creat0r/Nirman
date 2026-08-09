"use client";
import * as React from "react";
import dynamic from "next/dynamic";

const ConvexClientProvider = dynamic(
  () => import("./convex-client-provider").then((mod) => mod.ConvexClientProvider),
  { ssr: false }
);

export function ClientOnlyProvider({ children }: { children: React.ReactNode }) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
