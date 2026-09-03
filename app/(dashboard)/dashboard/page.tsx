"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { token, isLoading: sessionLoading } = useSession();
  
  // Only query if we have a token
  const user = useQuery(api.users.getMyUser, token ? { token } : "skip");

  React.useEffect(() => {
    if (sessionLoading) return;
    
    if (!token) {
      router.replace("/login");
      return;
    }

    if (user !== undefined) {
      if (user === null) {
        // Invalid session
        router.replace("/login");
      } else {
        // Redirect to correct dashboard based on role
        const redirectMap = {
          site_supervisor: "/dashboard/supervisor",
          project_manager: "/dashboard/manager",
          procurement_officer: "/dashboard/procurement",
          admin: "/dashboard/admin",
        };
        
        const path = redirectMap[user.role as keyof typeof redirectMap] || "/dashboard/supervisor";
        router.replace(path);
      }
    }
  }, [token, sessionLoading, user, router]);

  return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-3 select-none">
      <Loader2 className="h-6 w-6 text-primary animate-spin" />
      <div className="text-sm font-semibold text-muted-foreground">
        Redirecting to your dashboard...
      </div>
    </div>
  );
}
