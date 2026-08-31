// convex/rbac.ts
// Session helper module. Permissions are enforced via requirePermission in convex/permissions.ts.

import { MutationCtx, QueryCtx } from "./_generated/server";
export { type UserRole } from "./permissions";

/**
 * Fetches the current user from the database using their session token.
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
