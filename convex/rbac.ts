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
export async function getCurrentUser(ctx: MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  if (identity.email) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .unique();
    if (user) return user;
  }

  return await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("authAccountId"), identity.subject))
    .first();
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
  allowedRoles: UserRole[]
) {
  const user = await getCurrentUser(ctx);

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
