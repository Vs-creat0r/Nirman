/**
 * @fileoverview Users query and management operations.
 */

import { mutation, query, action, internalMutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requirePermission } from "./permissions";
import { hashPassword, verifyPassword } from "./auth";

/** Privilege ordering for demotion detection (higher = more privilege). */
const ROLE_RANK: Record<string, number> = {
  site_supervisor: 1,
  procurement_officer: 2,
  project_manager: 3,
  admin: 4,
};

/**
 * Delete every active session for a user, forcing re-login.
 * Uses the existing sessions.by_userId index. Returns how many were revoked.
 */
async function revokeUserSessions(ctx: MutationCtx, userId: Id<"users">): Promise<number> {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const s of sessions) {
    await ctx.db.delete(s._id);
  }
  return sessions.length;
}

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
 * Create a new user account (Admin only).
 *
 * Runs as an action because password hashing uses crypto.getRandomValues,
 * which is not allowed inside a Convex mutation (see auth.login for the same
 * pattern). The action hashes, then hands off to the internal insert mutation
 * which performs the RBAC gate, the duplicate-username check, and the write.
 */
export const createUser = action({
  args: {
    name: v.string(),
    username: v.string(),
    password: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("project_manager"),
      v.literal("procurement_officer"),
      v.literal("site_supervisor")
    ),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const passwordHash = await hashPassword(args.password);
    return await ctx.runMutation(internal.users.insertUser, {
      name: args.name,
      username: args.username,
      passwordHash,
      role: args.role,
      email: args.email,
      phone: args.phone,
      token: args.token,
    });
  },
});

/**
 * Internal insert for createUser. Gated to "users:manage".
 * Enforces the unique-username invariant server-side (the form checks too).
 */
export const insertUser = internalMutation({
  args: {
    name: v.string(),
    username: v.string(),
    passwordHash: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("project_manager"),
      v.literal("procurement_officer"),
      v.literal("site_supervisor")
    ),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requirePermission(ctx, "users:manage", args.token);

    const name = args.name.trim();
    if (name.length < 2) throw new Error("Name must be at least 2 characters.");

    const username = args.username.trim().toLowerCase();
    if (username.length < 3) throw new Error("User ID must be at least 3 characters.");

    // Duplicate-username guard (enforced at the mutation, not just the form).
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (existing) {
      throw new Error(`User ID "${username}" is already taken.`);
    }

    const now = new Date().toISOString();
    const userId = await ctx.db.insert("users", {
      name,
      username,
      passwordHash: args.passwordHash,
      role: args.role,
      email: args.email?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      isActive: true,
      createdBy: caller._id,
      updatedBy: caller._id,
      updatedAt: now,
    });

    await ctx.db.insert("logs", {
      actorId: caller._id,
      actorRole: caller.role,
      action: "create_user",
      documentType: "users",
      documentId: userId,
      referenceId: username,
      note: `Created ${args.role} account for ${name} (@${username}).`,
      timestamp: now,
    });

    return userId;
  },
});

/** Internal: resolve caller's userId + stored hash from a session token (for password verification in actions). */
export const getAuthRecordByToken = internalQuery({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ userId: Id<"users">; passwordHash: string }> => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("Unauthorized: Invalid or missing session.");
    if (!user.isActive) throw new Error("Unauthorized: Your account has been deactivated.");
    if (!user.passwordHash) throw new Error("No password is set for this account.");
    return { userId: user._id, passwordHash: user.passwordHash };
  },
});

/**
 * Self-service password change. Any authenticated active user.
 * Verifies the current password before setting the new one. Action because hashing/verify use WebCrypto.
 */
