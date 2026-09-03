/**
 * @fileoverview Purchase Order approvals, rejections, queries, and revisions.
 *
 * Implements:
 * - approvePO: Manager approval, increments committedQty, updates MR to pending_po.
 * - rejectPO: Manager rejection, resets MR to ready_for_po.
 * - queryPO: Manager clarification request.
 * - resubmitPO: Procurement officer updates and resubmits queried/draft PO.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { transition } from "./transition";
import { adjustCommittedQty } from "./purchase_order_commitments";
import { resolveCallerScope, assertDocumentAccess } from "./scoping";

/**
 * Manager approves Purchase Order → moves to approved (MR moves to pending_po).
 */
export const approvePO = mutation({
  args: {
    id: v.id("purchase_order"),
    note: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "purchase_orders:approve",
      args.token
    );

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, po, po.refNo);
    const now = new Date().toISOString();
    const res = await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      transitionName: "approve",
      token: args.token,
      note: args.note || "Purchase Order authorized and confirmed.",
      patch: {
        reviewedBy: user._id,
        reviewedAt: now,
        reviewNote: args.note || undefined,
      },
    });

    // Update committedQty on project_items [FIX-B1]
    const mr = po.materialRequestId ? await ctx.db.get(po.materialRequestId) : null;
    await adjustCommittedQty(ctx, po.lineItems, 1, mr?.items);

    return res;
  },
});

/**
 * Manager rejects Purchase Order with mandatory reason note.
 */
export const rejectPO = mutation({
  args: {
    id: v.id("purchase_order"),
    note: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "purchase_orders:reject",
      args.token
    );

    if (!args.note.trim()) {
      throw new Error("A rejection reason note is required.");
    }

    const now = new Date().toISOString();
    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, po, po.refNo);

    return await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      transitionName: "reject",
      token: args.token,
      note: args.note.trim(),
      patch: {
        reviewedBy: user._id,
        reviewedAt: now,
        reviewNote: args.note.trim(),
      },
    });
  },
});

/**
 * Manager queries Purchase Order with feedback note.
 */
export const queryPO = mutation({
  args: {
    id: v.id("purchase_order"),
    note: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "purchase_orders:query",
      args.token
    );

    if (!args.note.trim()) {
      throw new Error("A query clarification note is required.");
    }

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, po, po.refNo);

    const now = new Date().toISOString();
    return await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      transitionName: "query",
      token: args.token,
      note: args.note.trim(),
      patch: {
        reviewedBy: user._id,
        reviewedAt: now,
        reviewNote: args.note.trim(),
      },
    });
  },
});

/**
 * Procurement Officer updates and resubmits a queried/draft Purchase Order [FIX-C2].
 *
 * Supports BOQ adjustments, off-BOQ scope additions, and auto-approval bypass.
 */
export const resubmitPO = mutation({
  args: {
    id: v.id("purchase_order"),
    lineItems: v.array(
      v.object({
        itemName: v.string(),
        description: v.optional(v.string()),
        quantity: v.number(),
        unit: v.string(),
        rate: v.number(),
        projectItemId: v.optional(v.id("project_items")),
        isOffBoqAddition: v.optional(v.boolean()),
        additionReason: v.optional(v.string()),
      })
    ),
    taxRate: v.number(),
    freight: v.optional(v.number()),
    placeOfSupplyStateCode: v.optional(v.string()),
    siteContactPerson: v.optional(v.string()),
    siteContactPhone: v.optional(v.string()),
    unloadingScope: v.optional(v.string()),
    freightTerms: v.optional(v.string()),
    procurementNotes: v.optional(v.string()),
    paymentTerms: v.string(),
    expectedDelivery: v.optional(v.string()),
    validUntil: v.optional(v.string()),
    termsAndConditions: v.optional(v.string()),
    submitImmediately: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "purchase_orders:resubmit",
      args.token
    );

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, po, po.refNo);

    const isDraft = po.status === "draft";
    const settings = await ctx.db.query("settings").first();
    const requireApproval = settings?.requireManagerApprovalForRequests ?? true;
    const targetStatus = requireApproval ? "submitted" : "approved";

    // Validate off-BOQ additions
    for (const item of args.lineItems) {
      if (item.isOffBoqAddition && !item.additionReason?.trim()) {
        throw new Error(
          `A justification note is mandatory for off-BOQ line item "${item.itemName}".`
        );
      }
    }

    let subtotal = 0;
    let totalQty = 0;
    const calculatedItems = args.lineItems.map((it) => {
      const qty = Number(it.quantity);
      const rate = Number(it.rate);
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Quantity for item "${it.itemName || "Item"}" must be greater than zero.`);
      }
      if (isNaN(rate) || rate < 0) {
        throw new Error(`Rate for item "${it.itemName || "Item"}" must be non-negative.`);
      }
      const amount = Math.round(qty * rate * 100) / 100;
      subtotal += amount;
      totalQty += qty;

      return {
        itemName: it.itemName.trim(),
        description: it.description?.trim() || undefined,
        quantity: qty,
        unit: it.unit,
        rate: rate,
        amount: amount,
        projectItemId: it.projectItemId || undefined,
        isOffBoqAddition: it.isOffBoqAddition || undefined,
        additionReason: it.additionReason?.trim() || undefined,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    const taxRate = Number(args.taxRate);
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      throw new Error("Tax rate must be between 0% and 100%.");
    }
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const freight = args.freight !== undefined ? Number(args.freight) : 0;
    if (isNaN(freight) || freight < 0) {
      throw new Error("Freight amount must be non-negative.");
    }
    const totalAmount = Math.round((subtotal + taxAmount + freight) * 100) / 100;

    const offBoqItems = calculatedItems.filter((it) => it.isOffBoqAddition);
    let transitionNote: string | undefined;
    if (offBoqItems.length > 0) {
      const additionSummary = offBoqItems
        .map(
          (it) =>
            `Added "${it.itemName}" (${it.quantity} ${it.unit} @ ₹${it.rate}): ${it.additionReason || "No justification provided"}`
        )
        .join("; ");
      transitionNote = `Scope additions: ${additionSummary}${
        args.procurementNotes ? ` | Remarks: ${args.procurementNotes.trim()}` : ""
      }`;
    } else if (args.procurementNotes) {
      transitionNote = args.procurementNotes.trim();
    }

    return await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      transitionName: isDraft ? "submit" : "resubmit",
      to: targetStatus,
      token: args.token,
      note: transitionNote,
      patch: {
        lineItems: calculatedItems,
        subtotal,
        taxRate,
        taxAmount,
        freight: freight > 0 ? freight : undefined,
        totalAmount,
        placeOfSupplyStateCode: args.placeOfSupplyStateCode?.trim() || undefined,
        siteContactPerson: args.siteContactPerson?.trim() || undefined,
        siteContactPhone: args.siteContactPhone?.trim() || undefined,
        unloadingScope: args.unloadingScope || undefined,
        freightTerms: args.freightTerms || undefined,
        procurementNotes: args.procurementNotes?.trim() || undefined,
        pendingQty: totalQty,
        paymentTerms: args.paymentTerms,
        expectedDelivery: args.expectedDelivery || undefined,
        validUntil: args.validUntil || undefined,
        termsAndConditions: args.termsAndConditions || undefined,
      },
    });
  },
});
