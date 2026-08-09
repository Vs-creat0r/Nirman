"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRole } from "../../../hooks/use-role";
import { Loader2 } from "lucide-react";

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { role, isLoading, user: convexUser } = useRole();
  const upsertUser = useMutation(api.users.upsertUser);
  const [isRegistering, setIsRegistering] = React.useState(false);

  React.useEffect(() => {
    if (!isClerkLoaded || isLoading || isRegistering) return;

    if (convexUser) {
      // Redirect to correct dashboard based on role
      const redirectMap = {
        site_supervisor: "/dashboard/supervisor",
        project_manager: "/dashboard/manager",
        procurement_officer: "/dashboard/procurement",
        admin: "/dashboard/admin",
      };
      
      const path = redirectMap[convexUser.role as keyof typeof redirectMap] || "/dashboard/supervisor";
      router.replace(path);
    } else if (clerkUser) {
      // Create user profile in Convex database on first-time login
      setIsRegistering(true);
      
      const email = clerkUser.primaryEmailAddress?.emailAddress || "";
      const name = clerkUser.fullName || clerkUser.username || "New User";

      // Detect role based on email suffix / patterns
      let detectedRole: "site_supervisor" | "project_manager" | "procurement_officer" | "admin" = "site_supervisor";
      
      if (email.includes("admin")) {
        detectedRole = "admin";
      } else if (email.includes("manager") || email.includes("pm")) {
        detectedRole = "project_manager";
      } else if (email.includes("procurement") || email.includes("po")) {
        detectedRole = "procurement_officer";
      } else if (email.includes("supervisor") || email.includes("site")) {
        detectedRole = "site_supervisor";
      }

      upsertUser({
        name,
        email,
        role: detectedRole,
      })
        .then(() => {
          setIsRegistering(false);
        })
        .catch((err) => {
          console.error("Failed to register Convex user profile:", err);
          setIsRegistering(false);
        });
    }
  }, [convexUser, clerkUser, isClerkLoaded, isLoading, router, upsertUser, isRegistering]);

  return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-3 select-none">
      <Loader2 className="h-6 w-6 text-primary animate-spin" />
      <div className="text-sm font-semibold text-muted-foreground">
        {isRegistering ? "Registering user profile..." : "Redirecting to your dashboard..."}
      </div>
    </div>
  );
}
