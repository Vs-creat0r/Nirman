/**
 * @fileoverview BOQ / Project items query and management operations.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { resolveCallerScope, filterScopedList, assertDocumentAccess } from "./scoping";

/**
 * List BOQ items for a project (enforcing caller scoping).
 */
export const listProjectItems = query({
  args: {
    projectId: v.optional(v.id("projects")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);
    let itemsQuery = ctx.db.query("project_items");

    if (args.projectId) {
      itemsQuery = itemsQuery.filter((q) => q.eq(q.field("projectId"), args.projectId));
    }

    const allItems = await itemsQuery.collect();
    const items = filterScopedList(scope, allItems);

    return items.map((item) => ({
      _id: item._id,
      value: item._id,
      label: `${item.itemName} (${item.unit})`,
      name: item.itemName,
      unit: item.unit,
      category: item.category,
      boqQty: item.boqQty ?? 0,
      procuredQty: item.procuredQty ?? 0,
      committedQty: item.committedQty ?? 0,
    }));
  },
});

/**
 * Detailed BOQ and Project Overview with 4 Reconciled Counters:
 * BOQ, Committed, Procured, and Consumed.
 */
export const getProjectBOQDetails = query({
  args: {
    projectId: v.id("projects"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    assertDocumentAccess(scope, { projectId: args.projectId }, project.name);

    // Fetch assigned sites
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_projectId_isActive", (q) => q.eq("projectId", args.projectId).eq("isActive", true))
      .collect();

    // Fetch project items
    const rawItems = await ctx.db
      .query("project_items")
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .collect();

    // Fetch all stock movements for project to compute consumedQty (issues + wastage)
    const projectMovements = await ctx.db
      .query("stock_movements")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Map consumed quantities by projectItemId and itemName
    const consumedByItemId = new Map<string, number>();
    for (const mov of projectMovements) {
      if (mov.movementType === "issue" || mov.movementType === "wastage") {
        const key = mov.projectItemId ? String(mov.projectItemId) : `name:${mov.itemName.toLowerCase().trim()}`;
        consumedByItemId.set(key, (consumedByItemId.get(key) || 0) + mov.quantity);
      } else if (mov.movementType === "reversal") {
        // Reversal reduces consumed if reversing an issue/wastage
        const key = mov.projectItemId ? String(mov.projectItemId) : `name:${mov.itemName.toLowerCase().trim()}`;
        consumedByItemId.set(key, Math.max(0, (consumedByItemId.get(key) || 0) - mov.quantity));
      }
    }

    const items = rawItems.map((it) => {
      const boqQty = it.boqQty ?? 0;
      const committedQty = it.committedQty ?? 0;
      const procuredQty = it.procuredQty ?? 0;
      const consumedQty =
        consumedByItemId.get(String(it._id)) ||
        consumedByItemId.get(`name:${it.itemName.toLowerCase().trim()}`) ||
        0;

      const remainingQty = boqQty - committedQty - procuredQty;
      const isOverProcured = procuredQty > boqQty;
      const isOverCommitted = (committedQty + procuredQty) > boqQty;

      return {
        ...it,
        boqQty,
        committedQty,
        procuredQty,
        consumedQty,
        remainingQty,
        isOverProcured,
        isOverCommitted,
      };
    });

    // Summary statistics
    const totalBOQItems = items.length;
    const totalOverProcured = items.filter((i) => i.isOverProcured).length;
    const totalOverCommitted = items.filter((i) => i.isOverCommitted).length;

    return {
      project,
      sites,
      items,
      stats: {
        totalBOQItems,
        totalOverProcured,
        totalOverCommitted,
      },
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
    const user = await requirePermission(ctx, "project_items:create", args.token);
    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, { projectId: args.projectId }, "Project Item");

    if (!args.itemName.trim()) throw new Error("Item name cannot be empty.");
    if (!args.unit.trim()) throw new Error("Unit of measurement is required.");

    const now = new Date().toISOString();
    return await ctx.db.insert("project_items", {
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
  },
});

/**
 * Update an existing BOQ project item.
 */
export const updateProjectItem = mutation({
  args: {
    id: v.id("project_items"),
    itemName: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    unit: v.optional(v.string()),
    boqQty: v.optional(v.number()),
    estimatedRate: v.optional(v.number()),
    description: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "project_items:update", args.token);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Project item not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, { projectId: item.projectId }, item.itemName);

    const patch: Record<string, unknown> = {
      updatedBy: user._id,
      updatedAt: new Date().toISOString(),
    };

    if (args.itemName !== undefined) {
      if (!args.itemName.trim()) throw new Error("Item name cannot be empty.");
      patch.itemName = args.itemName.trim();
    }
    if (args.category !== undefined) patch.category = args.category.trim() || undefined;
    if (args.subcategory !== undefined) patch.subcategory = args.subcategory.trim() || undefined;
    if (args.unit !== undefined) {
      if (!args.unit.trim()) throw new Error("Unit cannot be empty.");
      patch.unit = args.unit.trim();
    }
    if (args.boqQty !== undefined) {
      if (args.boqQty < 0) throw new Error("BOQ Quantity cannot be negative.");
      patch.boqQty = args.boqQty;
    }
    if (args.estimatedRate !== undefined) patch.estimatedRate = args.estimatedRate;
    if (args.description !== undefined) patch.description = args.description.trim() || undefined;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

/**
 * Delete a BOQ project item with fail-closed safety guards.
 * Prohibits deletion if committedQty > 0, procuredQty > 0, or stock movements exist.
 */
export const deleteProjectItem = mutation({
  args: {
    id: v.id("project_items"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "project_items:delete", args.token);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Project item not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, { projectId: item.projectId }, item.itemName);

    if ((item.committedQty ?? 0) > 0) {
      throw new Error(
        `Cannot delete "${item.itemName}": ${item.committedQty} ${item.unit} committed in active Purchase Orders.`
      );
    }
    if ((item.procuredQty ?? 0) > 0) {
      throw new Error(
        `Cannot delete "${item.itemName}": ${item.procuredQty} ${item.unit} already procured via Goods Receipts.`
      );
    }

    const linkedMovement = await ctx.db
      .query("stock_movements")
      .withIndex("by_projectItemId", (q) => q.eq("projectItemId", args.id))
      .first();

    if (linkedMovement) {
      throw new Error(
        `Cannot delete "${item.itemName}": Immutable stock movement records reference this item.`
      );
    }

    await ctx.db.delete(args.id);
    return { success: true, deletedId: args.id };
  },
});

/**
 * Bulk import BOQ items from structured data (CSV parsed rows).
 */
export const bulkImportProjectItems = mutation({
  args: {
    projectId: v.id("projects"),
    items: v.array(
      v.object({
        itemName: v.string(),
        category: v.optional(v.string()),
        unit: v.string(),
        boqQty: v.number(),
        estimatedRate: v.optional(v.number()),
        description: v.optional(v.string()),
      })
    ),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "project_items:bulk_import", args.token);
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, { projectId: args.projectId }, project.name);

    if (args.items.length === 0) {
      throw new Error("No items provided for import.");
    }

    const now = new Date().toISOString();
    let importedCount = 0;

    for (let i = 0; i < args.items.length; i++) {
      const it = args.items[i];
      if (!it.itemName || !it.itemName.trim()) {
        throw new Error(`Row #${i + 1} is missing a required item name.`);
      }
      if (!it.unit || !it.unit.trim()) {
        throw new Error(`Row #${i + 1} (${it.itemName}) is missing a unit.`);
      }
      if (typeof it.boqQty !== "number" || isNaN(it.boqQty) || it.boqQty < 0) {
        throw new Error(`Row #${i + 1} (${it.itemName}) has an invalid BOQ Quantity.`);
      }

      await ctx.db.insert("project_items", {
        projectId: args.projectId,
        itemName: it.itemName.trim(),
        category: it.category?.trim() || undefined,
        unit: it.unit.trim(),
        boqQty: it.boqQty,
        procuredQty: 0,
        committedQty: 0,
        estimatedRate: it.estimatedRate,
        description: it.description?.trim() || undefined,
        createdBy: user._id,
        updatedBy: user._id,
        updatedAt: now,
      });
      importedCount++;
    }

    return {
      success: true,
      importedCount,
      projectId: args.projectId,
    };
  },
});

/**
 * One-shot admin-only backfill mutation [FIX-B3].
 */
export const backfillProjectItemCounters = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "project_items:backfill", args.token);
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
