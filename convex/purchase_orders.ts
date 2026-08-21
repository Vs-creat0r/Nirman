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
 * Create a new Purchase Order auto-filled from an approved Cost Comparison.
 * Zero manual re-entry: snapshots winning vendor's line items and commercial terms.
 */
export const createPOFromCC = mutation({
  args: {
    costComparisonId: v.id("cost_comparison"),
    expectedDelivery: v.optional(v.string()),
    validUntil: v.optional(v.string()),
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

    // Snapshot line items with amounts
    const snapshottedLineItems = winningQuote.items.map((item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const hsnSacCode = mrItemMap.get(item.itemName.toLowerCase().trim()) || undefined;
      return {
        itemName: item.itemName,
        quantity: qty,
        unit: item.unit,
        rate: rate,
        amount: Math.round(qty * rate * 100) / 100,
        hsnSacCode: hsnSacCode,
      };
    });

    const subtotal = Math.round(
      snapshottedLineItems.reduce((acc, cur) => acc + cur.amount, 0) * 100
    ) / 100;
    const taxRate = Number(winningQuote.taxRate) || 18;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const freight = Math.max(0, Number(winningQuote.freight) || 0);
    const totalAmount = Math.round((subtotal + taxAmount + freight) * 100) / 100;

    const paymentTermsMap: Record<string, "advance" | "on_delivery" | "7_days" | "15_days" | "30_days" | "45_days"> = {
      advance: "advance",
      on_delivery: "on_delivery",
      "7_days": "7_days",
      "15_days": "15_days",
      "30_days": "30_days",
      "45_days": "45_days",
    };
    const paymentTerms = paymentTermsMap[winningQuote.paymentTerms || "30_days"] || "30_days";

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
      note: `Purchase Order generated from ${cc.refNo} for ${vendorName} (Total: ₹${totalAmount.toLocaleString("en-IN")})`,
      timestamp: now,
    });

    // Update parent Material Request status
    if (cc.materialRequestId) {
      const mr = await ctx.db.get(cc.materialRequestId);
      if (mr) {
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

    // Update parent Material Request to pending_po (awaiting vendor delivery/DC)
    if (po.materialRequestId) {
      const mr = await ctx.db.get(po.materialRequestId);
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
    return await transition(ctx, {
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
      })
    ),
    taxRate: v.number(),
    freight: v.optional(v.number()),
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
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
      };
    });

    const subtotal = Math.round(
      calculatedItems.reduce((acc, cur) => acc + cur.amount, 0) * 100
    ) / 100;
    const taxRate = Number(args.taxRate) || 18;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const freight = Math.max(0, Number(args.freight) || 0);
    const totalAmount = Math.round((subtotal + taxAmount + freight) * 100) / 100;

    return await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      from: "queried",
      to: "submitted",
      actorRole: ["procurement_officer", "project_manager", "admin"],
      token: args.token,
      action: "resubmit_purchase_order",
      patch: {
        lineItems: calculatedItems,
        subtotal,
        taxRate,
        taxAmount,
        freight: freight > 0 ? freight : undefined,
        totalAmount,
        paymentTerms: args.paymentTerms,
        expectedDelivery: args.expectedDelivery || undefined,
        validUntil: args.validUntil || undefined,
        termsAndConditions: args.termsAndConditions || undefined,
      },
    });
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

    // Check which approved CCs already have an active PO
    const allPOs = await ctx.db.query("purchase_order").collect();
    const ccIdsWithPO = new Set(
      allPOs.filter((po) => po.status !== "rejected").map((po) => po.costComparisonId)
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
          materialRequestRefNo: mr?.refNo || "MR",
          selectedVendorName: vendor?.name || "Selected Vendor",
          winningTotal: winningQuote?.total || 0,
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

