/**
 * @fileoverview RFQ Vendor Quotes operations and audit ledger.
 *
 * Quotes are recorded by Procurement Officers as vendors respond.
 * Quotes are immutable records: corrections supersede previous entries rather
 * than performing destructive updates.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { resolveCallerScope, assertDocumentAccess } from "./scoping";

/**
 * Record a vendor's line-item quote against an open RFQ.
 */
export const addQuote = mutation({
  args: {
    rfqId: v.id("rfq"),
    vendorId: v.id("vendors"),
    itemId: v.optional(v.string()),
    projectItemId: v.optional(v.id("project_items")),
    itemName: v.string(),
    category: v.optional(v.string()),
    unit: v.string(),
    quantity: v.number(),
    rate: v.number(),
    taxRate: v.optional(v.number()),
    validityDate: v.optional(v.string()),
    quoteFileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "rfq_quotes:add", args.token);
    const rfq = await ctx.db.get(args.rfqId);
    if (!rfq) throw new Error("RFQ not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, rfq, rfq.refNo);

    if (rfq.status !== "open" && rfq.status !== "draft") {
      throw new Error(
        `Cannot add quotes to an RFQ in "${rfq.status}" status. Quotes can only be added while RFQ is draft or open.`
      );
    }

    if (args.rate < 0) throw new Error("Quote rate cannot be negative.");
    if (args.quantity <= 0) throw new Error("Quote quantity must be greater than 0.");

    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) throw new Error("Vendor not found.");

    const taxRate = args.taxRate ?? 18;
    const subtotal = args.quantity * args.rate;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    const now = new Date().toISOString();

    const quoteId = await ctx.db.insert("rfq_quotes", {
      rfqId: args.rfqId,
      vendorId: args.vendorId,
      itemId: args.itemId,
      projectItemId: args.projectItemId,
      itemName: args.itemName.trim(),
      category: args.category?.trim() || undefined,
      unit: args.unit.trim(),
      quantity: args.quantity,
      rate: args.rate,
      taxRate,
      total,
      validityDate: args.validityDate,
      quoteFileId: args.quoteFileId,
      notes: args.notes?.trim() || undefined,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "add_rfq_quote",
      documentType: "rfq",
      documentId: args.rfqId,
      referenceId: rfq.refNo,
      note: `Recorded quote from ${vendor.name} for "${args.itemName}": ${args.quantity} ${args.unit} @ ₹${args.rate}/unit (Total: ₹${total}).`,
      timestamp: now,
    });

    return { quoteId, total };
  },
});

/**
 * Supersede an existing quote with a corrected quote row.
 */
export const supersedeQuote = mutation({
  args: {
    quoteId: v.id("rfq_quotes"),
    rate: v.number(),
    taxRate: v.optional(v.number()),
    quantity: v.optional(v.number()),
    validityDate: v.optional(v.string()),
    quoteFileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "rfq_quotes:supersede", args.token);
    const oldQuote = await ctx.db.get(args.quoteId);
    if (!oldQuote) throw new Error("Quote record not found.");

    if (oldQuote.supersededBy) {
      throw new Error("This quote has already been superseded by a newer entry.");
    }

    const rfq = await ctx.db.get(oldQuote.rfqId);
    if (!rfq) throw new Error("Parent RFQ not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, rfq, rfq.refNo);

    if (rfq.status !== "open" && rfq.status !== "draft") {
      throw new Error(`Cannot modify quotes on RFQ in "${rfq.status}" status.`);
    }

    const quantity = args.quantity ?? oldQuote.quantity;
    const taxRate = args.taxRate ?? oldQuote.taxRate ?? 18;
    const subtotal = quantity * args.rate;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    const now = new Date().toISOString();

    const newQuoteId = await ctx.db.insert("rfq_quotes", {
      rfqId: oldQuote.rfqId,
      vendorId: oldQuote.vendorId,
      itemId: oldQuote.itemId,
      projectItemId: oldQuote.projectItemId,
      itemName: oldQuote.itemName,
      category: oldQuote.category,
      unit: oldQuote.unit,
      quantity,
      rate: args.rate,
      taxRate,
      total,
      validityDate: args.validityDate ?? oldQuote.validityDate,
      quoteFileId: args.quoteFileId ?? oldQuote.quoteFileId,
      notes: args.notes ?? oldQuote.notes,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    await ctx.db.patch(oldQuote._id, {
      supersededBy: newQuoteId,
      updatedBy: user._id,
      updatedAt: now,
    });

    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "supersede_rfq_quote",
      documentType: "rfq",
      documentId: oldQuote.rfqId,
      referenceId: rfq.refNo,
      note: `Superseded quote for "${oldQuote.itemName}" (new rate: ₹${args.rate}/unit).`,
      timestamp: now,
    });

    return { newQuoteId, total };
  },
});

/**
 * Get all quotes for an RFQ, grouped with vendor details.
 */
export const getQuotesByRfq = query({
  args: {
    rfqId: v.id("rfq"),
    includeSuperseded: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);
    const rfq = await ctx.db.get(args.rfqId);
    if (!rfq) return [];

    assertDocumentAccess(scope, rfq, rfq.refNo);

    const quotes = await ctx.db
      .query("rfq_quotes")
      .withIndex("by_rfqId", (q) => q.eq("rfqId", args.rfqId))
      .collect();

    const filtered = args.includeSuperseded
      ? quotes
      : quotes.filter((q) => !q.supersededBy);

    const enriched = await Promise.all(
      filtered.map(async (q) => {
        const vendor = await ctx.db.get(q.vendorId);
        return {
          ...q,
          vendorName: vendor?.name ?? "Unknown Vendor",
          vendorPhone: vendor?.phone,
          vendorEmail: vendor?.email,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get single quote detail.
 */
export const getQuoteById = query({
  args: {
    quoteId: v.id("rfq_quotes"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) return null;

    const rfq = await ctx.db.get(quote.rfqId);
    if (!rfq) return null;

    assertDocumentAccess(scope, rfq, rfq.refNo);

    const vendor = await ctx.db.get(quote.vendorId);
    return {
      ...quote,
      vendorName: vendor?.name ?? "Unknown Vendor",
    };
  },
});
