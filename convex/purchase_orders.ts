/**
 * @fileoverview Purchase Order (PO) backend operations and queries.
 *
 * Full pipeline:
 * Auto-generate from Approved CC (winning vendor & line items snapshotted) →
 * Submit for Review (MR → review_po) →
 * List and fetch PO details with full joins and audit logs.
 */

import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { requirePermission } from "./permissions";
import { getCurrentUser } from "./rbac";
import { transition } from "./transition";
import { adjustCommittedQty } from "./purchase_order_commitments";
import { resolveCallerScope, filterScopedList, assertDocumentAccess, queryScopedByIndex } from "./scoping";

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
    paymentTerms: v.optional(
      v.union(v.literal("advance"), v.literal("on_delivery"), v.literal("7_days"), v.literal("15_days"), v.literal("30_days"), v.literal("45_days"))
    ),
    placeOfSupplyStateCode: v.optional(v.string()),
    siteContactPerson: v.optional(v.string()),
    siteContactPhone: v.optional(v.string()),
    unloadingScope: v.optional(v.union(v.literal("buyer_scope"), v.literal("vendor_scope"))),
    freightTerms: v.optional(
      v.union(v.literal("inclusive_in_rate"), v.literal("extra_at_actuals"), v.literal("fixed_freight"), v.literal("to_pay_by_site"))
    ),
    procurementNotes: v.optional(v.string()),
    termsAndConditions: v.optional(v.string()),
    tcTemplateId: v.optional(v.id("tc_templates")),
    submitImmediately: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "purchase_orders:create", args.token);

    const cc = await ctx.db.get(args.costComparisonId);
    if (!cc) throw new Error("Cost comparison not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, cc, cc.refNo);
    if (cc.status !== "approved") {
      throw new Error("Cost comparison must be approved by the Project Manager before generating a Purchase Order.");
    }
    if (!cc.selectedVendorId) throw new Error("Cost comparison has no selected winning vendor.");

    // Find the winning quote
    const winningQuote = cc.vendorQuotes.find((q) => q.vendorId === cc.selectedVendorId);
    if (!winningQuote) throw new Error("Winning vendor quote could not be located in the cost comparison.");

    // Duplicate PO guard [FIX-I1]
    const existingPOs = await ctx.db
      .query("purchase_order")
      .withIndex("by_costComparisonId", (q) => q.eq("costComparisonId", cc._id))
      .collect();

    const activePO = existingPOs.find((p) => ["draft", "submitted", "queried", "approved"].includes(p.status));
    if (activePO) throw new Error(`A Purchase Order (${activePO.refNo}) already exists for this Cost Comparison.`);

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
    const taxRate =
      winningQuote.taxRate !== undefined && !isNaN(Number(winningQuote.taxRate))
        ? Math.max(0, Math.min(100, Number(winningQuote.taxRate)))
        : 18;
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
      const mr = cc.materialRequestId ? await ctx.db.get(cc.materialRequestId) : null;
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
      await transition(ctx, {
        table: "material_request",
        documentId: mr._id,
        from: ["ready_for_po", "approved_for_rfq", "rfq_in_progress", "review_cc", "draft"],
        to: mrToStatus,
        action: initialStatus === "approved" ? "material_requests:advance_on_po_approval" : "material_requests:review_on_po",
        token: args.token,
        note: `Purchase Order ${refNo} generated (${initialStatus}) with ${vendorName}`,
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
    await requirePermission(
      ctx,
      "purchase_orders:submit",
      args.token
    );

    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase Order not found.");

    const res = await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      from: "draft",
      to: "submitted",
      action: "purchase_orders:submit",
      token: args.token,
    });

    // Update parent MR to review_po
    if (po.materialRequestId) {
      const mr = await ctx.db.get(po.materialRequestId);
      if (mr && (mr.status === "ready_for_po" || mr.status === "draft")) {
        await transition(ctx, {
          table: "material_request",
          documentId: mr._id,
          from: ["ready_for_po", "draft"],
          to: "review_po",
          action: "material_requests:review_on_po",
          token: args.token,
          note: `Purchase Order ${po.refNo} submitted for manager approval`,
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
    const scope = await resolveCallerScope(ctx, args.token);

    // Indexed range query — no full PO table scan
    let pos = await queryScopedByIndex(
      ctx,
      "purchase_order",
      scope,
      { statusFilter: args.status }
    );

    if (args.projectId) {
      pos = pos.filter((po) => String(po.projectId) === String(args.projectId));
    }

    if (args.vendorId) {
      pos = pos.filter((po) => String(po.vendorId) === String(args.vendorId));
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
    const scope = await resolveCallerScope(ctx, args.token);

    let allCcs = await ctx.db
      .query("cost_comparison")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    // Enforce scoping
    let ccs = filterScopedList(scope, allCcs);

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
          winningTaxRate:
            winningQuote?.taxRate !== undefined && !isNaN(Number(winningQuote.taxRate))
              ? Number(winningQuote.taxRate)
              : 18,
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
    const scope = await resolveCallerScope(ctx, args.token);

    const po = await ctx.db.get(args.id);
    if (!po) return null;

    // Assert document scope access
    assertDocumentAccess(scope, po, po.refNo);

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
