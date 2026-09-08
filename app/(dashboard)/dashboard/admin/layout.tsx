"use client";
import { RequireRole } from "@/components/providers/require-role";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={["admin"]}>{children}</RequireRole>;
}
