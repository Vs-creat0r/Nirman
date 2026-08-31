/**
 * @fileoverview Audit log query endpoints with caller scoping.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { resolveCallerScope, assertDocumentAccess, canAccessDocument } from "./scoping";

/**
 * Retrieves audit history for a specific document with actor details.
 * Scoped to caller's project/site access.
 */
export const getDocumentLogs = query({
  args: {
    documentId: v.string(),
    documentType: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    // If caller is not admin, verify they have permission to access the parent document
    if (!scope.isAdmin && args.documentType) {
      if (
        args.documentType === "material_request" ||
        args.documentType === "cost_comparison" ||
        args.documentType === "purchase_order" ||
        args.documentType === "delivery_challan" ||
        args.documentType === "grn"
      ) {
        const doc = await ctx.db.get(args.documentId as any);
        if (doc) {
          assertDocumentAccess(scope, doc as any);
        }
      } else if (args.documentType === "projects") {
        assertDocumentAccess(scope, { projectId: args.documentId as any });
      }
    }

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
    const scope = await resolveCallerScope(ctx, args.token);

    const logs = await ctx.db
      .query("logs")
      .withIndex("by_referenceId", (q) => q.eq("referenceId", args.referenceId))
      .collect();

    // Non-admins: if log has documentId, verify access
    if (!scope.isAdmin && logs.length > 0) {
      const firstLog = logs[0];
      if (
        firstLog.documentType === "material_request" ||
        firstLog.documentType === "cost_comparison" ||
        firstLog.documentType === "purchase_order" ||
        firstLog.documentType === "delivery_challan" ||
        firstLog.documentType === "grn"
      ) {
        const doc = await ctx.db.get(firstLog.documentId as any);
        if (doc) {
          assertDocumentAccess(scope, doc as any, args.referenceId);
        }
      }
    }

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

/**
 * Retrieves all system audit logs with multi-field filtering and pagination.
 */
export const listAllLogs = query({
  args: {
    documentType: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    actorRole: v.optional(v.string()),
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    let allLogs = await ctx.db.query("logs").collect();

    // Filter by documentType
    if (args.documentType && args.documentType !== "all") {
      allLogs = allLogs.filter((l) => l.documentType === args.documentType);
    }

    // Filter by actorRole
    if (args.actorRole && args.actorRole !== "all") {
      allLogs = allLogs.filter((l) => l.actorRole === args.actorRole);
    }

    // Filter by referenceId (partial or full match)
    if (args.referenceId && args.referenceId.trim()) {
      const q = args.referenceId.trim().toLowerCase();
      allLogs = allLogs.filter((l) => l.referenceId.toLowerCase().includes(q));
    }

    // Sort newest first
    allLogs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply limit if specified
    const limit = args.limit || 200;
    const sliced = allLogs.slice(0, limit);

    // Join actor details
    const enrichedLogs = await Promise.all(
      sliced.map(async (log) => {
        const actor = await ctx.db.get(log.actorId);
        return {
          ...log,
          actorName: actor?.name || "Unknown User",
          actorUsername: actor?.username || "unknown",
        };
      })
    );

    return enrichedLogs;
  },
});
