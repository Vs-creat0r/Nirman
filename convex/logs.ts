/**
 * @fileoverview Audit log query endpoints.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";

/**
 * Retrieves audit history for a specific document with actor details.
 */
export const getDocumentLogs = query({
  args: {
    documentId: v.string(),
    documentType: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Any authenticated user can view audit logs
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    const logs = args.documentType
      ? await ctx.db
          .query("logs")
          .withIndex("by_documentType_documentId", (q) =>
            q.eq("documentType", args.documentType as any).eq("documentId", args.documentId)
          )
          .collect()
      : await ctx.db
          .query("logs")
          .filter((q) => q.eq(q.field("documentId"), args.documentId))
          .collect();

    // Join actor details
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const actor = await ctx.db.get(log.actorId);
        return {
          ...log,
          actorName: actor?.name || "Unknown User",
          actorUsername: actor?.username || "unknown",
        };
      })
    );

    // Sort chronologically ascending
    return enrichedLogs.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },
});

/**
 * Retrieves audit logs by reference ID (e.g. MR-2026-0001).
 */
export const getLogsByReference = query({
  args: {
    referenceId: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    const logs = await ctx.db
      .query("logs")
      .withIndex("by_referenceId", (q) => q.eq("referenceId", args.referenceId))
      .collect();

    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const actor = await ctx.db.get(log.actorId);
        return {
          ...log,
          actorName: actor?.name || "Unknown User",
          actorUsername: actor?.username || "unknown",
        };
      })
    );

    return enrichedLogs.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },
});
