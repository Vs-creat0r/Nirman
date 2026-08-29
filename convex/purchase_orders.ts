/**
 * @fileoverview Purchase Order (PO) backend operations and lifecycle.
 *
 * Full pipeline:
 * Auto-generate from Approved CC (winning vendor & line items snapshotted) →
 * Submit for Review (MR → review_po) →
 * Manager Approves (PO → approved, MR → pending_po) / Queries / Rejects.
 */

import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";
import { transition } from "./transition";
import { Id } from "./_generated/dataModel";

/**
 * Generates monotonic reference number: PO-YYYY-NNNN
 */
async function generatePORefNo(ctx: MutationCtx): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PO-${currentYear}-`;

  const allPOs = await ctx.db.query("purchase_order").collect();
  let maxSeq = 0;

  for (const po of allPOs) {
    if (po.refNo && po.refNo.startsWith(prefix)) {
      const numPart = parseInt(po.refNo.replace(prefix, ""), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Adjusts committedQty on project_items for line items with resolved projectItemId [FIX-B1].
 */
async function adjustCommittedQty(
  ctx: MutationCtx,
  lineItems: Array<{
    itemName: string;
    quantity: number;
    projectItemId?: Id<"project_items">;
  }>,
  delta: number,
  mrItems?: Array<{
    itemName: string;
    projectItemId?: Id<"project_items">;
  }>
) {
  for (const item of lineItems) {
    let projectItemId = item.projectItemId;
    if (!projectItemId && mrItems) {
      const match = mrItems.find(
        (m) => m.itemName.toLowerCase().trim() === item.itemName.toLowerCase().trim()
      );
      if (match?.projectItemId) {
        projectItemId = match.projectItemId;
      }
    }

    if (projectItemId) {
      const projectItem = await ctx.db.get(projectItemId);
      if (projectItem) {
        const currentCommitted = projectItem.committedQty ?? 0;
        const newCommitted = Math.max(0, currentCommitted + delta * item.quantity);
        await ctx.db.patch(projectItemId, {
          committedQty: newCommitted,
        });
      }
    } else {
      console.error(`[PO Commitment] Could not resolve projectItemId for item "${item.itemName}"`);
    }
  }
}

/**
 * Create a new Purchase Order auto-filled from an approved Cost Comparison.
 * Zero manual re-entry: snapshots winning vendor's line items and commercial terms.
 */
export const createPOFromCC = mutation({
  args: {
    costComparisonId: v.id("cost_comparison"),
    expectedDelivery: v.optional(v.string()),
    validUntil: v.optional(v.string()),
    paymentTerms: v.optional(
      v.union(
        v.literal("advance"),
        v.literal("on_delivery"),
        v.literal("7_days"),
        v.literal("15_days"),
        v.literal("30_days"),
        v.literal("45_days")
      )
    ),
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
    termsAndConditions: v.optional(v.string()),
    tcTemplateId: v.optional(v.id("tc_templates")),
    submitImmediately: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(
      ctx,
      ["procurement_officer", "project_manager", "admin"],
      args.token
    );

    const cc = await ctx.db.get(args.costComparisonId);
    if (!cc) {
      throw new Error("Cost comparison not found.");
    }

    if (cc.status !== "approved") {
      throw new Error("Cost comparison must be approved by the Project Manager before generating a Purchase Order.");
    }

    if (!cc.selectedVendorId) {
      throw new Error("Cost comparison has no selected winning vendor.");
    }

    // Find the winning quote
    const winningQuote = cc.vendorQuotes.find(
      (q) => q.vendorId === cc.selectedVendorId
    );

    if (!winningQuote) {
      throw new Error("Winning vendor quote could not be located in the cost comparison.");
    }

    // Duplicate PO guard [FIX-I1]
    const existingPOs = await ctx.db
      .query("purchase_order")
      .withIndex("by_costComparisonId", (q) => q.eq("costComparisonId", cc._id))
      .collect();

    const activePO = existingPOs.find((p) =>
      ["draft", "submitted", "queried", "approved"].includes(p.status)
    );
    if (activePO) {
      throw new Error(
        `A Purchase Order (${activePO.refNo}) already exists for this Cost Comparison.`
      );
    }

    // Load parent MR items if available to inherit HSN/SAC code
    const mr = cc.materialRequestId ? await ctx.db.get(cc.materialRequestId) : null;
    const mrItemMap = new Map<string, string | undefined>();
    if (mr && mr.items) {
      for (const item of mr.items) {
        if (item.itemName && item.hsnSacCode) {
          mrItemMap.set(item.itemName.toLowerCase().trim(), item.hsnSacCode);
        }
      }
    }

    // Snapshot line items with amounts and projectItemId [FIX-B1]
    const snapshottedLineItems = winningQuote.items.map((item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const hsnSacCode = mrItemMap.get(item.itemName.toLowerCase().trim()) || undefined;
      let projectItemId = item.projectItemId;
      if (!projectItemId && mr?.items) {
        const match = mr.items.find(
          (m) => m.itemName.toLowerCase().trim() === item.itemName.toLowerCase().trim()
        );
        if (match?.projectItemId) {
          projectItemId = match.projectItemId;
        }
      }

      return {
        itemName: item.itemName,
        quantity: qty,
        unit: item.unit,
        rate: rate,
        amount: Math.round(qty * rate * 100) / 100,
        hsnSacCode: hsnSacCode,
        projectItemId: projectItemId || undefined,
      };
    });

    const subtotal = Math.round(
      snapshottedLineItems.reduce((acc, cur) => acc + cur.amount, 0) * 100
    ) / 100;
    const taxRate = Number(winningQuote.taxRate) || 18;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const freight = Math.max(0, Number(winningQuote.freight) || 0);
    const totalAmount = Math.round((subtotal + taxAmount + freight) * 100) / 100;

    const validPaymentTerms = ["advance", "on_delivery", "7_days", "15_days", "30_days", "45_days"] as const;
    type PaymentTermType = (typeof validPaymentTerms)[number];
    let paymentTerms: PaymentTermType = "30_days";
    let paymentTermsNotice = "";

    if (args.paymentTerms && (validPaymentTerms as readonly string[]).includes(args.paymentTerms)) {
      paymentTerms = args.paymentTerms as PaymentTermType;
    } else if (winningQuote.paymentTerms) {
      if ((validPaymentTerms as readonly string[]).includes(winningQuote.paymentTerms)) {
        paymentTerms = winningQuote.paymentTerms as PaymentTermType;
      } else {
        paymentTermsNotice = ` (Quote specified '${winningQuote.paymentTerms}', coerced to 30_days)`;
      }
    }

    const refNo = await generatePORefNo(ctx);
    const now = new Date().toISOString();

    // Auto-approve if raised directly by manager or admin
    const initialStatus =
      user.role === "project_manager" || user.role === "admin"
        ? "approved"
        : args.submitImmediately
        ? "submitted"
        : "draft";

    const poId = await ctx.db.insert("purchase_order", {
      refNo,
      costComparisonId: cc._id,
      materialRequestId: cc.materialRequestId,
      vendorId: cc.selectedVendorId,
      projectId: cc.projectId,
      siteId: cc.siteId,
      lineItems: snapshottedLineItems,
      subtotal,
      freight: freight > 0 ? freight : undefined,
      taxRate,
      taxAmount,
      totalAmount,
      placeOfSupplyStateCode: args.placeOfSupplyStateCode?.trim() || undefined,
      siteContactPerson: args.siteContactPerson?.trim() || undefined,
      siteContactPhone: args.siteContactPhone?.trim() || undefined,
      unloadingScope: args.unloadingScope || "buyer_scope",
      freightTerms: args.freightTerms || "inclusive_in_rate",
      procurementNotes: args.procurementNotes?.trim() || undefined,
      paymentTerms,
      expectedDelivery: args.expectedDelivery || undefined,
      validUntil: args.validUntil || undefined,
      termsAndConditions: args.termsAndConditions || undefined,
      tcTemplateId: args.tcTemplateId || undefined,
      deliveredQty: 0,
      pendingQty: snapshottedLineItems.reduce((acc, cur) => acc + cur.quantity, 0),
      status: initialStatus,
      reviewedBy: initialStatus === "approved" ? user._id : undefined,
      reviewedAt: initialStatus === "approved" ? now : undefined,
      reviewNote: initialStatus === "approved" ? "Auto-approved (issued directly by manager/admin)" : undefined,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    // If auto-approved directly, increment committedQty on project_items [FIX-B1]
    if (initialStatus === "approved") {
      await adjustCommittedQty(ctx, snapshottedLineItems, 1, mr?.items);
    }

    const vendor = await ctx.db.get(cc.selectedVendorId);
    const vendorName = vendor?.name || "Vendor";

    // Write audit log entry
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: initialStatus === "draft" ? "create_po_draft" : initialStatus === "approved" ? "create_and_approve_po" : "create_and_submit_po",
      documentType: "purchase_order",
      documentId: poId,
      referenceId: refNo,
      fromStatus: undefined,
      toStatus: initialStatus,
      note: `Purchase Order generated from ${cc.refNo} for ${vendorName} (Total: ₹${totalAmount.toLocaleString("en-IN")})${paymentTermsNotice}`,
      timestamp: now,
    });

    // Update parent Material Request status:
    // If draft -> leave MR in ready_for_po (Fix 1).
    // If approved -> MR to pending_po.
    // If submitted -> MR to review_po.
    if (cc.materialRequestId && mr && initialStatus !== "draft") {
      const mrToStatus = initialStatus === "approved" ? "pending_po" : "review_po";
      await ctx.db.patch(mr._id, {
        status: mrToStatus,
        updatedBy: user._id,
        updatedAt: now,
      });

      await ctx.db.insert("logs", {
        actorId: user._id,
        actorRole: user.role,
        action: "po_generated_for_mr",
        documentType: "material_request",
        documentId: mr._id,
        referenceId: mr.refNo,
        fromStatus: mr.status,
        toStatus: mrToStatus,
        note: `Purchase Order ${refNo} generated (${initialStatus}) with ${vendorName}`,
        timestamp: now,
      });
    }

    return {
      id: poId,
      refNo,
      status: initialStatus,
    };
  },
});

/**
 * Submit a draft Purchase Order for Manager review.
 */
export const submitPO = mutation({
  args: {
    id: v.id("purchase_order"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(
      ctx,
      ["procurement_officer", "project_manager", "admin"],
      args.token
    );

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const res = await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      from: "draft",
      to: "submitted",
      actorRole: ["procurement_officer", "project_manager", "admin"],
      token: args.token,
      action: "submit_purchase_order",
    });

    // Update parent MR to review_po
    if (po.materialRequestId) {
      const mr = await ctx.db.get(po.materialRequestId);
      if (mr && (mr.status === "ready_for_po" || mr.status === "draft")) {
        await ctx.db.patch(mr._id, {
          status: "review_po",
          updatedBy: user._id,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return res;
  },
});

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
    const user = await requireRole(
      ctx,
      ["project_manager", "admin"],
      args.token
    );

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const now = new Date().toISOString();
    const res = await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      from: "submitted",
      to: "approved",
      actorRole: ["project_manager", "admin"],
      token: args.token,
      action: "approve_purchase_order",
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
    if (po.materialRequestId) {
      if (mr) {
        await ctx.db.patch(mr._id, {
          status: "pending_po",
          updatedBy: user._id,
          updatedAt: now,
        });

        await ctx.db.insert("logs", {
          actorId: user._id,
          actorRole: user.role,
          action: "po_approved_mr_pending_po",
          documentType: "material_request",
          documentId: mr._id,
          referenceId: mr.refNo,
          fromStatus: mr.status,
          toStatus: "pending_po",
          note: `Purchase Order ${po.refNo} approved by ${user.name}. Awaiting vendor delivery challan.`,
          timestamp: now,
        });
      }
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
    const user = await requireRole(
      ctx,
      ["project_manager", "admin"],
      args.token
    );

    if (!args.note.trim()) {
      throw new Error("A rejection reason note is required.");
    }

    const now = new Date().toISOString();
    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const res = await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      from: "submitted",
      to: "rejected",
      actorRole: ["project_manager", "admin"],
      token: args.token,
      action: "reject_purchase_order",
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
        await ctx.db.patch(mr._id, {
          status: "ready_for_po",
          updatedBy: user._id,
          updatedAt: now,
        });

        await ctx.db.insert("logs", {
          actorId: user._id,
          actorRole: user.role,
          action: "po_rejected_mr_reset",
          documentType: "material_request",
          documentId: mr._id,
          referenceId: mr.refNo,
          fromStatus: "review_po",
          toStatus: "ready_for_po",
          note: `Purchase Order ${po.refNo} was rejected by ${user.name}. Material Request returned to ready_for_po for revision. Reason: ${args.note.trim()}`,
          timestamp: now,
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
    const user = await requireRole(
      ctx,
      ["project_manager", "admin"],
      args.token
    );

    if (!args.note.trim()) {
      throw new Error("A query clarification note is required.");
    }

    const now = new Date().toISOString();
    return await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      from: "submitted",
      to: "queried",
      actorRole: ["project_manager", "admin"],
      token: args.token,
      action: "query_purchase_order",
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
    const user = await requireRole(
      ctx,
      ["procurement_officer", "project_manager", "admin"],
      args.token
    );

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
    const taxRate = Number(args.taxRate) || 18;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const freight = Math.max(0, Number(args.freight) || 0);
    const totalAmount = Math.round((subtotal + taxAmount + freight) * 100) / 100;

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const isDraft = po.status === "draft";
    const targetStatus = isDraft && !args.submitImmediately ? "draft" : "submitted";
    const actionName =
      isDraft && !args.submitImmediately
        ? "edit_po_draft"
        : isDraft
        ? "submit_purchase_order"
        : "resubmit_purchase_order";

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
      actorRole: ["procurement_officer", "project_manager", "admin"],
      token: args.token,
      action: actionName,
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
        const now = new Date().toISOString();
        await ctx.db.patch(mr._id, {
          status: "review_po",
          updatedBy: user._id,
          updatedAt: now,
        });

        const mrLogNote = transitionNote
          ? `Purchase Order ${po.refNo} submitted with ${transitionNote}`
          : `Purchase Order ${po.refNo} submitted for manager approval`;

        await ctx.db.insert("logs", {
          actorId: user._id,
          actorRole: user.role,
          action: "po_submitted_for_mr",
          documentType: "material_request",
          documentId: mr._id,
          referenceId: mr.refNo,
          fromStatus: mr.status,
          toStatus: "review_po",
          note: mrLogNote,
          timestamp: now,
        });
      }
    }

    return res;
  },
});

/**
 * List Purchase Orders with status filters and enriched joins.
 */
export const listPOs = query({
  args: {
    status: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    vendorId: v.optional(v.id("vendors")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    let pos = await ctx.db.query("purchase_order").collect();

    if (args.status) {
      pos = pos.filter((po) => po.status === args.status);
    }

    if (args.projectId) {
      pos = pos.filter((po) => po.projectId === args.projectId);
    }

    if (args.vendorId) {
      pos = pos.filter((po) => po.vendorId === args.vendorId);
    }

    // Sort newest first
    pos.sort((a, b) => b._creationTime - a._creationTime);

    // Enrich with Project, Site, Vendor, and MR references
    const enriched = await Promise.all(
      pos.map(async (po) => {
        const project = await ctx.db.get(po.projectId);
        const site = po.siteId ? await ctx.db.get(po.siteId) : null;
        const vendor = await ctx.db.get(po.vendorId);
        const mr = po.materialRequestId ? await ctx.db.get(po.materialRequestId) : null;
        const cc = po.costComparisonId ? await ctx.db.get(po.costComparisonId) : null;
        const creator = (await ctx.db.get(po.createdBy)) as { name?: string } | null;

        return {
          ...po,
          projectName: project?.name || "Unknown Project",
          projectCode: project?.code || "",
          siteName: site ? `${site.name} (${site.code})` : "Main Site",
          vendorName: vendor?.name || "Unknown Vendor",
          vendorPhone: vendor?.phone || "",
          materialRequestRefNo: mr?.refNo || "MR",
          costComparisonRefNo: cc?.refNo || "CC",
          creatorName: creator?.name || "Unknown User",
          itemCount: po.lineItems.length,
        };
      })
    );

    return enriched;
  },
});

/**
 * List approved Cost Comparisons that are ready for Purchase Order generation.
 */
export const listApprovedCCsForPO = query({
  args: {
    projectId: v.optional(v.id("projects")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer"],
      args.token
    );

    let ccs = await ctx.db
      .query("cost_comparison")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    if (args.projectId) {
      ccs = ccs.filter((cc) => cc.projectId === args.projectId);
    }

    // Check which approved CCs already have an active PO (excluding rejected & cancelled)
    const allPOs = await ctx.db.query("purchase_order").collect();
    const ccIdsWithPO = new Set(
      allPOs
        .filter((po) => po.status !== "rejected" && po.status !== "cancelled")
        .map((po) => po.costComparisonId)
    );

    // Filter to approved CCs without PO
    const pendingCCs = ccs.filter((cc) => !ccIdsWithPO.has(cc._id));
    pendingCCs.sort((a, b) => b._creationTime - a._creationTime);

    const enriched = await Promise.all(
      pendingCCs.map(async (cc) => {
        const project = await ctx.db.get(cc.projectId);
        const site = cc.siteId ? await ctx.db.get(cc.siteId) : null;
        const mr = await ctx.db.get(cc.materialRequestId);
        const vendor = cc.selectedVendorId ? await ctx.db.get(cc.selectedVendorId) : null;
        const winningQuote = cc.vendorQuotes.find((q) => q.vendorId === cc.selectedVendorId);

        return {
          ...cc,
          projectName: project?.name || "Unknown Project",
          siteName: site ? `${site.name} (${site.code})` : "Main Site",
          siteAddress: site?.address || "",
          materialRequestRefNo: mr?.refNo || "MR",
          selectedVendorName: vendor?.name || "Selected Vendor",
          selectedVendorGstNo: vendor?.gstNo || "",
          selectedVendorPhone: vendor?.phone || "",
          winningTotal: winningQuote?.total || 0,
          winningSubtotal: winningQuote?.subtotal || 0,
          winningTaxRate: winningQuote?.taxRate || 18,
          winningFreight: winningQuote?.freight || 0,
          winningPaymentTerms: winningQuote?.paymentTerms,
          winningDeliveryDays: winningQuote?.deliveryDays,
          winningItems: winningQuote?.items || [],
          itemCount: winningQuote?.items.length || 0,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single Purchase Order with complete vendor profile, lineage references, and logs.
 */
export const getPO = query({
  args: {
    id: v.id("purchase_order"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    const po = await ctx.db.get(args.id);
    if (!po) return null;

    const project = await ctx.db.get(po.projectId);
    const site = po.siteId ? await ctx.db.get(po.siteId) : null;
    const vendor = await ctx.db.get(po.vendorId);
    const mr = po.materialRequestId ? await ctx.db.get(po.materialRequestId) : null;
    const cc = po.costComparisonId ? await ctx.db.get(po.costComparisonId) : null;
    const creator = (await ctx.db.get(po.createdBy)) as { name?: string } | null;
    const reviewer = po.reviewedBy
      ? ((await ctx.db.get(po.reviewedBy)) as { name?: string } | null)
      : null;

    // Fetch company profile settings
    const settingsDoc = await ctx.db.query("settings").first();
    const buyerCompany = {
      companyName: settingsDoc?.companyName || "Nirman Construction & Infra Pvt Ltd",
      companyGstNo: settingsDoc?.companyGstNo || "27AABCN1234F1Z5",
      companyBillingAddress:
        settingsDoc?.companyBillingAddress ||
        "Plot 42, Sector 18, Commercial Hub, Mumbai, Maharashtra - 400001",
      companyContactPerson: settingsDoc?.companyContactPerson || "Head of Procurement",
      companyPhone: settingsDoc?.companyPhone || "+91 98765 43210",
      companyEmail: settingsDoc?.companyEmail || "procurement@nirman.infra",
    };

    // Fetch audit history
    const logs = await ctx.db
      .query("logs")
      .filter((q) => q.eq(q.field("documentId"), args.id))
      .collect();

    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const actor = (await ctx.db.get(log.actorId)) as { name?: string } | null;
        return {
          ...log,
          actorName: actor?.name || "Unknown User",
        };
      })
    );

    enrichedLogs.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      ...po,
      projectName: project?.name || "Unknown Project",
      projectCode: project?.code || "",
      siteName: site ? `${site.name} (${site.code})` : "Main Site",
      siteAddress: site?.address || "Site Premises",
      buyerCompany,
      vendor: vendor
        ? {
            _id: vendor._id,
            name: vendor.name,
            phone: vendor.phone,
            email: vendor.email,
            gstNo: vendor.gstNo,
            address: vendor.address,
            contactPerson: vendor.contactPerson,
          }
        : null,
      materialRequest: mr
        ? {
            _id: mr._id,
            refNo: mr.refNo,
            status: mr.status,
            priority: mr.priority,
            requiredBy: mr.requiredBy,
          }
        : null,
      costComparison: cc
        ? {
            _id: cc._id,
            refNo: cc.refNo,
            status: cc.status,
            quoteCount: cc.vendorQuotes.length,
          }
        : null,
      creatorName: creator?.name || "Unknown User",
      reviewerName: reviewer?.name || null,
      logs: enrichedLogs,
    };
  },
});

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
    const user = await requireRole(
      ctx,
      ["project_manager", "admin"],
      args.token
    );

    if (!args.reason?.trim()) {
      throw new Error("A cancellation reason is required.");
    }

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

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

    const actionName = isShortClose ? "short_close_purchase_order" : "cancel_purchase_order";
    const res = await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      from: ["submitted", "approved"],
      to: targetStatus,
      actorRole: ["project_manager", "admin"],
      token: args.token,
      action: actionName,
      note: args.reason.trim(),
      patch: {
        cancellationReason: args.reason.trim(),
        closureType,
      },
    });

    // Update parent Material Request status
    if (mr) {
      const now = new Date().toISOString();
      if (!isShortClose) {
        // Full cancel: reset MR back to ready_for_po if in review_po / pending_po
        if (mr.status === "review_po" || mr.status === "pending_po") {
          await ctx.db.patch(mr._id, {
            status: "ready_for_po",
            updatedBy: user._id,
            updatedAt: now,
          });

          await ctx.db.insert("logs", {
            actorId: user._id,
            actorRole: user.role,
            action: "mr_reset_ready_for_po",
            documentType: "material_request",
            documentId: mr._id,
            referenceId: mr.refNo,
            fromStatus: mr.status,
            toStatus: "ready_for_po",
            note: `Purchase Order ${po.refNo} was cancelled. Material Request returned to ready_for_po for re-issuance. Reason: ${args.reason.trim()}`,
            timestamp: now,
          });
        }
      } else {
        // Short close: goods were received, transition MR to delivered closeout
        if (mr.status !== "delivered") {
          await ctx.db.patch(mr._id, {
            status: "delivered",
            updatedBy: user._id,
            updatedAt: now,
          });

          await ctx.db.insert("logs", {
            actorId: user._id,
            actorRole: user.role,
            action: "mr_short_closed_delivered",
            documentType: "material_request",
            documentId: mr._id,
            referenceId: mr.refNo,
            fromStatus: mr.status,
            toStatus: "delivered",
            note: `Purchase Order ${po.refNo} was short-closed (${args.reason.trim()}). Material Request closed at delivered quantities.`,
            timestamp: now,
          });
        }
      }
    }

    return res;
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
    const user = await requireRole(
      ctx,
      ["procurement_officer", "project_manager", "admin"],
      args.token
    );

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

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


