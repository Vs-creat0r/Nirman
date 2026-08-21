/**
 * @fileoverview Terms & Conditions Templates backend operations.
 * Allows Admin to configure standard T&C clauses for Purchase Orders.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";

/**
 * List all active T&C templates.
 */
export const listTCTemplates = query({
  args: {
    includeInactive: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer"],
      args.token
    );

    let templates = await ctx.db.query("tc_templates").collect();
    if (!args.includeInactive) {
      templates = templates.filter((t) => t.isActive);
    }

    templates.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });

    return templates;
  },
});

/**
 * Get default T&C template.
 */
export const getDefaultTCTemplate = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer"],
      args.token
    );

    const defaultTpl = await ctx.db
      .query("tc_templates")
      .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
      .first();

    if (defaultTpl && defaultTpl.isActive) {
      return defaultTpl;
    }

    // Fallback to first active template
    return await ctx.db
      .query("tc_templates")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .first();
  },
});

/**
 * Create a new T&C template (Admin only).
 */
export const createTCTemplate = mutation({
  args: {
    name: v.string(),
    content: v.string(),
    isDefault: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"], args.token);

    if (!args.name.trim()) throw new Error("Template name is required.");
    if (!args.content.trim()) throw new Error("Template content is required.");

    const now = new Date().toISOString();

    // If marked default, unset any existing default
    if (args.isDefault) {
      const existingDefaults = await ctx.db
        .query("tc_templates")
        .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
        .collect();
      for (const t of existingDefaults) {
        await ctx.db.patch(t._id, { isDefault: false, updatedAt: now });
      }
    }

    const id = await ctx.db.insert("tc_templates", {
      name: args.name.trim(),
      content: args.content.trim(),
      isDefault: args.isDefault || false,
      isActive: true,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Update a T&C template (Admin only).
 */
export const updateTCTemplate = mutation({
  args: {
    id: v.id("tc_templates"),
    name: v.string(),
    content: v.string(),
    isDefault: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"], args.token);

    const tpl = await ctx.db.get(args.id);
    if (!tpl) throw new Error("Template not found.");

    const now = new Date().toISOString();

    // If marked default, unset others
    if (args.isDefault && !tpl.isDefault) {
      const existingDefaults = await ctx.db
        .query("tc_templates")
        .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
        .collect();
      for (const t of existingDefaults) {
        if (t._id !== args.id) {
          await ctx.db.patch(t._id, { isDefault: false, updatedAt: now });
        }
      }
    }

    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      content: args.content.trim(),
      isDefault: args.isDefault !== undefined ? args.isDefault : tpl.isDefault,
      isActive: args.isActive !== undefined ? args.isActive : tpl.isActive,
      updatedBy: user._id,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Delete a T&C template (soft-delete / deactivate).
 */
export const deleteTCTemplate = mutation({
  args: {
    id: v.id("tc_templates"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"], args.token);

    const tpl = await ctx.db.get(args.id);
    if (!tpl) throw new Error("Template not found.");

    await ctx.db.patch(args.id, {
      isActive: false,
      isDefault: false,
      updatedBy: user._id,
      updatedAt: new Date().toISOString(),
    });

    return true;
  },
});
