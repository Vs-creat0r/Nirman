/**
 * @fileoverview Dashboard metrics and live pipeline counts for all roles.
 * Scoped to caller's authorized projects and sites.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { resolveCallerScope, filterScopedList } from "./scoping";

/**
 * Get live metrics and pipeline status for the Procurement Officer dashboard.
 */
export const getProcurementDashboardMetrics = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    // 1. Material requests ready for CC (exclude MRs that already have an existing active/draft CC)
    const rawMRsReadyForCC = await ctx.db
      .query("material_request")
      .withIndex("by_status", (q) => q.eq("status", "ready_for_cc"))
      .collect();

    const rawAllCCs = await ctx.db.query("cost_comparison").collect();
    const rawAllPOs = await ctx.db.query("purchase_order").collect();

    // Enforce scoping
    const allCCs = filterScopedList(scope, rawAllCCs);
    const allPOs = filterScopedList(scope, rawAllPOs);
    const scopedMRsReadyForCC = filterScopedList(scope, rawMRsReadyForCC);

    const ccsByMR = new Set(
      allCCs
        .filter((cc) => cc.status !== "rejected")
        .map((cc) => String(cc.materialRequestId))
        .filter(Boolean)
    );

    const mrsReadyForCC = scopedMRsReadyForCC.filter((mr) => !ccsByMR.has(String(mr._id)));

    // Enrich MRs ready for CC
    const enrichedMRsReadyForCC = await Promise.all(
      mrsReadyForCC.slice(0, 5).map(async (mr) => {
        const project = mr.projectId ? await ctx.db.get(mr.projectId) : null;
        const site = mr.siteId ? await ctx.db.get(mr.siteId) : null;
        return {
          _id: mr._id,
          refNo: mr.refNo,
          projectName: project?.name || "Project",
          siteName: site?.name || "Site",
          itemCount: mr.items?.length || 0,
          requiredBy: mr.requiredBy,
          createdAt: mr._creationTime,
        };
      })
    );

    // 2. Cost Comparisons
    const draftCCs = allCCs.filter((cc) => cc.status === "draft");
    const submittedCCs = allCCs.filter((cc) => cc.status === "submitted");
    const queriedCCs = allCCs.filter((cc) => cc.status === "queried");
    const approvedCCs = allCCs.filter((cc) => cc.status === "approved");

    // 3. Purchase Orders
    const draftPOs = allPOs.filter((po) => po.status === "draft");
    const submittedPOs = allPOs.filter((po) => po.status === "submitted");
    const approvedPOs = allPOs.filter((po) => po.status === "approved");
    const queriedPOs = allPOs.filter((po) => po.status === "queried");

    // 4. Approved CCs ready for PO generation (approved CCs without active PO)
    const activePO_CCIds = new Set(
      allPOs.filter((po) => po.status !== "rejected").map((po) => po.costComparisonId)
    );
    const ccsAwaitingPO = approvedCCs.filter((cc) => !activePO_CCIds.has(cc._id));

    // Enrich CCs awaiting PO
    const enrichedCCsAwaitingPO = await Promise.all(
      ccsAwaitingPO.slice(0, 5).map(async (cc) => {
        const winningVendor = cc.selectedVendorId ? await ctx.db.get(cc.selectedVendorId) : null;
        const winningQuote = cc.vendorQuotes?.find((q) => q.vendorId === cc.selectedVendorId);
        return {
          _id: cc._id,
          refNo: cc.refNo,
          winningVendorName: winningVendor?.name || "Selected Vendor",
          winningAmount: winningQuote?.total || 0,
          approvedAt: cc.reviewedAt || cc.updatedAt,
        };
      })
    );

    // 5. Total active vendors
    const allVendors = await ctx.db.query("vendors").collect();
    const activeVendors = allVendors.filter((v) => v.isActive);

    // 6. Financial Aggregates
    const totalApprovedPOValue = Math.round(
      approvedPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0) * 100
    ) / 100;

    const totalPendingPOValue = Math.round(
      submittedPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0) * 100
    ) / 100;

    // Estimate savings: For each approved CC, diff between highest quote and winning quote
    let estimatedSavings = 0;
    for (const cc of approvedCCs) {
      if (cc.vendorQuotes && cc.vendorQuotes.length > 1 && cc.selectedVendorId) {
        const quoteTotals = cc.vendorQuotes.map((q) => q.total || 0).filter((t) => t > 0);
        const winningQuote = cc.vendorQuotes.find((q) => q.vendorId === cc.selectedVendorId);
        if (quoteTotals.length > 1 && winningQuote?.total) {
          const maxQuote = Math.max(...quoteTotals);
          if (maxQuote > winningQuote.total) {
            estimatedSavings += maxQuote - winningQuote.total;
          }
        }
      }
    }

    // 7. Recent procurement activity logs
    const rawLogs = await ctx.db.query("logs").collect();
    const procurementLogs = rawLogs.filter(
      (l) =>
        l.documentType === "cost_comparison" ||
        l.documentType === "purchase_order" ||
        l.documentType === "vendors"
    );
    procurementLogs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const recentLogs = procurementLogs.slice(0, 6);

    const enrichedRecentLogs = await Promise.all(
      recentLogs.map(async (log) => {
        const actor = (await ctx.db.get(log.actorId)) as { name?: string } | null;
        return {
          ...log,
          actorName: actor?.name || "System",
        };
      })
    );

    return {
      // Pipeline stage counts
      mrsReadyForCCCount: mrsReadyForCC.length,
      draftCCCount: draftCCs.length,
      submittedCCCount: submittedCCs.length,
      queriedCCCount: queriedCCs.length,
      ccsAwaitingPOCount: ccsAwaitingPO.length,
      draftPOCount: draftPOs.length,
      submittedPOCount: submittedPOs.length,
      approvedPOCount: approvedPOs.length,
      queriedPOCount: queriedPOs.length,
      activeVendorCount: activeVendors.length,
      totalPOCount: allPOs.length,

      // Financials
      totalApprovedPOValue,
      totalPendingPOValue,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,

      // Actionable Items for Quick-Inbox
      mrsReadyForCC: enrichedMRsReadyForCC,
      ccsAwaitingPO: enrichedCCsAwaitingPO,
      queriedCCs: queriedCCs.map((cc) => ({
        _id: cc._id,
        refNo: cc.refNo,
        reviewNote: cc.reviewNote,
        updatedAt: cc.updatedAt,
      })),
      queriedPOs: queriedPOs.map((po) => ({
        _id: po._id,
        refNo: po.refNo,
        reviewNote: po.reviewNote,
        updatedAt: po.updatedAt,
      })),

      // Live activity feed
      recentActivity: enrichedRecentLogs,
    };
  },
});
