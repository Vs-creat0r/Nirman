// convex/rbac.ts
// Server-side Role Based Access Control guard.
// Call requireRole() at the top of every mutation that needs permission checking.

import { MutationCtx, QueryCtx } from "./_generated/server";

export type UserRole =
  | "site_supervisor"
  | "project_manager"
  | "procurement_officer"
  | "admin";

/**
 * Fetches the current user from the database using their Clerk JWT identity.
 * Returns null if not authenticated or not found in our users table.
 */
export async function getCurrentUser(ctx: MutationCtx | QueryCtx, token?: string) {
  if (!token) return null;

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    return null;
  }

  return await ctx.db.get(session.userId);
}

/**
 * Requires the calling user to have one of the specified roles.
 * Throws an error if:
 *   - The user is not logged in
 *   - The user's account is inactive
 *   - The user's role is not in the allowedRoles list
 * 
 * Returns the user object if the check passes.
 * 
 * Example usage inside a Convex mutation:
 *   const user = await requireRole(ctx, ["project_manager", "admin"]);
 */
export async function requireRole(
  ctx: MutationCtx | QueryCtx,
  allowedRoles: UserRole[],
  token?: string
) {
  const user = await getCurrentUser(ctx, token);

  if (!user) {
    throw new Error("Unauthorized: You must be logged in to perform this action.");
  }

  if (!user.isActive) {
    throw new Error("Unauthorized: Your account has been deactivated. Contact an administrator.");
  }

  if (!allowedRoles.includes(user.role as UserRole)) {
    throw new Error(
      `Unauthorized: This action requires one of these roles: [${allowedRoles.join(", ")}]. Your role is: ${user.role}`
    );
  }

  return user;
}
