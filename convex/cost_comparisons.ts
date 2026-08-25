/**
 * @fileoverview Cost Comparison (CC) backend operations and lifecycle.
 *
 * Full pipeline:
 * Create from Approved MR (min 2 vendor quotes) → Submit for Manager Review →
 * Manager Approves with Vendor Selection Lock (→ ready_for_po) / Queries / Rejects.
 */

import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";
import { transition } from "./transition";
import { Id } from "./_generated/dataModel";

/**
 * Generates monotonic reference number: CC-YYYY-NNNN
 */
async function generateCCRefNo(ctx: MutationCtx): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `CC-${currentYear}-`;

  const allCCs = await ctx.db.query("cost_comparison").collect();
  let maxSeq = 0;

  for (const cc of allCCs) {
    if (cc.refNo && cc.refNo.startsWith(prefix)) {
      const numPart = parseInt(cc.refNo.replace(prefix, ""), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Helper to calculate and validate vendor quotes server-side.
 */
function processVendorQuotes(
  vendorQuotes: Array<{
    vendorId: Id<"vendors">;
    items: Array<{
      itemName: string;
      quantity: number;
      unit: string;
      rate: number;
      amount?: number;
    }>;
    taxRate: number;
    freight?: number;
    deliveryDays?: number;
    paymentTerms?: string;
    quoteFileId?: Id<"_storage">;
    notes?: string;
  }>
) {
  if (!vendorQuotes || vendorQuotes.length < 2) {
    throw new Error(
      "A minimum of 2 vendor quotes is required for Cost Comparison (enforced server-side)."
    );
  }

  // Ensure unique vendor IDs within the comparison
  const vendorIdSet = new Set<string>();
  for (const quote of vendorQuotes) {
    if (vendorIdSet.has(quote.vendorId)) {
      throw new Error("Each vendor quote in a comparison must be from a distinct vendor.");
    }
    vendorIdSet.add(quote.vendorId);
  }

  return vendorQuotes.map((quote) => {
    if (!quote.items || quote.items.length === 0) {
      throw new Error("Each vendor quote must include quoted items.");
    }

    let subtotal = 0;
    const computedItems = quote.items.map((it) => {
      const qty = Number(it.quantity) || 0;
      const rate = Math.max(0, Number(it.rate) || 0);
      const amount = Math.round(qty * rate * 100) / 100;
      subtotal += amount;

      return {
        itemName: it.itemName,
        quantity: qty,
        unit: it.unit,
        rate: rate,
        amount: amount,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    const taxRate = Math.max(0, Math.min(100, Number(quote.taxRate) || 0));
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const freight = Math.max(0, Number(quote.freight) || 0);
    const total = Math.round((subtotal + taxAmount + freight) * 100) / 100;

    return {
      vendorId: quote.vendorId,
      items: computedItems,
      subtotal,
      taxRate,
      taxAmount,
      freight: freight > 0 ? freight : undefined,
      total,
      deliveryDays: quote.deliveryDays ? Number(quote.deliveryDays) : undefined,
      paymentTerms: quote.paymentTerms || undefined,
      quoteFileId: quote.quoteFileId || undefined,
      notes: quote.notes?.trim() || undefined,
    };
  });
}

/**
 * Create a new Cost Comparison from an approved Material Request.
 */
export const createCC = mutation({
  args: {
    materialRequestId: v.id("material_request"),
    vendorQuotes: v.array(
      v.object({
        vendorId: v.id("vendors"),
        items: v.array(
          v.object({
            itemName: v.string(),
            quantity: v.number(),
            unit: v.string(),
            rate: v.number(),
          })
        ),
        taxRate: v.number(),
        freight: v.optional(v.number()),
        deliveryDays: v.optional(v.number()),
        paymentTerms: v.optional(v.string()),
        quoteFileId: v.optional(v.id("_storage")),
        notes: v.optional(v.string()),
      })
    ),
    submitImmediately: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(
      ctx,
      ["procurement_officer", "project_manager", "admin"],
      args.token
    );

    // Verify parent Material Request
    const mr = await ctx.db.get(args.materialRequestId);
    if (!mr) {
      throw new Error("Material Request not found.");
    }

    // Process & calculate quotes server-side
    const processedQuotes = processVendorQuotes(args.vendorQuotes);

    const refNo = await generateCCRefNo(ctx);
    const now = new Date().toISOString();
    const initialStatus = args.submitImmediately ? "submitted" : "draft";

    const ccId = await ctx.db.insert("cost_comparison", {
      refNo,
      materialRequestId: mr._id,
      projectId: mr.projectId,
      siteId: mr.siteId || undefined,
      vendorQuotes: processedQuotes,
      status: initialStatus,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    // Write audit log entry
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: initialStatus === "draft" ? "create_cc_draft" : "create_and_submit_cc",
      documentType: "cost_comparison",
      documentId: ccId,
      referenceId: refNo,
      fromStatus: undefined,
      toStatus: initialStatus,
      note: `Cost comparison created for ${mr.refNo} with ${processedQuotes.length} vendor quotes`,
      timestamp: now,
    });

    // If submitted immediately, update parent MR status to review_cc
    if (initialStatus === "submitted" && (mr.status === "ready_for_cc" || mr.status === "draft")) {
      await ctx.db.patch(mr._id, {
        status: "review_cc",
        updatedBy: user._id,
        updatedAt: now,
      });

      await ctx.db.insert("logs", {
        actorId: user._id,
        actorRole: user.role,
        action: "cc_submitted_for_mr",
        documentType: "material_request",
        documentId: mr._id,
        referenceId: mr.refNo,
        fromStatus: mr.status,
        toStatus: "review_cc",
        note: `Cost Comparison ${refNo} submitted for review`,
        timestamp: now,
      });
    }

    return {
      id: ccId,
      refNo,
      status: initialStatus,
    };
  },
});

/**
 * Submit a draft Cost Comparison for Manager review.
 */
export const submitCC = mutation({
  args: {
    id: v.id("cost_comparison"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(
      ctx,
      ["procurement_officer", "project_manager", "admin"],
      args.token
    );

    const cc = await ctx.db.get(args.id);
    if (!cc) throw new Error("Cost comparison not found.");

    const res = await transition(ctx, {
      table: "cost_comparison",
      documentId: args.id,
      from: "draft",
      to: "submitted",
      actorRole: ["procurement_officer", "project_manager", "admin"],
      token: args.token,
      action: "submit_cost_comparison",
    });

    // Transition parent MR to review_cc
    const mr = await ctx.db.get(cc.materialRequestId);
    if (mr && (mr.status === "ready_for_cc" || mr.status === "draft")) {
      await ctx.db.patch(mr._id, {
        status: "review_cc",
        updatedBy: user._id,
        updatedAt: new Date().toISOString(),
      });

      await ctx.db.insert("logs", {
        actorId: user._id,
        actorRole: user.role,
        action: "cc_submitted_for_mr",
        documentType: "material_request",
        documentId: mr._id,
        referenceId: mr.refNo,
        fromStatus: mr.status,
        toStatus: "review_cc",
        note: `Cost Comparison ${cc.refNo} submitted for review`,
        timestamp: new Date().toISOString(),
      });
    }

    return res;
  },
});

/**
 * Manager approves Cost Comparison with MANDATORY selected vendor.
 */
export const approveCC = mutation({
  args: {
    id: v.id("cost_comparison"),
    selectedVendorId: v.id("vendors"),
    selectionJustification: v.optional(v.string()),
    note: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(
      ctx,
      ["project_manager", "admin"],
      args.token
    );

    const cc = await ctx.db.get(args.id);
    if (!cc) throw new Error("Cost comparison not found.");

    // Validate that selected vendor exists in the quotes
    const selectedQuote = cc.vendorQuotes.find(
      (q) => q.vendorId === args.selectedVendorId
    );
    if (!selectedQuote) {
      throw new Error("Selected vendor must be one of the participating vendor quotes.");
    }

    // Check if selected quote is the lowest total; if not, require justification
    const lowestTotal = Math.min(...cc.vendorQuotes.map((q) => q.total));
    if (selectedQuote.total > lowestTotal && !args.selectionJustification?.trim()) {
      throw new Error(
        "A justification is required when selecting a vendor whose quote is not the lowest total."
      );
    }

    const now = new Date().toISOString();
    const vendor = await ctx.db.get(args.selectedVendorId);
    const vendorName = vendor?.name || "Selected Vendor";

    const res = await transition(ctx, {
      table: "cost_comparison",
      documentId: args.id,
      from: "submitted",
      to: "approved",
      actorRole: ["project_manager", "admin"],
      token: args.token,
      action: "approve_cost_comparison",
      note: args.note || `Approved quote by ${vendorName} (₹${selectedQuote.total.toLocaleString("en-IN")})`,
      patch: {
        selectedVendorId: args.selectedVendorId,
        selectionJustification: args.selectionJustification?.trim() || undefined,
        reviewedBy: user._id,
        reviewedAt: now,
        reviewNote: args.note || undefined,
      },
    });

    // Advance parent MR to ready_for_po
    const mr = await ctx.db.get(cc.materialRequestId);
    if (mr) {
      await ctx.db.patch(mr._id, {
        status: "ready_for_po",
        updatedBy: user._id,
        updatedAt: now,
      });

      await ctx.db.insert("logs", {
        actorId: user._id,
        actorRole: user.role,
        action: "cc_approved_mr_ready_for_po",
        documentType: "material_request",
        documentId: mr._id,
        referenceId: mr.refNo,
        fromStatus: mr.status,
        toStatus: "ready_for_po",
        note: `Cost Comparison ${cc.refNo} approved with winning vendor ${vendorName}. Ready for Purchase Order.`,
        timestamp: now,
      });
    }

    return res;
  },
});

/**
 * Manager rejects Cost Comparison with mandatory reason note.
 */
export const rejectCC = mutation({
  args: {
    id: v.id("cost_comparison"),
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
    const cc = await ctx.db.get(args.id);
    if (!cc) throw new Error("Cost comparison not found.");

    const res = await transition(ctx, {
      table: "cost_comparison",
      documentId: args.id,
      from: "submitted",
      to: "rejected",
      actorRole: ["project_manager", "admin"],
      token: args.token,
      action: "reject_cost_comparison",
      note: args.note.trim(),
      patch: {
        reviewedBy: user._id,
        reviewedAt: now,
        reviewNote: args.note.trim(),
      },
    });

    // Reset parent MR status back to ready_for_cc so procurement can re-raise quotes
    if (cc.materialRequestId) {
      const mr = await ctx.db.get(cc.materialRequestId);
      if (mr && mr.status === "review_cc") {
        await ctx.db.patch(mr._id, {
          status: "ready_for_cc",
          updatedBy: user._id,
          updatedAt: now,
        });

        await ctx.db.insert("logs", {
          actorId: user._id,
          actorRole: user.role,
          action: "cc_rejected_mr_reset",
          documentType: "material_request",
          documentId: mr._id,
          referenceId: mr.refNo,
          fromStatus: "review_cc",
          toStatus: "ready_for_cc",
          note: `Cost comparison ${cc.refNo} was rejected by ${user.name}. Material Request returned to ready_for_cc for revision. Reason: ${args.note.trim()}`,
          timestamp: now,
        });
      }
    }

    return res;
  },
});

/**
 * Manager queries Cost Comparison with feedback note.
 */
export const queryCC = mutation({
  args: {
    id: v.id("cost_comparison"),
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
      table: "cost_comparison",
      documentId: args.id,
      from: "submitted",
      to: "queried",
      actorRole: ["project_manager", "admin"],
      token: args.token,
      action: "query_cost_comparison",
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
 * Procurement Officer updates & resubmits a queried Cost Comparison.
 */
export const resubmitCC = mutation({
  args: {
    id: v.id("cost_comparison"),
    vendorQuotes: v.array(
      v.object({
        vendorId: v.id("vendors"),
        items: v.array(
          v.object({
            itemName: v.string(),
            quantity: v.number(),
            unit: v.string(),
            rate: v.number(),
          })
        ),
        taxRate: v.number(),
        freight: v.optional(v.number()),
        deliveryDays: v.optional(v.number()),
        paymentTerms: v.optional(v.string()),
        quoteFileId: v.optional(v.id("_storage")),
        notes: v.optional(v.string()),
      })
    ),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const processedQuotes = processVendorQuotes(args.vendorQuotes);

    return await transition(ctx, {
      table: "cost_comparison",
      documentId: args.id,
      from: "queried",
      to: "submitted",
      actorRole: ["procurement_officer", "project_manager", "admin"],
      token: args.token,
      action: "resubmit_cost_comparison",
      patch: {
        vendorQuotes: processedQuotes,
      },
    });
  },
});

/**
 * List Cost Comparisons with status filters and enriched references.
 */
export const listCCs = query({
  args: {
    status: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    materialRequestId: v.optional(v.id("material_request")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    let ccs = await ctx.db.query("cost_comparison").collect();

    if (args.status) {
      ccs = ccs.filter((cc) => cc.status === args.status);
    }

    if (args.projectId) {
      ccs = ccs.filter((cc) => cc.projectId === args.projectId);
    }

    if (args.materialRequestId) {
      ccs = ccs.filter((cc) => cc.materialRequestId === args.materialRequestId);
    }

    // Sort newest first
    ccs.sort((a, b) => b._creationTime - a._creationTime);

    // Enrich with Project, MR, and Vendor data
    const enriched = await Promise.all(
      ccs.map(async (cc) => {
        const project = await ctx.db.get(cc.projectId);
        const mr = await ctx.db.get(cc.materialRequestId);
        const creator = (await ctx.db.get(cc.createdBy)) as { name?: string } | null;

        // Fetch vendor names for the quotes
        const vendorNames = await Promise.all(
          cc.vendorQuotes.map(async (q) => {
            const v = await ctx.db.get(q.vendorId);
            return v?.name || "Unknown Vendor";
          })
        );

        let selectedVendorName: string | null = null;
        if (cc.selectedVendorId) {
          const sv = await ctx.db.get(cc.selectedVendorId);
          selectedVendorName = sv?.name || null;
        }

        const totals = cc.vendorQuotes.map((q) => q.total);
        const minTotal = Math.min(...totals);
        const maxTotal = Math.max(...totals);

        return {
          ...cc,
          projectName: project?.name || "Unknown Project",
          projectCode: project?.code || "",
          materialRequestRefNo: mr?.refNo || "MR",
          creatorName: creator?.name || "Unknown User",
          quoteCount: cc.vendorQuotes.length,
          vendorNames,
          selectedVendorName,
          minTotal,
          maxTotal,
        };
      })
    );

    return enriched;
  },
});

/**
 * List Material Requests that are ready for Cost Comparison.
 */
export const listApprovedMRsForCC = query({
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

    let mrs = await ctx.db
      .query("material_request")
      .withIndex("by_status", (q) => q.eq("status", "ready_for_cc"))
      .collect();

    if (args.projectId) {
      mrs = mrs.filter((mr) => mr.projectId === args.projectId);
    }

    mrs.sort((a, b) => b._creationTime - a._creationTime);

    const enriched = await Promise.all(
      mrs.map(async (mr) => {
        const project = await ctx.db.get(mr.projectId);
        const site = mr.siteId ? await ctx.db.get(mr.siteId) : null;
        const creator = (await ctx.db.get(mr.createdBy)) as { name?: string } | null;

        return {
          ...mr,
          projectName: project?.name || "Unknown Project",
          projectCode: project?.code || "",
          siteName: site ? `${site.name} (${site.code})` : "Main Site",
          creatorName: creator?.name || "Unknown User",
          itemCount: mr.items.length,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single Cost Comparison with all vendor details, MR context, and logs.
 */
export const getCC = query({
  args: {
    id: v.id("cost_comparison"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    const cc = await ctx.db.get(args.id);
    if (!cc) return null;

    const project = await ctx.db.get(cc.projectId);
    const site = cc.siteId ? await ctx.db.get(cc.siteId) : null;
    const mr = await ctx.db.get(cc.materialRequestId);
    const creator = (await ctx.db.get(cc.createdBy)) as { name?: string } | null;
    const reviewer = cc.reviewedBy
      ? ((await ctx.db.get(cc.reviewedBy)) as { name?: string } | null)
      : null;

    // Enrich vendor quotes with complete vendor profiles
    const enrichedQuotes = await Promise.all(
      cc.vendorQuotes.map(async (q) => {
        const v = await ctx.db.get(q.vendorId);
        return {
          ...q,
          vendorName: v?.name || "Unknown Vendor",
          vendorPhone: v?.phone || "",
          vendorEmail: v?.email || "",
          vendorGstNo: v?.gstNo || "",
          vendorCategory: v?.category || "",
        };
      })
    );

    // Audit trail logs
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

    let selectedVendorName: string | null = null;
    if (cc.selectedVendorId) {
      const sv = await ctx.db.get(cc.selectedVendorId);
      selectedVendorName = sv?.name || null;
    }

    return {
      ...cc,
      projectName: project?.name || "Unknown Project",
      projectCode: project?.code || "",
      siteName: site ? `${site.name} (${site.code})` : "Main Site",
      materialRequest: mr
        ? {
            _id: mr._id,
            refNo: mr.refNo,
            status: mr.status,
            priority: mr.priority,
            requiredBy: mr.requiredBy,
            items: mr.items,
          }
        : null,
      creatorName: creator?.name || "Unknown User",
      reviewerName: reviewer?.name || null,
      selectedVendorName,
      vendorQuotes: enrichedQuotes,
      logs: enrichedLogs,
    };
  },
});
