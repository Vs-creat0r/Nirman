import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type UserRole } from "@/lib/nav-config";
import { useSession } from "@/components/providers/auth-provider";
import type { Doc } from "@/convex/_generated/dataModel";

export type SafeUser = Omit<Doc<"users">, "passwordHash">;

export function useRole(): {
  role: UserRole | null;
  isLoading: boolean;
  user: SafeUser | null | undefined;
} {
  const { token, isLoading: sessionLoading } = useSession();
  const user = useQuery(api.users.getMyUser, token ? { token } : "skip");
  
  const isLoading = sessionLoading || (token !== null && user === undefined);
  
  return {
    role: user ? (user.role as UserRole) : null,
    isLoading,
    user: user as SafeUser | null | undefined,
  };
}
