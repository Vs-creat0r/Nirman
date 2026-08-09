import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { type UserRole } from "../lib/nav-config";

export function useRole(): { role: UserRole | null; isLoading: boolean; user: any } {
  const user = useQuery(api.users.getMyUser);
  const isLoading = user === undefined;
  
  return {
    role: user ? (user.role as UserRole) : null,
    isLoading,
    user
  };
}
