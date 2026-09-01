/**
 * @fileoverview Single Writer Stock Movement Engine for Nirman ERP.
 *
 * THE ONE ARCHITECTURAL RULE:
 * Every change to physical quantity, without exception, goes through postMovement().
 * Movements are append-only. A mistake is corrected with a reversing movement,
 * never by editing or deleting a movement.
 */

import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { requirePermission, ActionName } from "./permissions";
import { resolveCallerScope, buildUserScope, assertDocumentAccess, filterScopedList } from "./scoping";

export type MovementType =
  | "receipt"
  | "issue"
  | "transfer_out"
  | "transfer_in"
  | "return"
  | "wastage"
  | "adjustment"
  | "reversal";

export type AdjustmentDirection = "add" | "subtract";
export type MovementSourceType = "grn" | "manual" | "transfer" | "backfill";

const UNIT_CANONICAL_MAP: Record<string, string> = {
  tonnes: "MT",
  tonne: "MT",
  pcs: "nos",
  pieces: "nos",
  bag: "bags",
};

export function normalizeUnit(rawUnit: string): string {
  if (!rawUnit) return "nos";
  const trimmed = rawUnit.trim();
  return UNIT_CANONICAL_MAP[trimmed.toLowerCase()] || trimmed;
}

export const ACTION_BY_MOVEMENT_TYPE: Record<MovementType, ActionName> = {
  receipt: "movements:receive",
  issue: "movements:issue",
  transfer_out: "movements:transfer",
  transfer_in: "movements:transfer",
  return: "movements:return",
  wastage: "movements:wastage",
  adjustment: "movements:adjust",
  reversal: "movements:reverse",
};

export function computeMovementDelta(
  movementType: MovementType,
  quantity: number,
  options?: {
    adjustmentDirection?: AdjustmentDirection;
    originalMovementType?: MovementType;
    originalAdjustmentDirection?: AdjustmentDirection;
  }
): number {
  if (quantity <= 0) {
    throw new Error(`Movement quantity must be strictly positive (> 0). Received ${quantity}`);
  }

  switch (movementType) {
    case "receipt":
    case "transfer_in":
      return quantity;
    case "issue":
    case "transfer_out":
    case "return":
    case "wastage":
      return -quantity;
    case "adjustment":
      if (!options?.adjustmentDirection) {
        throw new Error("Adjustment movements require adjustmentDirection ('add' | 'subtract').");
      }
      return options.adjustmentDirection === "add" ? quantity : -quantity;
    case "reversal": {
      const origType = options?.originalMovementType;
      if (!origType) {
        throw new Error("Reversal movements require originalMovementType to determine opposing delta.");
      }
      if (origType === "receipt" || origType === "transfer_in") return -quantity;
      if (origType === "issue" || origType === "transfer_out" || origType === "return" || origType === "wastage") return quantity;
      if (origType === "adjustment") {
        return (options?.originalAdjustmentDirection || "add") === "add" ? -quantity : quantity;
      }
      throw new Error(`Cannot reverse movement of type "${origType}".`);
    }
    default:
      throw new Error(`Unknown movementType: "${movementType}".`);
  }
}

export interface PostMovementCoreArgs {
  siteId: Id<"sites">;
  itemName: string;
  category?: string;
  unit: string;
  movementType: MovementType;
  quantity: number;
  adjustmentDirection?: AdjustmentDirection;
  sourceType: MovementSourceType;
  sourceId?: string;
  sourceLineIndex?: number;
  projectItemId?: Id<"project_items">;
  counterpartySiteId?: Id<"sites">;
  purpose?: string;
  reversalOfId?: Id<"stock_movements">;
  originalMovementType?: MovementType;
  originalAdjustmentDirection?: AdjustmentDirection;
  token?: string;
  actorUser?: Doc<"users">;
}

export interface PostMovementResult {
  movementId: Id<"stock_movements">;
  balanceAfter: number;
  isNegativeStock: boolean;
  isDuplicate: boolean;
}

