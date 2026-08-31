/**
 * @fileoverview Audit log query endpoints.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./rbac";

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
    const user = await getCurrentUser(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

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
    const user = await getCurrentUser(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

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
    const user = await getCurrentUser(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

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
