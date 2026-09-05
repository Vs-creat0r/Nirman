/**
 * @fileoverview Scoped Document Data Hydration for Vector PDF Generation.
 *
 * Runs in default Convex runtime. Enforces caller security scope and IDOR
 * checks via resolveCallerScope and assertDocumentAccess across all 6 document types.
 */

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id, TableNames } from "./_generated/dataModel";
import { resolveCallerScope, assertDocumentAccess } from "./scoping";

export type PdfDocType =
  | "material_request"
  | "rfq"
  | "cost_comparison"
  | "purchase_order"
  | "delivery_challan"
  | "grn";

export interface PdfLineItem {
  itemName: string;
  description?: string;
  hsnSacCode?: string;
  quantity: number;
  unit: string;
  rate?: number;
  taxPct?: number;
  amount?: number;
  orderedQty?: number;
  dispatchedQty?: number;
  expectedQty?: number;
  receivedQty?: number;
}

export interface PdfVendorInfo {
  name: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
}

export interface PdfQuoteComparison {
  vendorName: string;
  gstin?: string;
  subtotal: number;
  taxAmount: number;
  freight?: number;
  total: number;
  deliveryDays?: number;
  paymentTerms?: string;
  isSelected?: boolean;
  notes?: string;
  items: {
    itemName: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
  }[];
}

export interface PdfDocumentData {
  docType: PdfDocType;
  docId: string;
  refNo: string;
  status: string;
  createdAt: string;
  project?: {
    name: string;
    code: string;
    client?: string;
  };
  site?: {
    name: string;
    address?: string;
  };
  vendor?: PdfVendorInfo;
  vendors?: PdfVendorInfo[];
  creator?: {
    name: string;
    role: string;
  };
  reviewer?: {
    name: string;
    role: string;
    reviewedAt?: string;
    reviewNote?: string;
  };
  confirmer?: {
    name: string;
    role: string;
  };
  priority?: string;
  requiredBy?: string;
  dueDate?: string;
  expectedDelivery?: string;
  validUntil?: string;
  paymentTerms?: string;
  placeOfSupplyStateCode?: string;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  dispatchDate?: string;
  deliveredAt?: string;
  invoiceNumber?: string;
  notes?: string;
  procurementNotes?: string;
  termsAndConditions?: string;
  subtotal?: number;
  freight?: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount?: number;
  lineItems: PdfLineItem[];
  quotes?: PdfQuoteComparison[];
  selectedVendorId?: string;
  selectionJustification?: string;
  auditLogs: {
    actorName: string;
    actorRole: string;
    action: string;
    toStatus?: string;
    note?: string;
    timestamp: string;
  }[];
}

