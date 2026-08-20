/**
 * @fileoverview User queries and mutations.
 * Uses authAccountId (from the auth provider's subject) to link
 * Convex user records to auth identities.
 *
 * @module convex/users
 */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";

/**
 * Test mutation to verify RBAC protection (requires admin role).
 */
export const testAdminOnly = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin"]);
    return { success: true, message: "You are an admin!" };
  },
});

/**
 * Get current logged-in user details using the auth provider's identity.
 */
export const getMyUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Look up user by email (works regardless of auth provider)
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email ?? ""))
      .unique();

    return user;
  },
});

/**
 * Upsert user profile info when logging in via auth provider.
 */
export const upsertUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("site_supervisor"),
      v.literal("project_manager"),
      v.literal("procurement_officer"),
      v.literal("admin")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated. Please log in first.");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        role: args.role,
        authAccountId: identity.subject,
      });
      return existing._id;
    } else {
      // For new user registration, insert user without createdBy first, then patch self-reference
      const userId = await ctx.db.insert("users", {
        name: args.name,
        email: args.email,
        role: args.role,
        authAccountId: identity.subject,
        isActive: true,
      });
      // Self-reference: the user record references its own ID as createdBy
      await ctx.db.patch(userId, { createdBy: userId });
      return userId;
    }
  },
});

/**
 * List all active users.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});
