"use client";
import * as React from "react";
import { useRole } from "@/hooks/use-role";
import { UserRole } from "@/convex/permissions";
import { ShieldAlert, Loader2 } from "lucide-react";

export function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { role, isLoading } = useRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-xs text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
      </div>
    );
  }

  if (!role || !roles.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Access Denied</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            You don&apos;t have permission to view this page. Contact your administrator if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