export async function postMovementCore(
  ctx: MutationCtx,
  args: PostMovementCoreArgs
): Promise<PostMovementResult> {
  if (args.quantity <= 0 || isNaN(args.quantity)) {
    throw new Error(`Stock movement quantity must be strictly greater than 0. Received ${args.quantity}.`);
  }

  const site = await ctx.db.get(args.siteId);
  if (!site) throw new Error(`Site "${args.siteId}" not found.`);
  const projectId = site.projectId;

  const action = ACTION_BY_MOVEMENT_TYPE[args.movementType];
  const user = args.actorUser ?? (await requirePermission(ctx, action, args.token));
  const scope = args.actorUser
    ? await buildUserScope(ctx, user)
    : await resolveCallerScope(ctx, args.token);
  assertDocumentAccess(scope, { siteId: args.siteId, projectId });

  if (args.counterpartySiteId) {
    const counterSite = await ctx.db.get(args.counterpartySiteId);
    if (!counterSite) throw new Error(`Counterparty site "${args.counterpartySiteId}" not found.`);
    assertDocumentAccess(scope, { siteId: args.counterpartySiteId, projectId: counterSite.projectId });
  }

  const cleanPurpose = args.purpose?.trim();
  if (["issue", "wastage", "adjustment", "reversal"].includes(args.movementType)) {
    if (!cleanPurpose) {
      throw new Error(`Movement type "${args.movementType}" requires a non-empty purpose/reason description.`);
    }
  }

  const normalizedUnit = normalizeUnit(args.unit);

  if ((args.sourceType === "grn" || args.sourceType === "backfill") && args.sourceId) {
    const existing = await ctx.db
      .query("stock_movements")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId!))
      .collect();

    const duplicate = existing.find(
      (m) =>
        m.siteId === args.siteId &&
        m.itemName === args.itemName &&
        m.sourceType === args.sourceType &&
        (args.sourceLineIndex === undefined || m.sourceLineIndex === args.sourceLineIndex)
    );

    if (duplicate) {
      return {
        movementId: duplicate._id,
        balanceAfter: duplicate.balanceAfter,
        isNegativeStock: duplicate.isNegativeStock,
        isDuplicate: true,
      };
    }
  }

  const delta = computeMovementDelta(args.movementType, args.quantity, {
    adjustmentDirection: args.adjustmentDirection,
    originalMovementType: args.originalMovementType,
    originalAdjustmentDirection: args.originalAdjustmentDirection,
  });

  const existingInventory = await ctx.db
    .query("inventory")
    .withIndex("by_siteId_itemName", (q) => q.eq("siteId", args.siteId).eq("itemName", args.itemName))
    .first();

  const currentBalance = existingInventory?.quantity ?? 0;
  const newBalance = currentBalance + delta;
  const isNegativeStock = newBalance < 0;

  const movementId = await ctx.db.insert("stock_movements", {
    siteId: args.siteId,
    projectId,
    projectItemId: args.projectItemId,
    itemName: args.itemName,
    category: args.category || existingInventory?.category || "other",
    unit: normalizedUnit,
    movementType: args.movementType,
    quantity: args.quantity,
    adjustmentDirection: args.adjustmentDirection,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    sourceLineIndex: args.sourceLineIndex,
    counterpartySiteId: args.counterpartySiteId,
    purpose: cleanPurpose,
    reversalOfId: args.reversalOfId,
    isNegativeStock,
    balanceAfter: newBalance,
    createdBy: user._id,
  });

  const now = new Date().toISOString();
  if (existingInventory) {
    await ctx.db.patch(existingInventory._id, {
      quantity: newBalance,
      lastMovementId: movementId,
      projectId: existingInventory.projectId || projectId,
      category: existingInventory.category || args.category || "other",
      unit: normalizedUnit,
      lastUpdated: now,
      updatedBy: user._id,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("inventory", {
      itemName: args.itemName,
      category: args.category || "other",
      quantity: newBalance,
      unit: normalizedUnit,
      siteId: args.siteId,
      projectId,
      lastMovementId: movementId,
      lastUpdated: now,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });
  }

  await ctx.db.insert("logs", {
    actorId: user._id,
    actorRole: user.role,
    action: `movement_${args.movementType}`,
    documentType: "stock_movements",
    documentId: movementId,
    referenceId: `MOV-${args.movementType.toUpperCase()}`,
    fromStatus: `${currentBalance} ${normalizedUnit}`,
    toStatus: `${newBalance} ${normalizedUnit}`,
    note: cleanPurpose || `Stock ${args.movementType}: ${args.quantity} ${normalizedUnit} at site ${site.name || args.siteId}`,
    timestamp: now,
  });

  return { movementId, balanceAfter: newBalance, isNegativeStock, isDuplicate: false };
}

export const postMovement = mutation({
  args: {
    siteId: v.id("sites"),
    itemName: v.string(),
    category: v.optional(v.string()),
    unit: v.string(),
    movementType: v.union(
      v.literal("receipt"),
      v.literal("issue"),
      v.literal("transfer_out"),
      v.literal("transfer_in"),
      v.literal("return"),
      v.literal("wastage"),
      v.literal("adjustment")
    ),
    quantity: v.number(),
    adjustmentDirection: v.optional(v.union(v.literal("add"), v.literal("subtract"))),
    sourceType: v.union(v.literal("grn"), v.literal("manual"), v.literal("transfer"), v.literal("backfill")),
    sourceId: v.optional(v.string()),
    sourceLineIndex: v.optional(v.number()),
    projectItemId: v.optional(v.id("project_items")),
    counterpartySiteId: v.optional(v.id("sites")),
    purpose: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await postMovementCore(ctx, args);
  },
});

export const reverseMovement = mutation({
  args: {
    movementId: v.id("stock_movements"),
    reason: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "movements:reverse", args.token);
    const original = await ctx.db.get(args.movementId);
    if (!original) throw new Error(`Stock movement "${args.movementId}" not found.`);
    if (original.movementType === "reversal") throw new Error(`Cannot reverse a reversal movement (${original._id}).`);

    const existingReversal = await ctx.db
      .query("stock_movements")
      .filter((q) => q.eq(q.field("reversalOfId"), original._id))
      .first();

    if (existingReversal) {
      throw new Error(`Movement "${original._id}" has already been reversed by movement "${existingReversal._id}".`);
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

export const listStockMovements = query({
  args: {
    siteId: v.optional(v.id("sites")),
    projectId: v.optional(v.id("projects")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);
    let allMovements = await ctx.db.query("stock_movements").collect();
    let scoped = filterScopedList(scope, allMovements);
    if (args.siteId) scoped = scoped.filter((m) => m.siteId === args.siteId);
    if (args.projectId) scoped = scoped.filter((m) => m.projectId === args.projectId);
    scoped.sort((a, b) => new Date(b._creationTime).getTime() - new Date(a._creationTime).getTime());
    return scoped;
  },
});

export const getSiteInventory = query({
  args: {
    siteId: v.optional(v.id("sites")),
    projectId: v.optional(v.id("projects")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);
    let allInventory = await ctx.db.query("inventory").collect();
    let scoped = filterScopedList(scope, allInventory);
    if (args.siteId) scoped = scoped.filter((i) => i.siteId === args.siteId);
    if (args.projectId) scoped = scoped.filter((i) => i.projectId === args.projectId);
    return scoped;
  },
});

export const getItemMovementLedger = query({
  args: {
    siteId: v.id("sites"),
    itemName: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);
    const site = await ctx.db.get(args.siteId);
    if (!site) return null;
    assertDocumentAccess(scope, { siteId: args.siteId, projectId: site.projectId });

    const movements = await ctx.db
      .query("stock_movements")
      .withIndex("by_siteId_itemName", (q) => q.eq("siteId", args.siteId).eq("itemName", args.itemName))
      .collect();

    const inventory = await ctx.db
      .query("inventory")
      .withIndex("by_siteId_itemName", (q) => q.eq("siteId", args.siteId).eq("itemName", args.itemName))
      .first();

    movements.sort((a, b) => new Date(b._creationTime).getTime() - new Date(a._creationTime).getTime());

    return {
      site,
      itemName: args.itemName,
      currentBalance: inventory?.quantity ?? 0,
      unit: inventory?.unit || movements[0]?.unit || "nos",
      category: inventory?.category || movements[0]?.category || "other",
      lastMovementId: inventory?.lastMovementId,
      movements,
    };
  },
});
