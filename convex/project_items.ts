/**
 * @fileoverview BOQ / Project items query endpoints.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";

/**
 * List BOQ items for a project.
 */
export const listProjectItems = query({
  args: {
    projectId: v.optional(v.id("projects")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    let itemsQuery = ctx.db.query("project_items");

    if (args.projectId) {
      itemsQuery = itemsQuery.filter((q) => q.eq(q.field("projectId"), args.projectId));
    }

    const items = await itemsQuery.collect();

    return items.map((item) => ({
      _id: item._id,
      value: item._id,
      label: `${item.itemName} (${item.unit})`,
      name: item.itemName,
      unit: item.unit,
      category: item.category,
      boqQty: item.boqQty,
      procuredQty: item.procuredQty ?? 0,
      committedQty: item.committedQty ?? 0,
    }));
  },
});

/**
 * One-shot admin-only backfill mutation [FIX-B3].
 * Sets committedQty: 0 on all project_items rows missing it.
 * Idempotent: safe to run multiple times.
 */
export const backfillProjectItemCounters = mutation({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"], args.token);

    const allItems = await ctx.db.query("project_items").collect();
    let updatedCount = 0;

    for (const item of allItems) {
      if (item.committedQty === undefined) {
        await ctx.db.patch(item._id, { committedQty: 0 });
        updatedCount++;
      }
    }

    return {
      success: true,
      totalCount: allItems.length,
      updatedCount,
      message: `Backfilled ${updatedCount} of ${allItems.length} project_items records with committedQty: 0`,
    };
  },
});

/**
 * Create a new BOQ item under a project.
 */
export const createProjectItem = mutation({
  args: {
    projectId: v.id("projects"),
    itemName: v.string(),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    unit: v.string(),
    boqQty: v.optional(v.number()),
    estimatedRate: v.optional(v.number()),
    description: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer"],
      args.token
    );

    const now = new Date().toISOString();
    const id = await ctx.db.insert("project_items", {
      projectId: args.projectId,
      itemName: args.itemName.trim(),
      category: args.category?.trim() || undefined,
      subcategory: args.subcategory?.trim() || undefined,
      unit: args.unit.trim(),
      boqQty: args.boqQty ?? 0,
      procuredQty: 0,
      committedQty: 0,
      estimatedRate: args.estimatedRate,
      description: args.description?.trim() || undefined,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    return id;
  },
});

