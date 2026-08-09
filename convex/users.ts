import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get current logged in user details using Clerk auth token.
 */
export const getMyUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
  },
});

/**
 * Upsert user profile info when logging in via Clerk.
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
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        role: args.role,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("users", {
        name: args.name,
        email: args.email,
        role: args.role,
        clerkUserId: identity.subject,
        isActive: true,
      });
    }
  },
});

/**
 * List all users.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});
