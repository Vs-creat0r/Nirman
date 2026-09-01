/**
 * @fileoverview Exported mutations for stock movements in Nirman ERP.
 *
 * All user-facing movement operations:
 * - issueStock (movements:issue)
 * - transferStock (movements:transfer)
 * - returnStock (movements:return)
 * - recordWastage (movements:wastage)
 * - adjustStock (movements:adjust)
 * - reverseMovement (movements:reverse)
 *
 * Each mutation enforces its dedicated granular RBAC permission and routes
 * atomically through postMovementCore in movements.ts.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import {
  postMovementCore,
  MovementType,
  AdjustmentDirection,
} from "./movements";

/**
 * Issue material from site stock to consumption.
 * Roles: site_supervisor, project_manager, admin
 */
export const issueStock = mutation({
  args: {
    siteId: v.id("sites"),
    itemName: v.string(),
    quantity: v.number(),
    unit: v.optional(v.string()),
    purpose: v.string(),
    projectItemId: v.optional(v.id("project_items")),
    category: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "movements:issue", args.token);
    return await postMovementCore(ctx, {
      siteId: args.siteId,
      itemName: args.itemName,
      unit: args.unit || "nos",
      category: args.category,
      movementType: "issue",
      quantity: args.quantity,
      purpose: args.purpose,
      projectItemId: args.projectItemId,
      sourceType: "manual",
      actorUser: user,
      token: args.token,
    });
  },
});

/**
 * Transfer material between two physical sites.
 * Posts two linked movement rows atomically (transfer_out & transfer_in).
 * Roles: project_manager, admin
 */
