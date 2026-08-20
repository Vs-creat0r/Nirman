import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { type UserRole } from "../lib/nav-config";
import { useSession } from "@/components/providers/auth-provider";

export function useRole(): { role: UserRole | null; isLoading: boolean; user: any } {
  const { token, isLoading: sessionLoading } = useSession();
  const user = useQuery(api.users.getMyUser, token ? { token } : "skip");
  
  const isLoading = sessionLoading || (token !== null && user === undefined);
  
  return {
    role: user ? (user.role as UserRole) : null,
    isLoading,
    user
  };
}
