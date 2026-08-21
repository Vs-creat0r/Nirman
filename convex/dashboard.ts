/**
 * @fileoverview Dashboard metrics and live pipeline counts for all roles.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";

/**
 * Get live metrics and pipeline status for the Procurement Officer dashboard.
 */
export const getProcurementDashboardMetrics = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "procurement_officer", "project_manager"],
      args.token
    );

    // 1. Material requests ready for CC
    const mrsReadyForCC = await ctx.db
      .query("material_request")
      .withIndex("by_status", (q) => q.eq("status", "ready_for_cc"))
      .collect();

    // 2. Cost Comparisons
    const allCCs = await ctx.db.query("cost_comparison").collect();
    const draftCCs = allCCs.filter((cc) => cc.status === "draft");
    const submittedCCs = allCCs.filter((cc) => cc.status === "submitted");
    const queriedCCs = allCCs.filter((cc) => cc.status === "queried");
    const approvedCCs = allCCs.filter((cc) => cc.status === "approved");

    // 3. Purchase Orders
    const allPOs = await ctx.db.query("purchase_order").collect();
    const draftPOs = allPOs.filter((po) => po.status === "draft");
    const submittedPOs = allPOs.filter((po) => po.status === "submitted");
    const approvedPOs = allPOs.filter((po) => po.status === "approved");
    const queriedPOs = allPOs.filter((po) => po.status === "queried");

    // 4. Approved CCs ready for PO generation (approved CCs without active PO)
    const activePO_CCIds = new Set(
      allPOs.filter((po) => po.status !== "rejected").map((po) => po.costComparisonId)
    );
    const ccsAwaitingPO = approvedCCs.filter((cc) => !activePO_CCIds.has(cc._id));

    // 5. Total active vendors
    const allVendors = await ctx.db.query("vendors").collect();
    const activeVendors = allVendors.filter((v) => v.isActive);

    // 6. Recent procurement activity logs
    const allLogs = await ctx.db.query("logs").collect();
    const procurementLogs = allLogs.filter(
      (l) =>
        l.documentType === "cost_comparison" ||
        l.documentType === "purchase_order" ||
        l.documentType === "vendors"
    );
    procurementLogs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const recentLogs = procurementLogs.slice(0, 5);

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
      recentActivity: enrichedRecentLogs,
    };
  },
});