export const getDocumentForPdf = internalQuery({
  args: {
    docType: v.union(
      v.literal("material_request"),
      v.literal("rfq"),
      v.literal("cost_comparison"),
      v.literal("purchase_order"),
      v.literal("delivery_challan"),
      v.literal("grn")
    ),
    docId: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PdfDocumentData> => {
    const scope = await resolveCallerScope(ctx, args.token);
    const table = args.docType as TableNames;
    const doc = await ctx.db.get(args.docId as Id<typeof table>);

    if (!doc) {
      throw new Error(`Document not found in ${args.docType} with ID ${args.docId}.`);
    }

    const docRecord = doc as Record<string, unknown> & {
      refNo: string;
      status: string;
      _id: string;
      _creationTime: number;
      projectId?: Id<"projects">;
      siteId?: Id<"sites">;
      createdBy?: Id<"users">;
    };

    assertDocumentAccess(scope, docRecord, docRecord.refNo);

    // 1. Resolve Project & Site
    let project: { name: string; code: string; client?: string } | undefined;
    let site: { name: string; address?: string } | undefined;

    let targetProjectId = docRecord.projectId;
    const targetSiteId = docRecord.siteId;

    // For DC and GRN, project might be linked via PO
    if (!targetProjectId && "purchaseOrderId" in docRecord && docRecord.purchaseOrderId) {
      const parentPo = await ctx.db.get(docRecord.purchaseOrderId as Id<"purchase_order">);
      if (parentPo?.projectId) {
        targetProjectId = parentPo.projectId;
      }
    }

    if (targetProjectId) {
      const p = await ctx.db.get(targetProjectId);
      if (p) {
        project = {
          name: p.name,
          code: p.code,
          client: p.client,
        };
      }
    }

    if (targetSiteId) {
      const s = await ctx.db.get(targetSiteId);
      if (s) {
        site = {
          name: s.name,
          address: s.address,
        };
      }
    }

    // 2. Resolve Creator, Reviewer, Confirmer
    let creator: { name: string; role: string } | undefined;
    if (docRecord.createdBy) {
      const u = await ctx.db.get(docRecord.createdBy);
      if (u) {
        creator = { name: u.name, role: u.role };
      }
    }

    let reviewer: { name: string; role: string; reviewedAt?: string; reviewNote?: string } | undefined;
    if ("reviewedBy" in docRecord && docRecord.reviewedBy) {
      const u = await ctx.db.get(docRecord.reviewedBy as Id<"users">);
      if (u) {
        reviewer = {
          name: u.name,
          role: u.role,
          reviewedAt: typeof docRecord.reviewedAt === "string" ? docRecord.reviewedAt : undefined,
          reviewNote: typeof docRecord.reviewNote === "string" ? docRecord.reviewNote : undefined,
        };
      }
    }

    let confirmer: { name: string; role: string } | undefined;
    if ("confirmedBy" in docRecord && docRecord.confirmedBy) {
      const u = await ctx.db.get(docRecord.confirmedBy as Id<"users">);
      if (u) {
        confirmer = { name: u.name, role: u.role };
      }
    }

    // 3. Resolve Vendor(s)
    let vendor: PdfVendorInfo | undefined;
    let vendorsList: PdfVendorInfo[] | undefined;

    if ("vendorId" in docRecord && docRecord.vendorId) {
      const vDoc = await ctx.db.get(docRecord.vendorId as Id<"vendors">);
      if (vDoc) {
        vendor = {
          name: vDoc.name,
          gstin: vDoc.gstNo,
          phone: vDoc.phone,
          email: vDoc.email,
          address: vDoc.address,
          contactPerson: vDoc.contactPerson,
        };
      }
    } else if ("vendorIds" in docRecord && Array.isArray(docRecord.vendorIds)) {
      const resolved = await Promise.all(
        (docRecord.vendorIds as Id<"vendors">[]).map((id) => ctx.db.get(id))
      );
      vendorsList = resolved
        .filter((vItem): vItem is NonNullable<typeof vItem> => vItem !== null)
        .map((vDoc) => ({
          name: vDoc.name,
          gstin: vDoc.gstNo,
          phone: vDoc.phone,
          email: vDoc.email,
          address: vDoc.address,
          contactPerson: vDoc.contactPerson,
        }));
    }

    // 4. Resolve Line Items & Specific Structure
    const lineItems: PdfLineItem[] = [];
    let quotes: PdfQuoteComparison[] | undefined;

    if (args.docType === "material_request" && Array.isArray(docRecord.items)) {
      for (const item of docRecord.items as Record<string, unknown>[]) {
        lineItems.push({
          itemName: String(item.itemName || ""),
          description: typeof item.description === "string" ? item.description : undefined,
          hsnSacCode: typeof item.hsnSacCode === "string" ? item.hsnSacCode : undefined,
          quantity: Number(item.quantity || 0),
          unit: String(item.unit || "NOS"),
        });
      }
    } else if (args.docType === "rfq" && Array.isArray(docRecord.requestedItems)) {
      for (const item of docRecord.requestedItems as Record<string, unknown>[]) {
        lineItems.push({
          itemName: String(item.itemName || ""),
          description: typeof item.description === "string" ? item.description : undefined,
          quantity: Number(item.quantity || 0),
          unit: String(item.unit || "NOS"),
        });
      }
    } else if (args.docType === "purchase_order" && Array.isArray(docRecord.lineItems)) {
      for (const item of docRecord.lineItems as Record<string, unknown>[]) {
        lineItems.push({
          itemName: String(item.itemName || ""),
          description: typeof item.additionReason === "string" ? item.additionReason : undefined,
          hsnSacCode: typeof item.hsnSacCode === "string" ? item.hsnSacCode : undefined,
          quantity: Number(item.quantity || 0),
          unit: String(item.unit || "NOS"),
          rate: typeof item.rate === "number" ? item.rate : undefined,
          amount: typeof item.amount === "number" ? item.amount : undefined,
        });
      }
    } else if (args.docType === "delivery_challan" && Array.isArray(docRecord.dispatchedItems)) {
      for (const item of docRecord.dispatchedItems as Record<string, unknown>[]) {
        lineItems.push({
          itemName: String(item.itemName || ""),
          hsnSacCode: typeof item.hsnSacCode === "string" ? item.hsnSacCode : undefined,
          quantity: Number(item.dispatchedQty || 0),
          orderedQty: Number(item.orderedQty || 0),
          dispatchedQty: Number(item.dispatchedQty || 0),
          unit: String(item.unit || "NOS"),
        });
      }
    } else if (args.docType === "grn" && Array.isArray(docRecord.receivedItems)) {
      for (const item of docRecord.receivedItems as Record<string, unknown>[]) {
        lineItems.push({
          itemName: String(item.itemName || ""),
          quantity: Number(item.receivedQty || 0),
          expectedQty: Number(item.expectedQty || 0),
          receivedQty: Number(item.receivedQty || 0),
          unit: String(item.unit || "NOS"),
        });
      }
    } else if (args.docType === "cost_comparison" && Array.isArray(docRecord.vendorQuotes)) {
      quotes = [];
      const selectedIdStr = docRecord.selectedVendorId ? String(docRecord.selectedVendorId) : undefined;
      for (const q of docRecord.vendorQuotes as Record<string, unknown>[]) {
        const vId = q.vendorId as Id<"vendors">;
        const vDoc = await ctx.db.get(vId);
        const vName = vDoc ? vDoc.name : "Vendor";
        const isSelected = selectedIdStr ? String(vId) === selectedIdStr : false;

        const qItems: {
          itemName: string;
          quantity: number;
          unit: string;
          rate: number;
          amount: number;
        }[] = [];

        if (Array.isArray(q.items)) {
          for (const item of q.items as Record<string, unknown>[]) {
            qItems.push({
              itemName: String(item.itemName || ""),
              quantity: Number(item.quantity || 0),
              unit: String(item.unit || "NOS"),
              rate: Number(item.rate || 0),
              amount: Number(item.amount || 0),
            });
          }
        }

        quotes.push({
          vendorName: vName,
          gstin: vDoc?.gstNo,
          subtotal: Number(q.subtotal || 0),
          taxAmount: Number(q.taxAmount || 0),
          freight: typeof q.freight === "number" ? q.freight : undefined,
          total: Number(q.total || 0),
          deliveryDays: typeof q.deliveryDays === "number" ? q.deliveryDays : undefined,
          paymentTerms: typeof q.paymentTerms === "string" ? q.paymentTerms : undefined,
          notes: typeof q.notes === "string" ? q.notes : undefined,
          isSelected,
          items: qItems,
        });
      }
    }

    // 5. Fetch Audit Trail Logs
    const rawLogs = await ctx.db
      .query("logs")
      .withIndex("by_documentType_documentId", (q) =>
        q.eq("documentType", args.docType).eq("documentId", String(docRecord._id))
      )
      .collect();

    const auditLogs: {
      actorName: string;
      actorRole: string;
      action: string;
      toStatus?: string;
      note?: string;
      timestamp: string;
    }[] = [];

    for (const log of rawLogs) {
      let actorName = "System";
      let actorRole = String(log.actorRole || "user");
      if (log.actorId) {
        const actor = await ctx.db.get(log.actorId);
        if (actor) {
          actorName = actor.name;
          actorRole = actor.role;
        }
      }
      auditLogs.push({
        actorName,
        actorRole,
        action: log.action,
        toStatus: log.toStatus,
        note: log.note,
        timestamp: log.timestamp,
      });
    }

    return {
      docType: args.docType,
      docId: String(docRecord._id),
      refNo: docRecord.refNo,
      status: docRecord.status,
      createdAt: new Date(docRecord._creationTime).toISOString(),
      project,
      site,
      vendor,
      vendors: vendorsList,
      creator,
      reviewer,
      confirmer,
      priority: typeof docRecord.priority === "string" ? docRecord.priority : undefined,
      requiredBy: typeof docRecord.requiredBy === "string" ? docRecord.requiredBy : undefined,
      dueDate: typeof docRecord.dueDate === "string" ? docRecord.dueDate : undefined,
      expectedDelivery:
        typeof docRecord.expectedDelivery === "string" ? docRecord.expectedDelivery : undefined,
      validUntil: typeof docRecord.validUntil === "string" ? docRecord.validUntil : undefined,
      paymentTerms: typeof docRecord.paymentTerms === "string" ? docRecord.paymentTerms : undefined,
      placeOfSupplyStateCode:
        typeof docRecord.placeOfSupplyStateCode === "string"
          ? docRecord.placeOfSupplyStateCode
          : undefined,
      vehicleNo: typeof docRecord.vehicleNo === "string" ? docRecord.vehicleNo : undefined,
      driverName: typeof docRecord.driverName === "string" ? docRecord.driverName : undefined,
      driverPhone: typeof docRecord.driverPhone === "string" ? docRecord.driverPhone : undefined,
      dispatchDate: typeof docRecord.dispatchDate === "string" ? docRecord.dispatchDate : undefined,
      deliveredAt: typeof docRecord.deliveredAt === "string" ? docRecord.deliveredAt : undefined,
      invoiceNumber:
        typeof docRecord.invoiceNumber === "string" ? docRecord.invoiceNumber : undefined,
      notes: typeof docRecord.notes === "string" ? docRecord.notes : undefined,
      procurementNotes:
        typeof docRecord.procurementNotes === "string" ? docRecord.procurementNotes : undefined,
      termsAndConditions:
        typeof docRecord.termsAndConditions === "string" ? docRecord.termsAndConditions : undefined,
      subtotal: typeof docRecord.subtotal === "number" ? docRecord.subtotal : undefined,
      freight: typeof docRecord.freight === "number" ? docRecord.freight : undefined,
      taxRate: typeof docRecord.taxRate === "number" ? docRecord.taxRate : undefined,
      taxAmount: typeof docRecord.taxAmount === "number" ? docRecord.taxAmount : undefined,
      totalAmount: typeof docRecord.totalAmount === "number" ? docRecord.totalAmount : undefined,
      lineItems,
      quotes,
      selectedVendorId:
        typeof docRecord.selectedVendorId === "string" ? docRecord.selectedVendorId : undefined,
      selectionJustification:
        typeof docRecord.selectionJustification === "string"
          ? docRecord.selectionJustification
          : undefined,
      auditLogs,
    };
  },
});