export const transferStock = mutation({
  args: {
    sourceSiteId: v.id("sites"),
    destinationSiteId: v.id("sites"),
    itemName: v.string(),
    quantity: v.number(),
    unit: v.optional(v.string()),
    purpose: v.string(),
    projectItemId: v.optional(v.id("project_items")),
    category: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "movements:transfer", args.token);

    if (args.sourceSiteId === args.destinationSiteId) {
      throw new Error(
        `Cannot transfer stock to the same site (${args.sourceSiteId}). Source and destination sites must be distinct.`
      );
    }

    const transferRef = `TRF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Row 1: transfer_out at source site
    const outResult = await postMovementCore(ctx, {
      siteId: args.sourceSiteId,
      counterpartySiteId: args.destinationSiteId,
      itemName: args.itemName,
      quantity: args.quantity,
      unit: args.unit || "nos",
      category: args.category,
      movementType: "transfer_out",
      sourceType: "transfer",
      sourceId: transferRef,
      sourceLineIndex: 0,
      purpose: args.purpose,
      projectItemId: args.projectItemId,
      actorUser: user,
      token: args.token,
    });

    // Row 2: transfer_in at destination site
    const inResult = await postMovementCore(ctx, {
      siteId: args.destinationSiteId,
      counterpartySiteId: args.sourceSiteId,
      itemName: args.itemName,
      quantity: args.quantity,
      unit: args.unit || "nos",
      category: args.category,
      movementType: "transfer_in",
      sourceType: "transfer",
      sourceId: transferRef,
      sourceLineIndex: 1,
      purpose: args.purpose,
      projectItemId: args.projectItemId,
      actorUser: user,
      token: args.token,
    });

    return {
      transferRef,
      outMovementId: outResult.movementId,
      inMovementId: inResult.movementId,
      sourceBalanceAfter: outResult.balanceAfter,
      destinationBalanceAfter: inResult.balanceAfter,
      isDuplicate: outResult.isDuplicate,
    };
  },
});

/**
 * Return received goods back to a vendor, referencing the source GRN.
 * Roles: site_supervisor, procurement_officer, project_manager, admin
 */
export const returnStock = mutation({
  args: {
    siteId: v.id("sites"),
    itemName: v.string(),
    quantity: v.number(),
    unit: v.optional(v.string()),
    grnId: v.id("grn"),
    vendorId: v.optional(v.id("vendors")),
    reason: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "movements:return", args.token);

    const grn = await ctx.db.get(args.grnId);
    if (!grn) {
      throw new Error(`Goods Receipt Note "${args.grnId}" not found.`);
    }

    if (grn.siteId && String(grn.siteId) !== String(args.siteId)) {
      throw new Error(
        `Cannot return stock against GRN "${args.grnId}" belonging to site "${grn.siteId}", expected site "${args.siteId}". Cross-site return linkage is forbidden.`
      );
    }

    return await postMovementCore(ctx, {
      siteId: args.siteId,
      itemName: args.itemName,
      unit: args.unit || "nos",
      movementType: "return",
      quantity: args.quantity,
      purpose: args.reason,
      sourceType: "manual",
      sourceId: String(args.grnId),
      actorUser: user,
      token: args.token,
    });
  },
});

/**
 * Record scrap, damage, or on-site wastage with mandatory explanation.
 * Roles: site_supervisor, project_manager, admin
 */
export const recordWastage = mutation({
  args: {
    siteId: v.id("sites"),
    itemName: v.string(),
    quantity: v.number(),
    unit: v.optional(v.string()),
    reason: v.string(),
    projectItemId: v.optional(v.id("project_items")),
    category: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "movements:wastage", args.token);
    return await postMovementCore(ctx, {
      siteId: args.siteId,
      itemName: args.itemName,
      unit: args.unit || "nos",
      category: args.category,
      movementType: "wastage",
      quantity: args.quantity,
      purpose: args.reason,
      projectItemId: args.projectItemId,
      sourceType: "manual",
      actorUser: user,
      token: args.token,
    });
  },
});

/**
 * Adjust physical stock count during site audit/reconciliation.
 * Roles: project_manager, admin (Site Supervisor is strictly excluded)
 */
export const adjustStock = mutation({
  args: {
    siteId: v.id("sites"),
    itemName: v.string(),
    quantity: v.number(),
    adjustmentDirection: v.union(v.literal("add"), v.literal("subtract")),
    unit: v.optional(v.string()),
    reason: v.string(),
    category: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "movements:adjust", args.token);
    return await postMovementCore(ctx, {
      siteId: args.siteId,
      itemName: args.itemName,
      unit: args.unit || "nos",
      category: args.category,
      movementType: "adjustment",
      adjustmentDirection: args.adjustmentDirection,
      quantity: args.quantity,
      purpose: args.reason,
      sourceType: "manual",
      actorUser: user,
      token: args.token,
    });
  },
});

/**
 * Reverse a previous stock movement by posting an opposing ledger row.
 * Roles: project_manager, admin (Site Supervisor is strictly excluded)
 */
export const reverseMovement = mutation({
  args: {
    movementId: v.id("stock_movements"),
    reason: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "movements:reverse", args.token);
    const original = await ctx.db.get(args.movementId);
    if (!original) throw new Error(`Stock movement "${args.movementId}" not found.`);
    if (original.movementType === "reversal") {
      throw new Error(`Cannot reverse a reversal movement (${original._id}).`);
    }

    const existingReversal = await ctx.db
      .query("stock_movements")
      .filter((q) => q.eq(q.field("reversalOfId"), original._id))
      .first();

    if (existingReversal) {
      throw new Error(
        `Movement "${original._id}" has already been reversed by movement "${existingReversal._id}".`
      );
    }

    const cleanReason = args.reason.trim();
    if (!cleanReason) throw new Error("A non-empty reason is required to reverse a stock movement.");

    return await postMovementCore(ctx, {
      siteId: original.siteId,
      itemName: original.itemName,
      category: original.category,
      unit: original.unit,
      movementType: "reversal",
      quantity: original.quantity,
      reversalOfId: original._id,
      originalMovementType: original.movementType as MovementType,
      originalAdjustmentDirection: original.adjustmentDirection as AdjustmentDirection | undefined,
      purpose: cleanReason,
      sourceType: "manual",
      sourceId: String(original._id),
      projectItemId: original.projectItemId,
      counterpartySiteId: original.counterpartySiteId,
      actorUser: user,
      token: args.token,
    });
  },
});
