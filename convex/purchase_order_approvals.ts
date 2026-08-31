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
      from: "submitted",
      to: "approved",
      action: "purchase_orders:approve",
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

    // Update parent Material Request to pending_po (awaiting vendor delivery/DC)
    if (po.materialRequestId && mr) {
      await transition(ctx, {
        table: "material_request",
        documentId: mr._id,
        from: ["review_po", "ready_for_po", "draft"],
        to: "pending_po",
        action: "material_requests:advance_on_po_approval",
        token: args.token,
        note: `Purchase Order ${po.refNo} approved by ${user.name}. Awaiting vendor delivery challan.`,
      });
    }

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

    const res = await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      from: "submitted",
      to: "rejected",
      action: "purchase_orders:reject",
      token: args.token,
      note: args.note.trim(),
      patch: {
        reviewedBy: user._id,
        reviewedAt: now,
        reviewNote: args.note.trim(),
      },
    });

    // Reset parent MR status back to ready_for_po so procurement can re-raise PO
    if (po.materialRequestId) {
      const mr = await ctx.db.get(po.materialRequestId);
      if (mr && mr.status === "review_po") {
        await transition(ctx, {
          table: "material_request",
          documentId: mr._id,
          from: "review_po",
          to: "ready_for_po",
          action: "material_requests:reset_on_po_reject",
          token: args.token,
          note: `Purchase Order ${po.refNo} was rejected by ${user.name}. Material Request returned to ready_for_po for revision. Reason: ${args.note.trim()}`,
        });
      }
    }

    return res;
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
      from: "submitted",
      to: "queried",
      action: "purchase_orders:query",
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
 * Procurement Officer updates & resubmits a queried Purchase Order.
 */
export const resubmitPO = mutation({
  args: {
    id: v.id("purchase_order"),
    lineItems: v.array(
      v.object({
        itemName: v.string(),
        quantity: v.number(),
        unit: v.string(),
        rate: v.number(),
        hsnSacCode: v.optional(v.string()),
        projectItemId: v.optional(v.id("project_items")),
        isUnquotedAddition: v.optional(v.boolean()),
        additionReason: v.optional(v.string()),
      })
    ),
    taxRate: v.number(),
    freight: v.optional(v.number()),
    placeOfSupplyStateCode: v.optional(v.string()),
    siteContactPerson: v.optional(v.string()),
    siteContactPhone: v.optional(v.string()),
    unloadingScope: v.optional(
      v.union(v.literal("buyer_scope"), v.literal("vendor_scope"))
    ),
    freightTerms: v.optional(
      v.union(
        v.literal("inclusive_in_rate"),
        v.literal("extra_at_actuals"),
        v.literal("fixed_freight"),
        v.literal("to_pay_by_site")
      )
    ),
    procurementNotes: v.optional(v.string()),
    paymentTerms: v.union(
      v.literal("advance"),
      v.literal("on_delivery"),
      v.literal("7_days"),
      v.literal("15_days"),
      v.literal("30_days"),
      v.literal("45_days")
    ),
    expectedDelivery: v.optional(v.string()),
    validUntil: v.optional(v.string()),
    termsAndConditions: v.optional(v.string()),
    submitImmediately: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      "purchase_orders:resubmit",
      args.token
    );

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, po, po.refNo);

    // Validate unquoted additions have reason [FIX-B1]
    for (const item of args.lineItems) {
      if (item.isUnquotedAddition && !item.additionReason?.trim()) {
        throw new Error(
          `An addition reason is required for unquoted addition item "${item.itemName}".`
        );
      }
    }

    const calculatedItems = args.lineItems.map((item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      return {
        itemName: item.itemName,
        quantity: qty,
        unit: item.unit,
        rate: rate,
        amount: Math.round(qty * rate * 100) / 100,
        hsnSacCode: item.hsnSacCode || undefined,
        projectItemId: item.projectItemId || undefined,
        isUnquotedAddition: item.isUnquotedAddition || undefined,
        additionReason: item.additionReason?.trim() || undefined,
      };
    });

    const subtotal = Math.round(
      calculatedItems.reduce((acc, cur) => acc + cur.amount, 0) * 100
    ) / 100;
    const totalQty = calculatedItems.reduce((acc, cur) => acc + cur.quantity, 0);
    const taxRate =
      args.taxRate !== undefined && !isNaN(Number(args.taxRate))
        ? Math.max(0, Math.min(100, Number(args.taxRate)))
        : 18;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const freight = Math.max(0, Number(args.freight) || 0);
    const totalAmount = Math.round((subtotal + taxAmount + freight) * 100) / 100;

    const isDraft = po.status === "draft";
    const targetStatus = isDraft && !args.submitImmediately ? "draft" : "submitted";

    // Format scope additions & justifications into audit log note
    const additionItems = calculatedItems.filter((it) => it.isUnquotedAddition);
    let transitionNote: string | undefined = undefined;
    if (additionItems.length > 0) {
      const additionSummary = additionItems
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

    const res = await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      from: isDraft ? "draft" : "queried",
      to: targetStatus,
      action: "purchase_orders:resubmit",
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
        unloadingScope: args.unloadingScope || "buyer_scope",
        freightTerms: args.freightTerms || "inclusive_in_rate",
        procurementNotes: args.procurementNotes?.trim() || undefined,
        pendingQty: totalQty,
        paymentTerms: args.paymentTerms,
        expectedDelivery: args.expectedDelivery || undefined,
        validUntil: args.validUntil || undefined,
        termsAndConditions: args.termsAndConditions || undefined,
      },
    });

    // If submitted, advance parent MR status to review_po and record audit note
    if (targetStatus === "submitted" && po.materialRequestId) {
      const mr = await ctx.db.get(po.materialRequestId);
      if (mr && (mr.status === "ready_for_po" || mr.status === "draft" || mr.status === "review_po")) {
        const mrLogNote = transitionNote
          ? `Purchase Order ${po.refNo} submitted with ${transitionNote}`
          : `Purchase Order ${po.refNo} submitted for manager approval`;

        await transition(ctx, {
          table: "material_request",
          documentId: mr._id,
          from: ["ready_for_po", "draft", "review_po"],
          to: "review_po",
          action: "material_requests:review_on_po",
          token: args.token,
          note: `Purchase Order ${po.refNo} resubmitted for manager approval`,
        });
      }
    }

    return res;
  },
});
