/**
 * @fileoverview Projects query and management operations.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { getCurrentUser } from "./rbac";

/**
 * List all active projects accessible to the logged-in user (for dropdown selectors).
 */
export const listProjects = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

    const projects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return projects.map((p) => ({
      _id: p._id,
      value: p._id,
      label: `${p.name} (${p.code})`,
      name: p.name,
      code: p.code,
      client: p.client,
      status: p.status,
    }));
  },
});

/**
 * Get single project by ID.
 */
export const getProject = query({
  args: {
    id: v.id("projects"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

    return await ctx.db.get(args.id);
  },
});

/**
 * List all projects with enriched site counts (Admin management query).
 * Strictly gated by "projects:manage" and explicitly un-scoped.
 */
export const listAllProjects = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "projects:manage", args.token);

    const [projects, allSites] = await Promise.all([
      ctx.db.query("projects").collect(),
      ctx.db.query("sites").collect(),
    ]);

    // Sort newest first
    projects.sort((a, b) => b._creationTime - a._creationTime);

    return projects.map((project) => {
      const projectSites = allSites.filter((s) => s.projectId === project._id);
      return {
        ...project,
        siteCount: projectSites.length,
        activeSiteCount: projectSites.filter((s) => s.isActive).length,
      };
    });
  },
});

/**
 * Create a new Project (Admin only).
 * Strictly checks case-insensitive name uniqueness and code uniqueness.
 */
export const createProject = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    client: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("on_hold"), v.literal("closed"))),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "projects:manage", args.token);

    const trimmedName = args.name.trim();
    if (trimmedName.length < 2) {
      throw new Error("Project name must be at least 2 characters.");
    }

    const trimmedCode = args.code.trim().toUpperCase();
    if (!/^[A-Z0-9\-]{2,20}$/.test(trimmedCode)) {
      throw new Error("Project code must be 2-20 uppercase alphanumeric characters or hyphens (e.g. PRJ-2026).");
    }

    const allProjects = await ctx.db.query("projects").collect();

    // 1. Check duplicate name (case-insensitive)
    const duplicateName = allProjects.find(
      (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateName) {
      throw new Error(`A project with name "${trimmedName}" already exists.`);
    }

    // 2. Check duplicate code (case-insensitive)
    const duplicateCode = allProjects.find(
      (p) => p.code.trim().toUpperCase() === trimmedCode
    );
    if (duplicateCode) {
      throw new Error(`A project with code "${trimmedCode}" already exists.`);
    }

    const now = new Date().toISOString();
    const projectId = await ctx.db.insert("projects", {
      name: trimmedName,
      code: trimmedCode,
      client: args.client?.trim() || undefined,
      startDate: args.startDate || undefined,
      endDate: args.endDate || undefined,
      status: args.status || "active",
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    // Write audit log
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "create_project",
      documentType: "projects",
      documentId: projectId,
      referenceId: trimmedCode,
      note: `Created project ${trimmedName} (${trimmedCode})`,
      timestamp: now,
    });

    return projectId;
  },
});

/**
 * Update an existing Project (Admin only).
 * Re-validates name and code uniqueness if modified.
 */
export const updateProject = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    client: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("on_hold"), v.literal("closed"))),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "projects:manage", args.token);

    const project = await ctx.db.get(args.id);
    if (!project) {
      throw new Error("Project not found.");
    }

    const patch: Record<string, unknown> = {
      updatedBy: user._id,
      updatedAt: new Date().toISOString(),
    };

    const allProjects = await ctx.db.query("projects").collect();

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (trimmedName.length < 2) {
        throw new Error("Project name must be at least 2 characters.");
      }
      const duplicateName = allProjects.find(
        (p) => p._id !== args.id && p.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        throw new Error(`A project with name "${trimmedName}" already exists.`);
      }
      patch.name = trimmedName;
    }

    if (args.code !== undefined) {
      const trimmedCode = args.code.trim().toUpperCase();
      if (!/^[A-Z0-9\-]{2,20}$/.test(trimmedCode)) {
        throw new Error("Project code must be 2-20 uppercase alphanumeric characters or hyphens.");
      }
      const duplicateCode = allProjects.find(
        (p) => p._id !== args.id && p.code.trim().toUpperCase() === trimmedCode
      );
      if (duplicateCode) {
        throw new Error(`A project with code "${trimmedCode}" already exists.`);
      }
      patch.code = trimmedCode;
    }

    if (args.client !== undefined) patch.client = args.client.trim() || undefined;
    if (args.startDate !== undefined) patch.startDate = args.startDate || undefined;
    if (args.endDate !== undefined) patch.endDate = args.endDate || undefined;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(args.id, patch);

    // Audit log
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "update_project",
      documentType: "projects",
      documentId: args.id,
      referenceId: project.code,
      note: `Updated project ${project.name}`,
      timestamp: new Date().toISOString(),
    });

    return args.id;
  },
});