export const changeMyPassword = action({
  args: { currentPassword: v.string(), newPassword: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ success: true }> => {
    if (args.newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
    const record = await ctx.runQuery(internal.users.getAuthRecordByToken, { token: args.token });
    const { valid } = await verifyPassword(args.currentPassword, record.passwordHash);
    if (!valid) throw new Error("Current password is incorrect.");
    const passwordHash = await hashPassword(args.newPassword);
    await ctx.runMutation(internal.users.persistOwnPassword, { token: args.token, passwordHash });
    return { success: true };
  },
});

export const persistOwnPassword = internalMutation({
  args: { token: v.optional(v.string()), passwordHash: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("Unauthorized: Invalid or missing session.");
    if (!user.isActive) throw new Error("Unauthorized: Your account has been deactivated.");
    const now = new Date().toISOString();
    await ctx.db.patch(user._id, { passwordHash: args.passwordHash, updatedBy: user._id, updatedAt: now });
    await ctx.db.insert("logs", {
      actorId: user._id, actorRole: user.role, action: "change_own_password",
      documentType: "users", documentId: user._id, referenceId: user.username || user.name,
      note: "User changed their own password.", timestamp: now,
    });
  },
});

/** Admin reset of another user's password. Gated to users:manage. */
export const adminResetPassword = action({
  args: { userId: v.id("users"), newPassword: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ success: true }> => {
    if (args.newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
    const passwordHash = await hashPassword(args.newPassword);
    await ctx.runMutation(internal.users.persistUserPassword, { userId: args.userId, passwordHash, token: args.token });
    return { success: true };
  },
});

export const persistUserPassword = internalMutation({
  args: { userId: v.id("users"), passwordHash: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const caller = await requirePermission(ctx, "users:manage", args.token);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Target user not found.");
    const now = new Date().toISOString();
    await ctx.db.patch(args.userId, { passwordHash: args.passwordHash, updatedBy: caller._id, updatedAt: now });
    await ctx.db.insert("logs", {
      actorId: caller._id, actorRole: caller.role, action: "admin_reset_password",
      documentType: "users", documentId: args.userId, referenceId: target.username || target.name,
      note: `Reset password for ${target.name}.`, timestamp: now,
    });
    // Admin reset invalidates the target's live sessions so they must log in with the new password.
    await revokeUserSessions(ctx, args.userId);
  },
});

/** Self-service profile edit (name/email/phone). Direct path — cannot change own role or isActive. */
export const updateMyProfile = mutation({
  args: { name: v.optional(v.string()), email: v.optional(v.string()), phone: v.optional(v.string()), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("Unauthorized: Invalid or missing session.");
    if (!user.isActive) throw new Error("Unauthorized: Your account has been deactivated.");
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updatedBy: user._id, updatedAt: now };
    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (trimmed.length < 2) throw new Error("Name must be at least 2 characters.");
      patch.name = trimmed;
    }
    if (args.email !== undefined) patch.email = args.email.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    await ctx.db.patch(user._id, patch);
    await ctx.db.insert("logs", {
      actorId: user._id, actorRole: user.role, action: "update_own_profile",
      documentType: "users", documentId: user._id, referenceId: user.username || user.name,
      note: "User updated their own profile.", timestamp: now,
    });
    return user._id;
  },
});

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
 * List all users (Admin management query).
 * Strictly gated to "users:manage" (Admin only).
 */
export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "users:manage", args.token);
    
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

    if (targetUser.role === "admin") {
      throw new Error("Administrators have unrestricted global access; project/site scoping cannot be applied.");
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

    // Deactivation must kill live sessions immediately (Q3).
    if (args.isActive === false) {
      await revokeUserSessions(ctx, args.userId);
    }

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
      ...(args.newRole === "admin" ? { assignedProjectIds: [], assignedSiteIds: [] } : {}),
      updatedBy: caller._id,
      updatedAt: now,
    });

    // Q3: revoke on demotion only (not lateral moves / promotions) — a reduced
    // role must not keep riding a token issued at the higher privilege.
    if ((ROLE_RANK[args.newRole] ?? 0) < (ROLE_RANK[targetUser.role] ?? 0)) {
      await revokeUserSessions(ctx, args.userId);
    }

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
