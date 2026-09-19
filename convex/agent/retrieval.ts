/**
 * @fileoverview Scoped Retrieval Engine for Nirman AI Agentic Layer.
 * Implements S6-3: Field Projection & Scope-Bounded Retrieval. Zero writes.
 */

import { query, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { resolveCallerScope, canAccessDocument, ScopedTableName } from "../scoping";

export interface ProjectedDocument {
  readonly table: string;
  readonly document: Record<string, unknown>;
}

export interface ItemRetrievalMatch {
  readonly table: string;
  readonly documentId: string;
  readonly refNo?: string;
  readonly status?: string;
  readonly matchedItem: Record<string, unknown>;
  readonly document: Record<string, unknown>;
}

export interface VendorRetrievalResult {
  readonly vendor: Record<string, unknown> | null;
  readonly documents: readonly ProjectedDocument[];
}

export function projectSafeFields(table: string, doc: Record<string, unknown>): Record<string, unknown> {
  if (!doc || typeof doc !== "object") return {};

  switch (table) {
    case "material_request": {
      const safeItems = (Array.isArray(doc.items) ? doc.items : []).map((it: unknown) => {
        const item = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
        return {
          itemName: item.itemName,
          description: item.description,
          hsnSacCode: item.hsnSacCode,
          quantity: item.quantity,
          unit: item.unit,
          projectItemId: item.projectItemId,
        };
      });
      return {
        _id: doc._id,
        refNo: doc.refNo,
        projectId: doc.projectId,
        siteId: doc.siteId,
        status: doc.status,
        priority: doc.priority,
        notes: doc.notes,
        requiredBy: doc.requiredBy,
        items: safeItems,
      };
    }

    case "cost_comparison": {
      const safeQuotes = (Array.isArray(doc.vendorQuotes) ? doc.vendorQuotes : []).map((q: unknown) => {
        const quote = (q && typeof q === "object" ? q : {}) as Record<string, unknown>;
        const safeItems = (Array.isArray(quote.items) ? quote.items : []).map((it: unknown) => {
          const item = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          return {
            itemName: item.itemName,
            description: item.description,
            hsnSacCode: item.hsnSacCode,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            projectItemId: item.projectItemId,
          };
        });
        return {
          vendorId: quote.vendorId,
          items: safeItems,
          taxRate: quote.taxRate,
          freight: quote.freight,
          deliveryDays: quote.deliveryDays,
          paymentTerms: quote.paymentTerms,
          notes: quote.notes,
        };
      });
      return {
        _id: doc._id,
        refNo: doc.refNo,
        projectId: doc.projectId,
        siteId: doc.siteId,
        materialRequestId: doc.materialRequestId,
        status: doc.status,
        recommendedVendorId: doc.recommendedVendorId,
        vendorQuotes: safeQuotes,
      };
    }

    case "purchase_order": {
      const rawList = Array.isArray(doc.lineItems) ? doc.lineItems : Array.isArray(doc.items) ? doc.items : [];
      const safeItems = rawList.map((it: unknown) => {
        const item = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
        return {
          itemName: item.itemName,
          description: item.description,
          hsnSacCode: item.hsnSacCode,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          amount: item.amount,
          projectItemId: item.projectItemId,
        };
      });
      return {
        _id: doc._id,
        refNo: doc.refNo,
        projectId: doc.projectId,
        siteId: doc.siteId,
        vendorId: doc.vendorId,
        costComparisonId: doc.costComparisonId,
        status: doc.status,
        subtotal: doc.subtotal,
        taxRate: doc.taxRate,
        taxAmount: doc.taxAmount,
        totalAmount: doc.totalAmount ?? doc.total,
        deliveryDate: doc.deliveryDate,
        paymentTerms: doc.paymentTerms,
        items: safeItems,
        lineItems: safeItems,
      };
    }

    case "project_items":
      return {
        _id: doc._id,
        projectId: doc.projectId,
        itemName: doc.itemName,
        category: doc.category,
        unit: doc.unit,
        boqQty: doc.boqQty,
        procuredQty: doc.procuredQty,
        estimatedRate: doc.estimatedRate,
      };

    case "vendors":
      return { _id: doc._id, name: doc.name, category: doc.category, status: doc.status, isActive: doc.isActive };

    case "projects":
      return { _id: doc._id, name: doc.name, code: doc.code, status: doc.status };

    case "sites":
      return { _id: doc._id, name: doc.name, code: doc.code, projectId: doc.projectId, status: doc.status };

    default:
      return { _id: doc._id, refNo: doc.refNo, status: doc.status, projectId: doc.projectId, siteId: doc.siteId };
  }
}

const SEARCHABLE_TABLES: readonly ScopedTableName[] = [
  "material_request",
  "cost_comparison",
  "purchase_order",
  "delivery_challan",
  "rfq",
  "grn",
];

type DocWithScope = Record<string, unknown> & {
  _id: string;
  refNo?: string;
  status?: string;
  projectId?: Id<"projects">;
  siteId?: Id<"sites">;
};

async function queryTableByRefNo(ctx: QueryCtx, table: ScopedTableName, refNo: string): Promise<DocWithScope | null> {
  switch (table) {
    case "material_request":
      return (await ctx.db.query("material_request").withIndex("by_refNo", (q) => q.eq("refNo", refNo)).first()) as DocWithScope | null;
    case "cost_comparison":
      return (await ctx.db.query("cost_comparison").withIndex("by_refNo", (q) => q.eq("refNo", refNo)).first()) as DocWithScope | null;
    case "purchase_order":
      return (await ctx.db.query("purchase_order").withIndex("by_refNo", (q) => q.eq("refNo", refNo)).first()) as DocWithScope | null;
    case "delivery_challan":
      return (await ctx.db.query("delivery_challan").withIndex("by_refNo", (q) => q.eq("refNo", refNo)).first()) as DocWithScope | null;
    case "rfq":
      return (await ctx.db.query("rfq").withIndex("by_refNo", (q) => q.eq("refNo", refNo)).first()) as DocWithScope | null;
    case "grn":
      return (await ctx.db.query("grn").withIndex("by_refNo", (q) => q.eq("refNo", refNo)).first()) as DocWithScope | null;
    default:
      return null;
  }
}

async function queryTableByProjectId(ctx: QueryCtx, table: ScopedTableName, projectId: Id<"projects">): Promise<DocWithScope[]> {
  switch (table) {
    case "material_request":
      return (await ctx.db.query("material_request").withIndex("by_projectId", (q) => q.eq("projectId", projectId)).collect()) as DocWithScope[];
    case "cost_comparison":
      return (await ctx.db.query("cost_comparison").filter((q) => q.eq(q.field("projectId"), projectId)).collect()) as DocWithScope[];
    case "purchase_order":
      return (await ctx.db.query("purchase_order").filter((q) => q.eq(q.field("projectId"), projectId)).collect()) as DocWithScope[];
    case "delivery_challan": {
      const all = (await ctx.db.query("delivery_challan").collect()) as DocWithScope[];
      return all.filter((d) => String(d.projectId) === String(projectId));
    }
    case "rfq":
      return (await ctx.db.query("rfq").withIndex("by_projectId", (q) => q.eq("projectId", projectId)).collect()) as DocWithScope[];
    case "grn": {
      const all = (await ctx.db.query("grn").collect()) as DocWithScope[];
      return all.filter((d) => String(d.projectId) === String(projectId));
    }
    default:
      return [];
  }
}

export async function retrieveByDocumentNumberHelper(
  ctx: QueryCtx,
  args: { refNo: string; token?: string }
): Promise<ProjectedDocument | null> {
  const scope = await resolveCallerScope(ctx, args.token);
  const targetRef = args.refNo.trim();
  if (!targetRef) return null;

  for (const table of SEARCHABLE_TABLES) {
    try {
      const docRecord = await queryTableByRefNo(ctx, table, targetRef);
      if (docRecord && canAccessDocument(scope, docRecord)) {
        return { table, document: projectSafeFields(table, docRecord) };
      }
    } catch {
      // Continue to next table
    }
  }
  return null;
}

export async function retrieveByProjectHelper(
  ctx: QueryCtx,
  args: { projectId: string; token?: string; limit?: number }
): Promise<ProjectedDocument[]> {
  const scope = await resolveCallerScope(ctx, args.token);
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
  const results: ProjectedDocument[] = [];

  for (const table of SEARCHABLE_TABLES) {
    try {
      const docs = await queryTableByProjectId(ctx, table, args.projectId as Id<"projects">);
      for (const docRecord of docs) {
        if (canAccessDocument(scope, docRecord)) {
          results.push({ table, document: projectSafeFields(table, docRecord) });
          if (results.length >= limit) return results;
        }
      }
    } catch {
      // Non-fatal
    }
  }
  return results;
}

export async function retrieveByItemHelper(
  ctx: QueryCtx,
  args: { itemName: string; projectId?: string; token?: string; limit?: number }
): Promise<ItemRetrievalMatch[]> {
  const scope = await resolveCallerScope(ctx, args.token);
  const targetName = args.itemName.toLowerCase().trim();
  if (!targetName) return [];

  const limit = Math.min(Math.max(args.limit ?? 10, 1), 30);
  const matches: ItemRetrievalMatch[] = [];

  // 1. BOQ / project_items
  try {
    const boqDocs = args.projectId
      ? await ctx.db.query("project_items").withIndex("by_projectId", (q) => q.eq("projectId", args.projectId as Id<"projects">)).collect()
      : await ctx.db.query("project_items").collect();

    for (const item of boqDocs) {
      const itemRecord = item as unknown as DocWithScope & { itemName?: string };
      if (!itemRecord.itemName || !canAccessDocument(scope, itemRecord)) continue;
      const itName = String(itemRecord.itemName).toLowerCase();
      if (itName.includes(targetName) || targetName.includes(itName)) {
        matches.push({
          table: "project_items",
          documentId: String(itemRecord._id),
          matchedItem: itemRecord,
          document: projectSafeFields("project_items", itemRecord),
        });
        if (matches.length >= limit) return matches;
      }
    }
  } catch {
    // Non-fatal
  }

  // 2. Purchase Orders
  try {
    const poDocs = args.projectId
      ? await ctx.db.query("purchase_order").filter((q) => q.eq(q.field("projectId"), args.projectId as Id<"projects">)).collect()
      : await ctx.db.query("purchase_order").collect();

    for (const doc of poDocs) {
      const docRecord = doc as unknown as DocWithScope & { lineItems?: unknown[]; items?: unknown[]; vendorId?: string };
      if (!canAccessDocument(scope, docRecord)) continue;
      const poItems = Array.isArray(docRecord.lineItems) ? docRecord.lineItems : Array.isArray(docRecord.items) && docRecord.vendorId ? docRecord.items : [];

      for (const it of poItems) {
        const itemObj = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
        const itName = String(itemObj.itemName || "").toLowerCase();
        if (itName && (itName.includes(targetName) || targetName.includes(itName))) {
          matches.push({
            table: "purchase_order",
            documentId: String(docRecord._id),
            refNo: docRecord.refNo,
            status: docRecord.status,
            matchedItem: itemObj,
            document: projectSafeFields("purchase_order", docRecord),
          });
          if (matches.length >= limit) return matches;
          break;
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // 3. Cost Comparisons & Material Requests
  const otherTables: readonly ("cost_comparison" | "material_request")[] = ["cost_comparison", "material_request"];
  for (const table of otherTables) {
    try {
      const docs = args.projectId
        ? await queryTableByProjectId(ctx, table, args.projectId as Id<"projects">)
        : ((await ctx.db.query(table).collect()) as unknown as DocWithScope[]);

      for (const docRecord of docs) {
        if (!canAccessDocument(scope, docRecord)) continue;

        if (table === "cost_comparison") {
          const quotes = Array.isArray(docRecord.vendorQuotes) ? docRecord.vendorQuotes : [];
          for (const rawQuote of quotes) {
            const quote = (rawQuote && typeof rawQuote === "object" ? rawQuote : {}) as Record<string, unknown>;
            const items = Array.isArray(quote.items) ? quote.items : [];
            for (const it of items) {
              const itemObj = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
              const itName = String(itemObj.itemName || "").toLowerCase();
              if (itName && (itName.includes(targetName) || targetName.includes(itName))) {
                matches.push({
                  table,
                  documentId: String(docRecord._id),
                  refNo: docRecord.refNo,
                  status: docRecord.status,
                  matchedItem: itemObj,
                  document: projectSafeFields(table, docRecord),
                });
                break;
              }
            }
          }
        } else {
          const items = Array.isArray(docRecord.items) ? docRecord.items : [];
          for (const it of items) {
            const itemObj = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
            const itName = String(itemObj.itemName || "").toLowerCase();
            if (itName && (itName.includes(targetName) || targetName.includes(itName))) {
              matches.push({
                table,
                documentId: String(docRecord._id),
                refNo: docRecord.refNo,
                status: docRecord.status,
                matchedItem: itemObj,
                document: projectSafeFields(table, docRecord),
              });
              break;
            }
          }
        }
        if (matches.length >= limit) return matches;
      }
    } catch {
      // Non-fatal
    }
  }
  return matches;
}

export async function retrieveByVendorHelper(
  ctx: QueryCtx,
  args: { vendorId: string; token?: string; limit?: number }
): Promise<VendorRetrievalResult> {
  const scope = await resolveCallerScope(ctx, args.token);
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

  const rawVendor = await ctx.db.get(args.vendorId as Id<"vendors">);
  const vendor = rawVendor ? projectSafeFields("vendors", rawVendor as unknown as Record<string, unknown>) : null;
  const documents: ProjectedDocument[] = [];

  // 1. Purchase Orders
  try {
    const pos = await ctx.db.query("purchase_order").collect();
    for (const po of pos) {
      const docRecord = po as unknown as DocWithScope & { vendorId?: string };
      if (docRecord.vendorId === args.vendorId && canAccessDocument(scope, docRecord)) {
        documents.push({ table: "purchase_order", document: projectSafeFields("purchase_order", docRecord) });
        if (documents.length >= limit) return { vendor, documents };
      }
    }
  } catch {
    // Non-fatal
  }

  // 2. Cost Comparisons
  try {
    const ccs = await ctx.db.query("cost_comparison").collect();
    for (const cc of ccs) {
      const docRecord = cc as unknown as DocWithScope & { vendorQuotes?: unknown[] };
      if (!canAccessDocument(scope, docRecord)) continue;
      const quotes = Array.isArray(docRecord.vendorQuotes) ? docRecord.vendorQuotes : [];
      const hasVendor = quotes.some((q: unknown) => {
        const quote = (q && typeof q === "object" ? q : {}) as Record<string, unknown>;
        return String(quote.vendorId) === args.vendorId;
      });
      if (hasVendor) {
        documents.push({ table: "cost_comparison", document: projectSafeFields("cost_comparison", docRecord) });
        if (documents.length >= limit) return { vendor, documents };
      }
    }
  } catch {
    // Non-fatal
  }
  return { vendor, documents };
}

export const retrieveByDocumentNumber = query({
  args: { refNo: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, args) => retrieveByDocumentNumberHelper(ctx, args),
});

export const retrieveByProject = query({
  args: { projectId: v.string(), limit: v.optional(v.number()), token: v.optional(v.string()) },
  handler: async (ctx, args) => retrieveByProjectHelper(ctx, args),
});

export const retrieveByItem = query({
  args: { itemName: v.string(), projectId: v.optional(v.string()), limit: v.optional(v.number()), token: v.optional(v.string()) },
  handler: async (ctx, args) => retrieveByItemHelper(ctx, args),
});

export const retrieveByVendor = query({
  args: { vendorId: v.string(), limit: v.optional(v.number()), token: v.optional(v.string()) },
  handler: async (ctx, args) => retrieveByVendorHelper(ctx, args),
});
