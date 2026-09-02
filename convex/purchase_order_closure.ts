/**
 * @fileoverview Purchase Order cancellation, short-closing, and discarding.
 *
 * Implements:
 * - cancelPO: Full cancellation (0 GRNs) or short-close (≥1 GRNs) with committedQty unwinding.
 * - deletePO: Hard delete for draft/queried POs with no downstream delivery challans.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { transition } from "./transition";
import { resolveCallerScope, assertDocumentAccess } from "./scoping";

/**
 * Cancel or Short-Close an active Purchase Order [FIX-I5, FIX-I7, D2].
 * - Full cancellation (0 GRNs): PO → "cancelled", releases all committedQty, resets MR to ready_for_po.
 * - Short close (≥1 GRN): PO → "closed", releases remainder committedQty, sets MR to delivered.
 */
export const cancelPO = mutation({
  args: {
    id: v.id("purchase_order"),
    reason: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      "purchase_orders:cancel",
      args.token
    );

    if (!args.reason?.trim()) {
      throw new Error("A cancellation reason is required.");
    }

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, po, po.refNo);

    if (po.status !== "submitted" && po.status !== "approved") {
      throw new Error(
        `Only submitted or approved Purchase Orders can be cancelled. Current status: "${po.status}".`
      );
    }

    // Check if any Delivery Challans are in transit / active
    const dcs = await ctx.db
      .query("delivery_challan")
      .withIndex("by_purchaseOrderId", (q) => q.eq("purchaseOrderId", args.id))
      .collect();

    const activeDC = dcs.find((dc) => dc.status === "delivery_processing");
    if (activeDC) {
      throw new Error(
        `Cannot cancel Purchase Order with active Delivery Challan (${activeDC.refNo}) in transit. Please cancel or resolve delivery challans first.`
      );
    }

    // Fetch all GRNs for this PO to determine if short-close or full cancel
    const allGRNs = await ctx.db
      .query("grn")
      .withIndex("by_purchaseOrderId", (q) => q.eq("purchaseOrderId", args.id))
      .collect();

    const isShortClose = allGRNs.length > 0;
    const targetStatus = isShortClose ? "closed" : "cancelled";
    const closureType = isShortClose ? "short_closed" : "cancelled";
    const mr = po.materialRequestId ? await ctx.db.get(po.materialRequestId) : null;

    // Unwind commitment
    for (const item of po.lineItems) {
      let projectItemId = item.projectItemId;
      if (!projectItemId && mr?.items) {
        const match = mr.items.find(
          (m) => m.itemName.toLowerCase().trim() === item.itemName.toLowerCase().trim()
        );
        if (match?.projectItemId) {
          projectItemId = match.projectItemId;
        }
      }

      if (projectItemId) {
        const projectItem = await ctx.db.get(projectItemId);
        if (projectItem) {
          let releaseQty = item.quantity;
          if (isShortClose) {
            const cumReceived = allGRNs.reduce((sum, grn) => {
              const ri = grn.receivedItems?.find(
                (r) => r.itemName.toLowerCase().trim() === item.itemName.toLowerCase().trim()
              );
              return sum + (ri?.receivedQty || 0);
            }, 0);
            releaseQty = Math.max(0, item.quantity - cumReceived);
          }

          const currentCommitted = projectItem.committedQty ?? 0;
          const newCommitted = Math.max(0, currentCommitted - releaseQty);
          await ctx.db.patch(projectItemId, {
            committedQty: newCommitted,
          });
        }
      }
    }

    return await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      transitionName: isShortClose ? "close" : "cancel",
      token: args.token,
      note: args.reason.trim(),
      patch: {
        cancellationReason: args.reason.trim(),
        closureType,
      },
    });
  },
});

/**
 * Delete / Discard a draft or queried Purchase Order [D1].
 * Hard delete permitted only on draft/queried POs with no downstream delivery challans.
 */
export const deletePO = mutation({
  args: {
    id: v.id("purchase_order"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "purchase_orders:delete",
      args.token
    );

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, po, po.refNo);

    if (po.status !== "draft" && po.status !== "queried") {
      throw new Error(
        `Only draft or queried Purchase Orders can be discarded. Current status: "${po.status}". Submitted or approved orders must be cancelled via Cancel PO.`
      );
    }

    // Check if any delivery challans or GRNs are tied to this PO
    const existingDC = await ctx.db
      .query("delivery_challan")
      .withIndex("by_purchaseOrderId", (q) => q.eq("purchaseOrderId", args.id))
      .first();

    if (existingDC) {
      throw new Error(
        "Cannot discard this Purchase Order because delivery challans already reference it."
      );
    }

    const now = new Date().toISOString();

    // Log the discard action before hard deleting
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "discard_draft",
      documentType: "purchase_order",
      documentId: args.id,
      referenceId: po.refNo,
      fromStatus: po.status,
      toStatus: undefined,
      note: `Purchase Order ${po.refNo} (${po.status}) was discarded by ${user.name}.`,
      timestamp: now,
    });

    await ctx.db.delete(args.id);

    return { success: true, deletedRefNo: po.refNo };
  },
});
