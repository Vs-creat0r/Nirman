// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Cost Comparison — Side-by-side vendor quotes. Requires a minimum of 2 quotes; the Project Manager approves by selecting a vendor.
  cost_comparison: defineTable({
    refNo: v.string(),
    materialRequestId: v.id("material_request"),
    rfqId: v.optional(v.id("rfq")),
    projectId: v.id("projects"),
    siteId: v.optional(v.id("sites")),
    vendorQuotes: v.array(
      v.object({
        vendorId: v.id("vendors"),
        items: v.array(
          v.object({
            itemName: v.string(),
            quantity: v.number(),
            unit: v.string(),
            rate: v.number(),
            amount: v.number(),
            projectItemId: v.optional(v.id("project_items")),
          })
        ),
        subtotal: v.number(),
        taxRate: v.number(),
        taxAmount: v.number(),
        freight: v.optional(v.number()),
        total: v.number(),
        deliveryDays: v.optional(v.number()),
        paymentTerms: v.optional(v.string()),
        quoteFileId: v.optional(v.id("_storage")),
        notes: v.optional(v.string()),
      })
    ),
    selectedVendorId: v.optional(v.id("vendors")),
    selectionJustification: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("submitted"), v.literal("queried"), v.literal("rejected"), v.literal("approved")),
    reviewNote: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_refNo", ["refNo"])
    .index("by_status", ["status"])
    .index("by_materialRequestId", ["materialRequestId"])
    .index("by_projectId_status", ["projectId", "status"]),

  // Delivery Challan — Dispatch record against an approved purchase order. Partial quantities are Sprint 2.
  delivery_challan: defineTable({
    refNo: v.string(),
    purchaseOrderId: v.id("purchase_order"),
    vendorId: v.id("vendors"),
    siteId: v.optional(v.id("sites")),
    vehicleNo: v.string(),
    driverName: v.string(),
    driverPhone: v.optional(v.string()),
    dispatchedItems: v.array(
      v.object({
        itemName: v.string(),
        orderedQty: v.number(),
        dispatchedQty: v.number(),
        unit: v.string(),
        hsnSacCode: v.optional(v.string()),
      })
    ),
    isPartial: v.optional(v.boolean()),
    dispatchDate: v.string(),
    expectedArrival: v.string(),
    notes: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("delivery_processing"), v.literal("delivered"), v.literal("cancelled")),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_refNo", ["refNo"])
    .index("by_status", ["status"])
    .index("by_purchaseOrderId", ["purchaseOrderId"])
    .index("by_siteId_status", ["siteId", "status"]),

  // Goods Receipt Note — Auto-generated when delivery is confirmed. Never submitted as a form; the confirming user supplies photos only.
  grn: defineTable({
    refNo: v.string(),
    purchaseOrderId: v.id("purchase_order"),
    deliveryChallanId: v.id("delivery_challan"),
    vendorId: v.id("vendors"),
    siteId: v.optional(v.id("sites")),
    receivedItems: v.array(
      v.object({
        itemName: v.string(),
        expectedQty: v.number(),
        receivedQty: v.number(),
        unit: v.string(),
      })
    ),
    photos: v.array(v.id("_storage")),
    invoiceNumber: v.optional(v.string()),
    poCreatedAt: v.optional(v.string()),
    deliveredAt: v.string(),
    confirmedBy: v.id("users"),
    remarks: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_refNo", ["refNo"])
    .index("by_purchaseOrderId", ["purchaseOrderId"])
    .index("by_siteId", ["siteId"])
    .index("by_deliveredAt", ["deliveredAt"]),

  // Inventory — Stock levels on site and in the office warehouse. DEFERRED TO SPRINT 2.
  inventory: defineTable({
    itemName: v.string(),
    category: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    siteId: v.optional(v.id("sites")),
    location: v.optional(v.string()),
    reorderLevel: v.optional(v.number()),
    lastUpdated: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_itemName", ["itemName"])
    .index("by_siteId", ["siteId"])
    .index("by_category", ["category"]),

  // Audit Log — One row per state transition. Written exclusively by the transition() helper; never edited or deleted.
  logs: defineTable({
    actorId: v.id("users"),
    actorRole: v.union(v.literal("admin"), v.literal("project_manager"), v.literal("procurement_officer"), v.literal("site_supervisor")),
    action: v.string(),
    documentType: v.union(v.literal("material_request"), v.literal("rfq"), v.literal("cost_comparison"), v.literal("purchase_order"), v.literal("delivery_challan"), v.literal("grn"), v.literal("vendors"), v.literal("users"), v.literal("projects")),
    documentId: v.string(),
    referenceId: v.string(),
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    note: v.optional(v.string()),
    timestamp: v.string(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_documentType_documentId", ["documentType", "documentId"])
    .index("by_actorId", ["actorId"])
    .index("by_referenceId", ["referenceId"]),

  // Material Request — Raised by a Site Supervisor (or a Project Manager, in which case it is auto-approved) for materials at a site.
  material_request: defineTable({
    refNo: v.string(),
    projectId: v.id("projects"),
    siteId: v.optional(v.id("sites")),
    items: v.array(
      v.object({
        itemName: v.string(),
        description: v.optional(v.string()),
        hsnSacCode: v.optional(v.string()),
        quantity: v.number(),
        unit: v.string(),
        projectItemId: v.optional(v.id("project_items")),
      })
    ),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent")),
    requiredBy: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("pending"), v.literal("queried"), v.literal("rejected"), v.literal("ready_for_cc"), v.literal("review_cc"), v.literal("ready_for_po"), v.literal("review_po"), v.literal("pending_po"), v.literal("delivery_processing"), v.literal("delivered")),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_refNo", ["refNo"])
    .index("by_status", ["status"])
    .index("by_siteId_status", ["siteId", "status"])
    .index("by_createdBy_status", ["createdBy", "status"])
    .index("by_projectId", ["projectId"]),

  // Project Item (BOQ) — A line on the project's master tender / BOQ item list.
  project_items: defineTable({
    projectId: v.id("projects"),
    itemName: v.string(),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    unit: v.string(),
    boqQty: v.number(),
    procuredQty: v.number(),
    committedQty: v.optional(v.number()),
    estimatedRate: v.optional(v.number()),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_projectId", ["projectId"])
    .index("by_projectId_category", ["projectId", "category"]),

  // Project — A construction project / tender under which sites and BOQ items live.
  projects: defineTable({
    name: v.string(),
    code: v.string(),
    client: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    tenderFileId: v.optional(v.id("_storage")),
    status: v.union(v.literal("active"), v.literal("on_hold"), v.literal("closed")),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  // Purchase Order — Formal order to the selected vendor. Line items are snapshotted from the approved cost comparison.
  purchase_order: defineTable({
    refNo: v.string(),
    costComparisonId: v.optional(v.id("cost_comparison")),
    materialRequestId: v.optional(v.id("material_request")),
    vendorId: v.id("vendors"),
    projectId: v.id("projects"),
    siteId: v.optional(v.id("sites")),
    lineItems: v.array(
      v.object({
        itemName: v.string(),
        quantity: v.number(),
        unit: v.string(),
        hsnSacCode: v.optional(v.string()),
        rate: v.number(),
        amount: v.number(),
        projectItemId: v.optional(v.id("project_items")),
        isUnquotedAddition: v.optional(v.boolean()),
        additionReason: v.optional(v.string()),
      })
    ),
    subtotal: v.number(),
    freight: v.optional(v.number()),
    taxRate: v.number(),
    taxAmount: v.number(),
    totalAmount: v.number(),
    placeOfSupplyStateCode: v.optional(v.string()),
    siteContactPerson: v.optional(v.string()),
    siteContactPhone: v.optional(v.string()),
    unloadingScope: v.optional(v.union(v.literal("buyer_scope"), v.literal("vendor_scope"))),
    freightTerms: v.optional(v.union(v.literal("inclusive_in_rate"), v.literal("extra_at_actuals"), v.literal("fixed_freight"), v.literal("to_pay_by_site"))),
    procurementNotes: v.optional(v.string()),
    paymentTerms: v.union(v.literal("advance"), v.literal("on_delivery"), v.literal("7_days"), v.literal("15_days"), v.literal("30_days"), v.literal("45_days")),
    expectedDelivery: v.optional(v.string()),
    validUntil: v.optional(v.string()),
    termsAndConditions: v.optional(v.string()),
    tcTemplateId: v.optional(v.id("tc_templates")),
    deliveredQty: v.optional(v.number()),
    pendingQty: v.optional(v.number()),
    pdfFileId: v.optional(v.id("_storage")),
    status: v.union(v.literal("draft"), v.literal("submitted"), v.literal("queried"), v.literal("rejected"), v.literal("approved"), v.literal("cancelled"), v.literal("closed")),
    cancellationReason: v.optional(v.string()),
    closureType: v.optional(v.union(v.literal("cancelled"), v.literal("short_closed"), v.literal("fully_received"))),
    reviewNote: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_refNo", ["refNo"])
    .index("by_status", ["status"])
    .index("by_vendorId", ["vendorId"])
    .index("by_projectId_status", ["projectId", "status"])
    .index("by_siteId_status", ["siteId", "status"])
    .index("by_costComparisonId", ["costComparisonId"]),

  // Request for Quotation — Sent to vendors to collect quotes. DEFERRED TO SPRINT 2 — contract defined now so the schema is stable.
  rfq: defineTable({
    refNo: v.string(),
    materialRequestId: v.optional(v.id("material_request")),
    projectItemIds: v.optional(v.array(v.id("project_items"))),
    vendorIds: v.array(v.id("vendors")),
    items: v.array(
      v.object({
        itemName: v.string(),
        quantity: v.number(),
        unit: v.string(),
        projectItemId: v.optional(v.id("project_items")),
        remarks: v.optional(v.string()),
      })
    ),
    sentVia: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("manual"))),
    sentAt: v.optional(v.string()),
    responseByDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("submitted"), v.literal("queried"), v.literal("rejected"), v.literal("approved")),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_refNo", ["refNo"])
    .index("by_status", ["status"])
    .index("by_materialRequestId", ["materialRequestId"]),

  // Session — User sessions for native auth.
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  // System Settings — Single-document system-wide configuration row. Controls approval chain behavior across the platform and company profile.
  settings: defineTable({
    requireManagerApprovalForRequests: v.boolean(),
    companyName: v.optional(v.string()),
    companyGstNo: v.optional(v.string()),
    companyBillingAddress: v.optional(v.string()),
    companyContactPerson: v.optional(v.string()),
    companyPhone: v.optional(v.string()),
    companyEmail: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }),

  // Site — A physical construction site belonging to a project.
  sites: defineTable({
    name: v.string(),
    code: v.string(),
    projectId: v.id("projects"),
    address: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_projectId", ["projectId"])
    .index("by_projectId_code", ["projectId", "code"])
    .index("by_projectId_isActive", ["projectId", "isActive"]),

  // Terms & Conditions Template — Admin-managed procurement terms templates.
  tc_templates: defineTable({
    name: v.string(),
    content: v.string(),
    isDefault: v.optional(v.boolean()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_isActive", ["isActive"])
    .index("by_isDefault", ["isDefault"]),

  // User — A person with access to the system. Created by Admin only; there is no self-registration.
  users: defineTable({
    name: v.string(),
    username: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("project_manager"), v.literal("procurement_officer"), v.literal("site_supervisor")),
    phone: v.optional(v.string()),
    assignedProjectIds: v.optional(v.array(v.id("projects"))),
    assignedSiteIds: v.optional(v.array(v.id("sites"))),
    isActive: v.boolean(),
    authAccountId: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_username", ["username"])
    .index("by_role", ["role"])
    .index("by_isActive", ["isActive"]),

  // Vendor — A supplier in the vendor master.
  vendors: defineTable({
    name: v.string(),
    contactPerson: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    gstNo: v.optional(v.string()),
    address: v.optional(v.string()),
    category: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .index("by_isActive", ["isActive"]),
});
