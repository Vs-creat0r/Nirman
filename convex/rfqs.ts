/**
 * @fileoverview Request for Quotation (RFQ) backend operations and lifecycle.
 *
 * Full pipeline:
 * Create RFQ (standalone or from approved MR) → Add Invited Vendors →
 * Issue RFQ (draft → open) → Vendors submit line-item quotes (rfq_quotes) →
 * Close RFQ (open → closed) → Seed Cost Comparison snapshot.
 */

import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { transition } from "./transition";
import { Id, Doc } from "./_generated/dataModel";
import {
  resolveCallerScope,
  filterScopedList,
  assertDocumentAccess,
  queryScopedByIndex,
} from "./scoping";

/**
 * Generates monotonic reference number: RFQ-YYYY-NNNN
 */
async function generateRfqRefNo(ctx: MutationCtx): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `RFQ-${currentYear}-`;

  const allRfqs = await ctx.db.query("rfq").collect();
  let maxSeq = 0;

  for (const r of allRfqs) {
    if (r.refNo && r.refNo.startsWith(prefix)) {
      const numPart = parseInt(r.refNo.replace(prefix, ""), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Create a new RFQ (draft state).
 * Supports standalone sourcing or prefilling from source MR.
 */
export const createRfq = mutation({
  args: {
    projectId: v.id("projects"),
    siteId: v.optional(v.id("sites")),
    sourceMrId: v.optional(v.id("material_request")),
    vendorIds: v.array(v.id("vendors")),
    requestedItems: v.array(
      v.object({
        itemName: v.string(),
        category: v.optional(v.string()),
        quantity: v.number(),
        unit: v.union(
          v.literal("bags"),
          v.literal("MT"),
          v.literal("kg"),
          v.literal("nos"),
          v.literal("cum"),
          v.literal("brass"),
          v.literal("sqm"),
          v.literal("ltr"),
          v.literal("rmt")
        ),
        projectItemId: v.optional(v.id("project_items")),
        description: v.optional(v.string()),
      })
    ),
    dueDate: v.optional(v.string()),
    sentVia: v.optional(
      v.union(v.literal("whatsapp"), v.literal("email"), v.literal("manual"))
    ),
    notes: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "rfqs:create", args.token);
    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(
      scope,
      { projectId: args.projectId, siteId: args.siteId },
      "RFQ"
    );

    if (args.vendorIds.length === 0) {
      throw new Error("At least one vendor must be invited to quote on the RFQ.");
    }

    if (args.requestedItems.length === 0) {
      throw new Error("At least one requested item is required to create an RFQ.");
    }

    for (const item of args.requestedItems) {
      if (!item.itemName.trim()) {
        throw new Error("Item name cannot be empty.");
      }
      if (item.quantity <= 0) {
        throw new Error(`Quantity for "${item.itemName}" must be greater than 0.`);
      }
    }

    // If source MR is linked, verify access
    if (args.sourceMrId) {
      const mr = await ctx.db.get(args.sourceMrId);
      if (!mr) throw new Error("Linked Material Request not found.");
      assertDocumentAccess(scope, mr, mr.refNo);
    }

    const refNo = await generateRfqRefNo(ctx);
    const now = new Date().toISOString();

    const rfqId = await ctx.db.insert("rfq", {
      refNo,
      projectId: args.projectId,
      siteId: args.siteId,
      sourceMrId: args.sourceMrId,
      vendorIds: args.vendorIds,
      requestedItems: args.requestedItems.map((item) => ({
        itemName: item.itemName.trim(),
        category: item.category?.trim() || undefined,
        quantity: item.quantity,
        unit: item.unit,
        projectItemId: item.projectItemId,
        description: item.description?.trim() || undefined,
      })),
      dueDate: args.dueDate,
      sentVia: args.sentVia,
      sentAt: args.sentVia ? now : undefined,
      notes: args.notes?.trim() || undefined,
      status: "draft",
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "create_rfq",
      documentType: "rfq",
      documentId: rfqId,
      referenceId: refNo,
      toStatus: "draft",
      note: `RFQ ${refNo} created by ${user.name} (${args.requestedItems.length} items, ${args.vendorIds.length} invited vendors).`,
      timestamp: now,
    });

    return { rfqId, refNo };
  },
});

/**
 * Add invited vendor(s) to an existing draft or open RFQ.
 */
export const addVendorToRfq = mutation({
  args: {
    id: v.id("rfq"),
    vendorIds: v.array(v.id("vendors")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "rfqs:add_vendor", args.token);
    const rfq = await ctx.db.get(args.id);
    if (!rfq) throw new Error("RFQ not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, rfq, rfq.refNo);

    if (rfq.status !== "draft" && rfq.status !== "open") {
      throw new Error(
        `Cannot add vendors to RFQ in "${rfq.status}" status. Only draft or open RFQs can accept new vendors.`
      );
    }

    const merged = Array.from(new Set([...rfq.vendorIds, ...args.vendorIds]));
    const now = new Date().toISOString();

    await ctx.db.patch(args.id, {
      vendorIds: merged,
      updatedBy: user._id,
      updatedAt: now,
    });

    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "add_vendor_to_rfq",
      documentType: "rfq",
      documentId: args.id,
      referenceId: rfq.refNo,
      note: `Added ${args.vendorIds.length} vendor(s) to RFQ ${rfq.refNo} by ${user.name}.`,
      timestamp: now,
    });

    return { success: true, vendorCount: merged.length };
  },
});

/**
 * Issue RFQ: transitions draft → open.
 */
export const issueRfq = mutation({
  args: {
    id: v.id("rfq"),
    note: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await transition(ctx, {
      table: "rfq",
      documentId: args.id,
      transitionName: "issue",
      token: args.token,
      note: args.note,
    });
  },
});

/**
 * Close RFQ: transitions open → closed.
 */
export const closeRfq = mutation({
  args: {
    id: v.id("rfq"),
    note: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await transition(ctx, {
      table: "rfq",
      documentId: args.id,
      transitionName: "close",
      token: args.token,
      note: args.note,
    });
  },
});

/**
 * Archive RFQ: transitions open/closed → archived.
 */
export const archiveRfq = mutation({
  args: {
    id: v.id("rfq"),
    note: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await transition(ctx, {
      table: "rfq",
      documentId: args.id,
      transitionName: "archive",
      token: args.token,
      note: args.note,
    });
  },
});

/**
 * Delete a draft RFQ.
 */
export const deleteRfq = mutation({
  args: {
    id: v.id("rfq"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "rfqs:delete", args.token);
    const rfq = await ctx.db.get(args.id);
    if (!rfq) throw new Error("RFQ not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, rfq, rfq.refNo);

    if (rfq.status !== "draft") {
      throw new Error(`Only draft RFQs can be deleted. Current status is "${rfq.status}".`);
    }

    // Clean up any draft quote rows
    const quotes = await ctx.db
      .query("rfq_quotes")
      .withIndex("by_rfqId", (q) => q.eq("rfqId", args.id))
      .collect();

    for (const q of quotes) {
      await ctx.db.delete(q._id);
    }

    await ctx.db.delete(args.id);

    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "delete_rfq",
      documentType: "rfq",
      documentId: args.id,
      referenceId: rfq.refNo,
      note: `Draft RFQ ${rfq.refNo} deleted by ${user.name}.`,
      timestamp: new Date().toISOString(),
    });

    return { success: true, deletedRefNo: rfq.refNo };
  },
});

