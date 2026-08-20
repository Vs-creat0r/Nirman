/**
 * @fileoverview Material Request backend operations and lifecycle.
 *
 * Full pipeline:
 * Create (draft) → Submit (pending) → Manager Review (Approve/Reject/Query) → Resubmit
 */

import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";
import { transition } from "./transition";
import { Id } from "./_generated/dataModel";

/**
 * Generates monotonic reference number: MR-YYYY-NNNN
 */
async function generateMRRefNo(ctx: MutationCtx): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `MR-${currentYear}-`;

  const allMRs = await ctx.db.query("material_request").collect();
  let maxSeq = 0;

  for (const mr of allMRs) {
    if (mr.refNo && mr.refNo.startsWith(prefix)) {
      const numPart = parseInt(mr.refNo.replace(prefix, ""), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Create a new Material Request.
 */
export const createMR = mutation({
  args: {
    projectId: v.id("projects"),
    siteId: v.optional(v.id("sites")),
    items: v.array(
      v.object({
        itemName: v.string(),
        description: v.optional(v.string()),
        quantity: v.number(),
        unit: v.string(),
        projectItemId: v.optional(v.id("project_items")),
      })
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("normal"),
      v.literal("high"),
      v.literal("urgent")
    ),
    requiredBy: v.optional(v.string()),
    notes: v.optional(v.string()),
    submitImmediately: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(
      ctx,
      ["site_supervisor", "project_manager", "admin"],
      args.token
    );

    if (args.items.length === 0) {
      throw new Error("A material request must have at least one line item.");
    }

    const refNo = await generateMRRefNo(ctx);
    const now = new Date().toISOString();

    // Auto-approve if Project Manager or Admin raises the request directly
    const initialStatus =
      user.role === "project_manager" || user.role === "admin"
        ? "ready_for_cc"
        : args.submitImmediately
        ? "pending"
        : "draft";

    const mrId = await ctx.db.insert("material_request", {
      refNo,
      projectId: args.projectId,
      siteId: args.siteId,
      items: args.items,
      priority: args.priority,
      requiredBy: args.requiredBy,
      notes: args.notes,
      status: initialStatus,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    // Write audit log entry for creation
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: initialStatus === "draft" ? "create_draft" : "create_and_submit",
      documentType: "material_request",
      documentId: mrId,
      referenceId: refNo,
      fromStatus: undefined,
      toStatus: initialStatus,
      note:
        initialStatus === "ready_for_cc"
          ? "Auto-approved (raised by manager/admin)"
          : undefined,
      timestamp: now,
    });

    return {
      id: mrId,
      refNo,
      status: initialStatus,
    };
  },
});

/**
 * Submit a draft Material Request for manager review.
 */
export const submitMR = mutation({
  args: {
    id: v.id("material_request"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await transition(ctx, {
      table: "material_request",
      documentId: args.id,
      from: "draft",
      to: "pending",
      actorRole: ["site_supervisor", "project_manager", "admin"],
      token: args.token,
      action: "submit_material_request",
    });
  },
});

/**
 * Manager approves Material Request → moves to ready_for_cc.
 */
export const approveMR = mutation({
  args: {
    id: v.id("material_request"),
    note: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await transition(ctx, {
      table: "material_request",
      documentId: args.id,
      from: "pending",
      to: "ready_for_cc",
      actorRole: ["project_manager", "admin"],
      token: args.token,
      action: "approve_material_request",
      note: args.note || "Approved",
    });
  },
});

/**
 * Manager rejects Material Request with mandatory reason note.
 */
export const rejectMR = mutation({
  args: {
    id: v.id("material_request"),
    note: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.note.trim()) {
      throw new Error("A rejection reason note is required.");
    }

    return await transition(ctx, {
      table: "material_request",
      documentId: args.id,
      from: "pending",
      to: "rejected",
      actorRole: ["project_manager", "admin"],
      token: args.token,
      action: "reject_material_request",
      note: args.note.trim(),
    });
  },
});

/**
 * Manager queries Material Request with required feedback note.
 */
export const queryMR = mutation({
  args: {
    id: v.id("material_request"),
    note: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.note.trim()) {
      throw new Error("A query note explaining the feedback is required.");
    }

    return await transition(ctx, {
      table: "material_request",
      documentId: args.id,
      from: "pending",
      to: "queried",
      actorRole: ["project_manager", "admin"],
      token: args.token,
      action: "query_material_request",
      note: args.note.trim(),
    });
  },
});

/**
 * Supervisor updates & resubmits a queried Material Request.
 */
export const resubmitMR = mutation({
  args: {
    id: v.id("material_request"),
    projectId: v.optional(v.id("projects")),
    siteId: v.optional(v.id("sites")),
    items: v.optional(
      v.array(
        v.object({
          itemName: v.string(),
          description: v.optional(v.string()),
          quantity: v.number(),
          unit: v.string(),
          projectItemId: v.optional(v.id("project_items")),
        })
      )
    ),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("normal"),
        v.literal("high"),
        v.literal("urgent")
      )
    ),
    requiredBy: v.optional(v.string()),
    notes: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patchData: Record<string, unknown> = {};
    if (args.projectId) patchData.projectId = args.projectId;
    if (args.siteId !== undefined) patchData.siteId = args.siteId;
    if (args.items) patchData.items = args.items;
    if (args.priority) patchData.priority = args.priority;
    if (args.requiredBy !== undefined) patchData.requiredBy = args.requiredBy;
    if (args.notes !== undefined) patchData.notes = args.notes;

    return await transition(ctx, {
      table: "material_request",
      documentId: args.id,
      from: "queried",
      to: "pending",
      actorRole: ["site_supervisor", "project_manager", "admin"],
      token: args.token,
      action: "resubmit_material_request",
      patch: patchData,
    });
  },
});

