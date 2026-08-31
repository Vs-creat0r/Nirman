/**
 * @fileoverview Sites query and management operations.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { getCurrentUser } from "./rbac";
import { resolveCallerScope, filterScopedList } from "./scoping";

/**
 * List active sites, optionally filtered by projectId (scoped to caller permissions).
 */
export const listSites = query({
  args: {
    projectId: v.optional(v.id("projects")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    const allSites = args.projectId
      ? await ctx.db
          .query("sites")
          .withIndex("by_projectId_isActive", (q) =>
            q.eq("projectId", args.projectId!).eq("isActive", true)
          )
          .collect()
      : await ctx.db
          .query("sites")
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

    // Enforce scoping
    const scopedSites = filterScopedList(
      scope,
      allSites.map((s) => ({ ...s, siteId: s._id }))
    );

    return scopedSites.map((s) => ({
      _id: s._id,
      value: s._id,
      label: `${s.name} (${s.code})`,
      name: s.name,
      code: s.code,
      projectId: s.projectId,
      address: s.address,
      isActive: s.isActive,
    }));
  },
});

/**
 * List all sites with enriched project details (Admin management query).
 * Strictly gated by "sites:manage" and explicitly un-scoped.
 */
export const listAllSites = query({
  args: {
    projectId: v.optional(v.id("projects")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "sites:manage", args.token);

    let sites = args.projectId
      ? await ctx.db
          .query("sites")
          .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId!))
          .collect()
      : await ctx.db.query("sites").collect();

    // Sort newest first
    sites.sort((a, b) => b._creationTime - a._creationTime);

    const enriched = await Promise.all(
      sites.map(async (site) => {
        const project = await ctx.db.get(site.projectId);
        return {
          ...site,
          projectName: project?.name || "Unknown Project",
          projectCode: project?.code || "—",
          projectStatus: project?.status || "unknown",
        };
      })
    );

    return enriched;
  },
});

/**
 * Create a new construction Site (Admin only).
 * Strictly checks case-insensitive name & code uniqueness within the parent project.
 */
export const createSite = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    code: v.string(),
    address: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "sites:manage", args.token);

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Parent project not found.");
    }

    const trimmedName = args.name.trim();
    if (trimmedName.length < 2) {
      throw new Error("Site name must be at least 2 characters.");
    }

    const trimmedCode = args.code.trim().toUpperCase();
    if (!/^[A-Z0-9\-]{1,12}$/.test(trimmedCode)) {
      throw new Error("Site code must be 1-12 uppercase alphanumeric characters or hyphens (e.g. S-01).");
    }

    const existingProjectSites = await ctx.db
      .query("sites")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    // 1. Check duplicate name within project
    const duplicateName = existingProjectSites.find(
      (s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateName) {
      throw new Error(`A site with name "${trimmedName}" already exists in project "${project.name}".`);
    }

    // 2. Check duplicate code within project
    const duplicateCode = existingProjectSites.find(
      (s) => s.code.trim().toUpperCase() === trimmedCode
    );
    if (duplicateCode) {
      throw new Error(`A site with code "${trimmedCode}" already exists in project "${project.name}".`);
    }

    const now = new Date().toISOString();
    const siteId = await ctx.db.insert("sites", {
      name: trimmedName,
      code: trimmedCode,
      projectId: args.projectId,
      address: args.address?.trim() || undefined,
      isActive: args.isActive !== undefined ? args.isActive : true,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    // Audit log
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "create_site",
      documentType: "projects",
      documentId: siteId,
      referenceId: trimmedCode,
      note: `Created site ${trimmedName} (${trimmedCode}) under project ${project.name}`,
      timestamp: now,
    });

    return siteId;
  },
});

/**
 * Update an existing Site (Admin only).
 * Re-validates name and code uniqueness within the project if modified.
 */
export const updateSite = mutation({
  args: {
    id: v.id("sites"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    address: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "sites:manage", args.token);

    const site = await ctx.db.get(args.id);
    if (!site) {
      throw new Error("Site not found.");
    }

    const patch: Record<string, unknown> = {
      updatedBy: user._id,
      updatedAt: new Date().toISOString(),
    };

    const existingProjectSites = await ctx.db
      .query("sites")
      .withIndex("by_projectId", (q) => q.eq("projectId", site.projectId))
      .collect();

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (trimmedName.length < 2) {
        throw new Error("Site name must be at least 2 characters.");
      }
      const duplicateName = existingProjectSites.find(
        (s) => s._id !== args.id && s.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        throw new Error(`A site with name "${trimmedName}" already exists in this project.`);
      }
      patch.name = trimmedName;
    }

    if (args.code !== undefined) {
      const trimmedCode = args.code.trim().toUpperCase();
      if (!/^[A-Z0-9\-]{1,12}$/.test(trimmedCode)) {
        throw new Error("Site code must be 1-12 uppercase alphanumeric characters or hyphens.");
      }
      const duplicateCode = existingProjectSites.find(
        (s) => s._id !== args.id && s.code.trim().toUpperCase() === trimmedCode
      );
      if (duplicateCode) {
        throw new Error(`A site with code "${trimmedCode}" already exists in this project.`);
      }
      patch.code = trimmedCode;
    }

    if (args.address !== undefined) patch.address = args.address.trim() || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.id, patch);

    // Audit log
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "update_site",
      documentType: "projects",
      documentId: args.id,
      referenceId: site.code,
      note: `Updated site ${site.name}`,
      timestamp: new Date().toISOString(),
    });

    return args.id;
  },
});
