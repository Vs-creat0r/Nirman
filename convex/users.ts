/**
 * @fileoverview Users query and management operations.
 */

import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";

export async function getUserFromToken(ctx: QueryCtx, token?: string) {
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
 * Get current authenticated user profile (excluding passwordHash).
 */
export const getMyUser = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  },
});

/**
 * List all users (Admin and authenticated system query).
 */
export const list = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const me = await getUserFromToken(ctx, args.token);
    if (!me) throw new Error("Unauthenticated");
    
    const allUsers = await ctx.db.query("users").collect();
    return allUsers.map(({ passwordHash, ...safeUser }) => safeUser);
  },
});

/**
 * Update a user's assigned projects and sites scoping (Admin only).
 */
export const updateUserAssignments = mutation({
  args: {
    userId: v.id("users"),
    assignedProjectIds: v.array(v.id("projects")),
    assignedSiteIds: v.array(v.id("sites")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requirePermission(ctx, "users:manage", args.token);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Target user not found.");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.userId, {
      assignedProjectIds: args.assignedProjectIds,
      assignedSiteIds: args.assignedSiteIds,
      updatedBy: caller._id,
      updatedAt: now,
    });

    // Write audit log
    await ctx.db.insert("logs", {
      actorId: caller._id,
      actorRole: caller.role,
      action: "update_user_assignments",
      documentType: "users",
      documentId: args.userId,
      referenceId: targetUser.username || targetUser.name,
      note: `Updated scoping assignments for ${targetUser.name}: ${args.assignedProjectIds.length} project(s), ${args.assignedSiteIds.length} site(s).`,
      timestamp: now,
    });

    return args.userId;
  },
});

/**
 * Update general user profile and active status (Admin only).
 * Note: Role cannot be changed here (uses changeUserRole with lockout protection).
 */
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requirePermission(ctx, "users:manage", args.token);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Target user not found.");
    }

    // Lockout guard: cannot deactivate the last active admin
    if (args.isActive === false && targetUser.role === "admin") {
      const allUsers = await ctx.db.query("users").collect();
      const activeAdmins = allUsers.filter((u) => u.role === "admin" && u.isActive);
      if (activeAdmins.length <= 1) {
        throw new Error("Security Lockout Guard: Cannot deactivate the last remaining active Administrator.");
      }
    }

    const patch: Record<string, unknown> = {
      updatedBy: caller._id,
      updatedAt: new Date().toISOString(),
    };

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (trimmed.length < 2) throw new Error("Name must be at least 2 characters.");
      patch.name = trimmed;
    }

    if (args.email !== undefined) patch.email = args.email.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.userId, patch);

    // Audit log
    await ctx.db.insert("logs", {
      actorId: caller._id,
      actorRole: caller.role,
      action: "update_user",
      documentType: "users",
      documentId: args.userId,
      referenceId: targetUser.username || targetUser.name,
      note: `Updated profile for user ${targetUser.name}`,
      timestamp: new Date().toISOString(),
    });

    return args.userId;
  },
});

/**
 * Change a user's role (Admin only).
 * Includes strict lockout guards to prevent self-lockout or removing the last admin.
 */
export const changeUserRole = mutation({
  args: {
    userId: v.id("users"),
    newRole: v.union(
      v.literal("admin"),
      v.literal("project_manager"),
      v.literal("procurement_officer"),
      v.literal("site_supervisor")
    ),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requirePermission(ctx, "users:change_role", args.token);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Target user not found.");
    }

    // Lockout Guard 1: Cannot demote yourself
    if (caller._id === targetUser._id && targetUser.role === "admin" && args.newRole !== "admin") {
      throw new Error("Security Lockout Guard: You cannot remove your own Administrator role.");
    }

    // Lockout Guard 2: Cannot demote the last remaining active admin
    if (targetUser.role === "admin" && args.newRole !== "admin") {
      const allUsers = await ctx.db.query("users").collect();
      const activeAdmins = allUsers.filter((u) => u.role === "admin" && u.isActive);
      if (activeAdmins.length <= 1) {
        throw new Error("Security Lockout Guard: Cannot demote the last remaining active Administrator.");
      }
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.userId, {
      role: args.newRole,
      updatedBy: caller._id,
      updatedAt: now,
    });

    // Write audit log
    await ctx.db.insert("logs", {
      actorId: caller._id,
      actorRole: caller.role,
      action: "change_user_role",
      documentType: "users",
      documentId: args.userId,
      referenceId: targetUser.username || targetUser.name,
      note: `Changed role of ${targetUser.name} from "${targetUser.role}" to "${args.newRole}"`,
      timestamp: now,
    });

    return args.userId;
  },
});
