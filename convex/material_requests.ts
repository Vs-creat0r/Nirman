/**
 * @fileoverview Material Request backend operations and lifecycle.
 *
 * Full pipeline:
 * Create (draft) → Submit (pending) → Manager Review (Approve/Reject/Query) → Resubmit
 */

import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { requirePermission } from "./permissions";
import { getCurrentUser } from "./rbac";
import { transition } from "./transition";
import { resolveCallerScope, filterScopedList, assertDocumentAccess, queryScopedByIndex } from "./scoping";

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
        hsnSacCode: v.optional(v.string()),
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
    const user = await requirePermission(
      ctx,
      "material_requests:create",
      args.token
    );

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(
      scope,
      { projectId: args.projectId, siteId: args.siteId },
      "New Material Request"
    );

    if (args.items.length === 0) {
      throw new Error("A material request must have at least one line item.");
    }

    for (let i = 0; i < args.items.length; i++) {
      const it = args.items[i];
      if (!it.itemName || !it.itemName.trim()) {
        throw new Error(`Item #${i + 1} must have a valid item name.`);
      }
      if (typeof it.quantity !== "number" || isNaN(it.quantity) || it.quantity <= 0) {
        throw new Error(`Quantity for item "${it.itemName}" must be greater than zero.`);
      }
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

    const sanitizedItems = args.items.map((it) => ({
      itemName: it.itemName.trim(),
      description: it.description?.trim() || undefined,
      quantity: it.quantity,
      unit: it.unit,
      hsnSacCode: it.hsnSacCode?.trim() || undefined,
      projectItemId: it.projectItemId || undefined,
    }));

    const mrId = await ctx.db.insert("material_request", {
      refNo,
      projectId: args.projectId,
      siteId: args.siteId,
      items: sanitizedItems,
      priority: args.priority,
      requiredBy: args.requiredBy,
      notes: args.notes?.trim() || undefined,
      status: initialStatus,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: initialStatus === "draft" ? "create_draft" : "create_and_submit",
      documentType: "material_request",
      documentId: mrId,
      referenceId: refNo,
      fromStatus: undefined,
      toStatus: initialStatus,
      note: initialStatus === "ready_for_cc" ? "Auto-approved (raised by manager/admin)" : undefined,
      timestamp: now,
    });

    return { id: mrId, refNo, status: initialStatus };
  },
});

export const submitMR = mutation({
  args: { id: v.id("material_request"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await transition(ctx, {
      table: "material_request",
      documentId: args.id,
      from: "draft",
      to: "pending",
      action: "material_requests:submit",
      token: args.token,
    });
  },
});

export const approveMR = mutation({
  args: { id: v.id("material_request"), note: v.optional(v.string()), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await transition(ctx, {
      table: "material_request",
      documentId: args.id,
      from: "pending",
      to: "ready_for_cc",
      action: "material_requests:approve",
      token: args.token,
      note: args.note || "Approved",
    });
  },
});

export const rejectMR = mutation({
  args: { id: v.id("material_request"), note: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.note.trim()) throw new Error("A rejection reason note is required.");
    return await transition(ctx, {
      table: "material_request",
      documentId: args.id,
      from: "pending",
      to: "rejected",
      action: "material_requests:reject",
      token: args.token,
      note: args.note.trim(),
    });
  },
});

export const queryMR = mutation({
  args: { id: v.id("material_request"), note: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.note.trim()) throw new Error("A query note explaining the feedback is required.");
    return await transition(ctx, {
      table: "material_request",
      documentId: args.id,
      from: "pending",
      to: "queried",
      action: "material_requests:query",
      token: args.token,
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
          hsnSacCode: v.optional(v.string()),
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
    if (args.items) {
      if (args.items.length === 0) {
        throw new Error("A material request must have at least one line item.");
      }
      for (let i = 0; i < args.items.length; i++) {
        const it = args.items[i];
        if (!it.itemName || !it.itemName.trim()) {
          throw new Error(`Item #${i + 1} must have a valid item name.`);
        }
        if (typeof it.quantity !== "number" || isNaN(it.quantity) || it.quantity <= 0) {
          throw new Error(`Quantity for item "${it.itemName}" must be greater than zero.`);
        }
      }
      patchData.items = args.items.map((it) => ({
        itemName: it.itemName.trim(),
        description: it.description?.trim() || undefined,
        quantity: it.quantity,
        unit: it.unit,
        hsnSacCode: it.hsnSacCode?.trim() || undefined,
        projectItemId: it.projectItemId || undefined,
      }));
    }
    if (args.priority) patchData.priority = args.priority;
    if (args.requiredBy !== undefined) patchData.requiredBy = args.requiredBy;
    if (args.notes !== undefined) patchData.notes = args.notes?.trim() || undefined;

    const mr = await ctx.db.get(args.id);
    if (!mr) throw new Error("Material Request not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, mr, mr.refNo);

    return await transition(ctx, {
      table: "material_request",
      documentId: args.id,
      from: ["draft", "queried"],
      to: "pending",
      action: "material_requests:resubmit",
      token: args.token,
      patch: patchData,
    });
  },
});

/**
 * Delete / Discard a draft Material Request.
 * Irreversible hard delete permitted ONLY for unsubmitted drafts with no child records.
 */
export const deleteMR = mutation({
  args: {
    id: v.id("material_request"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "material_requests:delete",
      args.token
    );

    const mr = await ctx.db.get(args.id);
    if (!mr) throw new Error("Material Request not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, mr, mr.refNo);

    if (mr.status !== "draft") {
      throw new Error(
        `Only draft Material Requests can be discarded. Current status: "${mr.status}".`
      );
    }

    // Role check: supervisor can only delete their own draft
    if (user.role === "site_supervisor" && mr.createdBy !== user._id) {
      throw new Error("You can only discard drafts created by yourself.");
    }

    // Check if any cost comparison exists for this MR
    const existingCC = await ctx.db
      .query("cost_comparison")
      .withIndex("by_materialRequestId", (q) => q.eq("materialRequestId", args.id))
      .first();

    if (existingCC) {
      throw new Error(
        "Cannot discard this Material Request because a Cost Comparison has already been started for it."
      );
    }

    const now = new Date().toISOString();

    // Log the discard action before removing the document
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "discard_draft",
      documentType: "material_request",
      documentId: args.id,
      referenceId: mr.refNo,
      fromStatus: "draft",
      toStatus: undefined,
      note: `Draft Material Request ${mr.refNo} was discarded by ${user.name}.`,
      timestamp: now,
    });

    await ctx.db.delete(args.id);

    return { success: true, deletedRefNo: mr.refNo };
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
    const scope = await resolveCallerScope(ctx, args.token);

    // Use indexed range queries per allowed project/site — no full table scan
    let mrs = await queryScopedByIndex(
      ctx,
      "material_request",
      scope,
      { statusFilter: args.status }
    );

    // Optional project filter for PM/admin drill-down
    if (args.projectId) {
      mrs = mrs.filter((mr) => String(mr.projectId) === String(args.projectId));
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
 * Enforces IDOR protection via assertDocumentAccess.
 */
export const getMR = query({
  args: {
    id: v.id("material_request"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    const mr = await ctx.db.get(args.id);
    if (!mr) return null;

    // IDOR guard: assert caller has access to this project/site
    assertDocumentAccess(scope, mr, mr.refNo);

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