/**
 * List Material Requests with role-scoping and joined relations.
 */
export const listMRs = query({
  args: {
    status: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    let mrs = await ctx.db.query("material_request").collect();

    // Role-based scoping:
    if (user.role === "site_supervisor") {
      // Supervisor sees requests created by themselves
      mrs = mrs.filter((mr) => mr.createdBy === user._id);
    }

    // Optional status filter
    if (args.status) {
      mrs = mrs.filter((mr) => mr.status === args.status);
    }

    // Optional project filter
    if (args.projectId) {
      mrs = mrs.filter((mr) => mr.projectId === args.projectId);
    }

    // Sort newest first
    mrs.sort((a, b) => b._creationTime - a._creationTime);

    // Enrich with Project, Site, and User details
    const enriched = await Promise.all(
      mrs.map(async (mr) => {
        const project = await ctx.db.get(mr.projectId);
        const site = mr.siteId ? await ctx.db.get(mr.siteId) : null;
        const creator = (await ctx.db.get(mr.createdBy)) as { name?: string } | null;

        return {
          ...mr,
          projectName: project?.name || "Unknown Project",
          projectCode: project?.code || "",
          siteName: site ? `${site.name} (${site.code})` : "Main / Primary Site",
          creatorName: creator?.name || "Unknown User",
          itemCount: mr.items.length,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single Material Request with enriched data and logs.
 */
export const getMR = query({
  args: {
    id: v.id("material_request"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    const mr = await ctx.db.get(args.id);
    if (!mr) return null;

    const project = await ctx.db.get(mr.projectId);
    const site = mr.siteId ? await ctx.db.get(mr.siteId) : null;
    const creator = (await ctx.db.get(mr.createdBy)) as { name?: string } | null;

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

    // Latest review log note if queried/rejected/approved
    const latestReviewLog = enrichedLogs
      .slice()
      .reverse()
      .find((l) => l.note && (l.toStatus === "queried" || l.toStatus === "rejected" || l.toStatus === "ready_for_cc"));

    return {
      ...mr,
      projectName: project?.name || "Unknown Project",
      projectCode: project?.code || "",
      siteName: site ? `${site.name} (${site.code})` : "Main / Primary Site",
      creatorName: creator?.name || "Unknown User",
      reviewerName: latestReviewLog?.actorName || null,
      reviewNote: latestReviewLog?.note || null,
      logs: enrichedLogs,
    };
  },
});