/**
 * Get single RFQ with enriched relations and quote counts.
 */
export const getRfq = query({
  args: {
    id: v.id("rfq"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);
    const rfq = await ctx.db.get(args.id);
    if (!rfq) return null;

    assertDocumentAccess(scope, rfq, rfq.refNo);

    const project = await ctx.db.get(rfq.projectId);
    const site = rfq.siteId ? await ctx.db.get(rfq.siteId) : null;
    const creator = await ctx.db.get(rfq.createdBy);
    const sourceMr = rfq.sourceMrId ? await ctx.db.get(rfq.sourceMrId) : null;

    // Fetch invited vendors
    const vendors = await Promise.all(
      rfq.vendorIds.map(async (vid) => {
        const vDoc = await ctx.db.get(vid);
        return vDoc ? { _id: vDoc._id, name: vDoc.name, phone: vDoc.phone, email: vDoc.email } : null;
      })
    );

    // Fetch quotes for this RFQ
    const quotes = await ctx.db
      .query("rfq_quotes")
      .withIndex("by_rfqId", (q) => q.eq("rfqId", args.id))
      .collect();

    // Fetch audit logs
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_documentType_documentId", (q) =>
        q.eq("documentType", "rfq").eq("documentId", args.id)
      )
      .collect();

    return {
      ...rfq,
      projectName: project?.name ?? "Unknown Project",
      siteName: site?.name ?? "All Sites",
      creatorName: creator?.name ?? "Unknown User",
      sourceMrRefNo: sourceMr?.refNo,
      vendors: vendors.filter(Boolean),
      quotesCount: quotes.length,
      logs: logs.map((l) => ({
        actorName: l.actorRole,
        actorRole: l.actorRole,
        action: l.action,
        toStatus: l.toStatus,
        note: l.note,
        timestamp: l.timestamp,
      })),
    };
  },
});

/**
 * List RFQs with server-enforced scoping and optional filtering.
 */
export const listRfqs = query({
  args: {
    projectId: v.optional(v.id("projects")),
    status: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    const rfqs = await queryScopedByIndex(ctx, "rfq", scope, {
      projectId: args.projectId,
      statusFilter: args.status,
    });


    const enriched = await Promise.all(
      rfqs.map(async (rfq) => {
        const project = await ctx.db.get(rfq.projectId);
        const site = rfq.siteId ? await ctx.db.get(rfq.siteId) : null;
        const creator = await ctx.db.get(rfq.createdBy);

        const quoteCount = (
          await ctx.db
            .query("rfq_quotes")
            .withIndex("by_rfqId", (q) => q.eq("rfqId", rfq._id))
            .collect()
        ).length;

        return {
          _id: rfq._id,
          refNo: rfq.refNo,
          projectId: rfq.projectId,
          projectName: project?.name ?? "Unknown Project",
          siteId: rfq.siteId,
          siteName: site?.name ?? "All Sites",
          vendorCount: rfq.vendorIds.length,
          itemCount: rfq.requestedItems.length,
          quotesCount: quoteCount,
          dueDate: rfq.dueDate,
          sentVia: rfq.sentVia,
          status: rfq.status,
          creatorName: creator?.name ?? "Unknown",
          createdAt: rfq._creationTime,
        };
      })
    );

    return enriched;
  },
});
