/**
 * @fileoverview Delivery Challan (DC) backend operations, multi-DC dispatch, and lifecycle.
 *
 * Full pipeline:
 * Create DC against an approved Purchase Order (auto-populating vendor, site, items) →
 * Dispatched with Vehicle & Driver details →
 * Status set to `delivery_processing` (MR also transitions to `delivery_processing`) →
 * Site Supervisor sees incoming shipment as "Out for Delivery" →
 * Supports Partial Deliveries: multiple DCs per PO with remaining balance tracking.
 */

import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { getCurrentUser } from "./rbac";
import { transition } from "./transition";
import { Id, Doc } from "./_generated/dataModel";
import { resolveCallerScope, filterScopedList, assertDocumentAccess, queryScopedByIndex } from "./scoping";

/**
 * Generates monotonic reference number: DC-YYYY-NNNN
 */
async function generateDCRefNo(ctx: MutationCtx): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `DC-${currentYear}-`;

  const allDCs = await ctx.db.query("delivery_challan").collect();
  let maxSeq = 0;

  for (const dc of allDCs) {
    if (dc.refNo && dc.refNo.startsWith(prefix)) {
      const numPart = parseInt(dc.refNo.replace(prefix, ""), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Create and dispatch a Delivery Challan against an approved Purchase Order.
 * Snapshots vendor, site, and dispatched quantities.
 * Strictly validates against remaining ordered quantities to prevent over-delivery.
 */
export const createDC = mutation({
  args: {
    purchaseOrderId: v.id("purchase_order"),
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
    dispatchDate: v.string(),
    expectedArrival: v.string(),
    notes: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "delivery_challans:create",
      args.token
    );

    // 1. Fetch & validate PO
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) {
      throw new Error("Purchase order not found.");
    }

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, po, po.refNo);

    if (po.status !== "approved") {
      throw new Error(
        `Cannot dispatch delivery for unapproved PO. Current PO status is "${po.status}".`
      );
    }

    // 2. Validate Vehicle & Driver inputs
    const vehicleNoClean = args.vehicleNo.trim().toUpperCase();
    if (!/^[A-Z0-9\-\s]{4,20}$/.test(vehicleNoClean)) {
      throw new Error("Invalid vehicle number format. Expected 4-20 alphanumeric characters (e.g. MH-12-AB-1234).");
    }

    const driverNameClean = args.driverName.trim();
    if (driverNameClean.length < 2 || driverNameClean.length > 120) {
      throw new Error("Driver name must be between 2 and 120 characters.");
    }

    if (args.dispatchedItems.length === 0) {
      throw new Error("At least one dispatched item is required.");
    }

    // 3. Fetch existing active DCs and completed GRNs to accurately compute remaining dispatchable quantity
    const existingDCs = await ctx.db
      .query("delivery_challan")
      .withIndex("by_purchaseOrderId", (q) => q.eq("purchaseOrderId", po._id))
      .collect();
    const activeDCs = existingDCs.filter((d) => d.status !== "cancelled");
    const inTransitDCs = activeDCs.filter((d) => d.status === "delivery_processing");

    const poGRNs = await ctx.db
      .query("grn")
      .withIndex("by_purchaseOrderId", (q) => q.eq("purchaseOrderId", po._id))
      .collect();

    let isPartialDispatch = false;

    // Filter to only items being dispatched in this trip (dispatchedQty > 0)
    const validDispatchedItems = args.dispatchedItems.filter((item) => item.dispatchedQty > 0);
    if (validDispatchedItems.length === 0) {
      throw new Error("At least one item must have a dispatched quantity greater than zero.");
    }

    // Check dispatched quantities per item against remaining ordered quantities
    for (const item of validDispatchedItems) {
      const poItem = po.lineItems.find((pi) => pi.itemName === item.itemName);
      if (!poItem) {
        throw new Error(`Item "${item.itemName}" is not part of Purchase Order ${po.refNo}.`);
      }

      const inTransitQty = inTransitDCs.reduce((sum, d) => {
        const di = d.dispatchedItems?.find((i) => i.itemName === item.itemName);
        return sum + (di?.dispatchedQty || 0);
      }, 0);

      const receivedQty = poGRNs.reduce((sum, grn) => {
        const ri = grn.receivedItems?.find((r) => r.itemName === item.itemName);
        return sum + (ri?.receivedQty || 0);
      }, 0);

      const remainingDispatchAllowed = Math.max(0, poItem.quantity - (receivedQty + inTransitQty));

      // Strict enforcement: Over-delivery / over-dispatch is NOT allowed
      if (item.dispatchedQty > remainingDispatchAllowed) {
        throw new Error(
          `Cannot dispatch ${item.dispatchedQty} ${item.unit} of "${item.itemName}". Remaining dispatch balance is ${remainingDispatchAllowed} ${item.unit} (Ordered: ${poItem.quantity}, Received: ${receivedQty}, In Transit: ${inTransitQty}). Over-delivery is not allowed.`
        );
      }

      if (receivedQty + inTransitQty + item.dispatchedQty < poItem.quantity) {
        isPartialDispatch = true;
      }
    }

    const now = new Date().toISOString();
    const refNo = await generateDCRefNo(ctx);

    // 4. Insert Delivery Challan row with status `delivery_processing`
    const dcId = await ctx.db.insert("delivery_challan", {
      refNo,
      purchaseOrderId: po._id,
      vendorId: po.vendorId,
      siteId: po.siteId || undefined,
      vehicleNo: vehicleNoClean,
      driverName: driverNameClean,
      driverPhone: args.driverPhone?.trim() || undefined,
      dispatchedItems: validDispatchedItems,
      isPartial: isPartialDispatch,
      dispatchDate: args.dispatchDate || now.split("T")[0],
      expectedArrival: args.expectedArrival || now.split("T")[0],
      notes: args.notes?.trim() || undefined,
      status: "delivery_processing",
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    // 5. Log DC creation
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "create_and_dispatch_dc",
      documentType: "delivery_challan",
      documentId: dcId,
      referenceId: refNo,
      toStatus: "delivery_processing",
      note: `Delivery Challan ${refNo} (${isPartialDispatch ? "Partial Dispatch" : "Full Dispatch"}) dispatched for PO ${po.refNo} via ${vehicleNoClean} (Driver: ${driverNameClean})`,
      timestamp: now,
    });

    // 6. Update parent Material Request status to `delivery_processing` (if not already)
    if (po.materialRequestId) {
      const mr = await ctx.db.get(po.materialRequestId);
      if (mr && mr.status !== "delivery_processing" && mr.status !== "delivered") {
        await transition(ctx, {
          table: "material_request",
          documentId: mr._id,
          from: ["pending_po", "ready_for_po"],
          to: "delivery_processing",
          action: "material_requests:advance_on_dc",
          token: args.token,
          note: `Shipment dispatched under DC ${refNo}. Out for site delivery.`,
        });
      }
    }

    return {
      id: dcId,
      refNo,
      status: "delivery_processing",
      isPartial: isPartialDispatch,
    };
  },
});

/**
 * List all delivery challans with enriched references (PO, Vendor, Site, Creator).
 */
export const listDCs = query({
  args: {
    siteId: v.optional(v.id("sites")),
    status: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    // Indexed range query — no full DC table scan
    const statusArg = args.status && args.status !== "all" ? args.status : undefined;
    let dcs = await queryScopedByIndex<any>(
      ctx,
      "delivery_challan",
      scope,
      {
        statusFilter: statusArg,
        hasProjectIdStatusIndex: false,
        hasSiteIdStatusIndex: true,  // schema has by_siteId_status
        hasProjectIdIndex: false,
        hasSiteIdIndex: false,
      }
    );

    if (args.siteId) {
      dcs = dcs.filter((d) => String(d.siteId) === String(args.siteId));
    }

    // Sort newest first
    dcs.sort((a, b) => b._creationTime - a._creationTime);

    // Enrich with relations
    const enriched = await Promise.all(
      dcs.map(async (dc) => {
        const [po, vendor, site, creator] = await Promise.all([
          ctx.db.get(dc.purchaseOrderId as Id<"purchase_order">),
          ctx.db.get(dc.vendorId as Id<"vendors">),
          dc.siteId ? ctx.db.get(dc.siteId as Id<"sites">) : null,
          ctx.db.get(dc.createdBy as Id<"users">),
        ]);

        return {
          ...dc,
          poRefNo: (po as any)?.refNo || "Unknown PO",
          poStatus: (po as any)?.status || "unknown",
          materialRequestId: (po as any)?.materialRequestId,
          vendorName: (vendor as any)?.name || "Unknown Vendor",
          vendorPhone: (vendor as any)?.phone,
          siteName: (site as any)?.name || "Unknown Site",
          createdByName: (creator as any)?.name || "Unknown User",
          itemCount: dc.dispatchedItems.length,
          totalQty: dc.dispatchedItems.reduce((sum: number, item: any) => sum + item.dispatchedQty, 0),
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single delivery challan with all relations and lineage.
 */
export const getDC = query({
  args: {
    id: v.id("delivery_challan"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    const dc = await ctx.db.get(args.id);
    if (!dc) return null;

    // Assert caller access
    assertDocumentAccess(scope, dc, dc.refNo);

    const [po, vendor, site, creator] = await Promise.all([
      ctx.db.get(dc.purchaseOrderId),
      ctx.db.get(dc.vendorId),
      dc.siteId ? (ctx.db.get(dc.siteId) as Promise<Doc<"sites"> | null>) : Promise.resolve(null),
      ctx.db.get(dc.createdBy) as Promise<Doc<"users"> | null>,
    ]);

    // Check if GRN exists for this DC
    const grn = await ctx.db
      .query("grn")
      .filter((q) => q.eq(q.field("deliveryChallanId"), dc._id))
      .first();

    return {
      ...dc,
      po,
      vendor,
      site,
      creator,
      grn: grn
        ? {
            id: grn._id,
            refNo: grn.refNo,
            deliveredAt: grn.deliveredAt,
            confirmedBy: grn.confirmedBy,
          }
        : null,
    };
  },
});

/**
 * List approved Purchase Orders ready for Delivery Challan dispatch,
 * including partially dispatched POs with remaining balance.
 */
export const listApprovedPOsForDispatch = query({
  args: {
    siteId: v.optional(v.id("sites")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    // Fetch approved POs
    const allApprovedPOs = await ctx.db
      .query("purchase_order")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    // Enforce scoping
    const approvedPOs = filterScopedList(scope, allApprovedPOs);

    // Fetch all active DCs
    const allDCs = await ctx.db.query("delivery_challan").collect();
    const activeDCs = allDCs.filter((dc) => dc.status !== "cancelled");

    // Fetch all GRNs
    const allGRNs = await ctx.db.query("grn").collect();

    // Enrich with remaining dispatch balances
    const enriched = await Promise.all(
      approvedPOs.map(async (po) => {
        const [vendor, site, project] = await Promise.all([
          ctx.db.get(po.vendorId),
          po.siteId ? (ctx.db.get(po.siteId) as Promise<Doc<"sites"> | null>) : Promise.resolve(null),
          ctx.db.get(po.projectId),
        ]);

        const poDCs = activeDCs.filter((dc) => dc.purchaseOrderId === po._id);
        const poGRNs = allGRNs.filter((grn) => grn.purchaseOrderId === po._id);

        let totalOrderedQty = 0;
        let totalDispatchedQty = 0;
        let totalReceivedQty = 0;

        const lineItemsWithDispatch = po.lineItems.map((item) => {
          const orderedQty = item.quantity || 0;
          totalOrderedQty += orderedQty;

          const inTransitQty = poDCs
            .filter((dc) => dc.status === "delivery_processing")
            .reduce((sum, dc) => {
              const di = dc.dispatchedItems?.find((d) => d.itemName === item.itemName);
              return sum + (di?.dispatchedQty || 0);
            }, 0);

          const alreadyDispatchedQty = poDCs.reduce((sum, dc) => {
            const di = dc.dispatchedItems?.find((d) => d.itemName === item.itemName);
            return sum + (di?.dispatchedQty || 0);
          }, 0);
          totalDispatchedQty += alreadyDispatchedQty;

          const alreadyReceivedQty = poGRNs.reduce((sum, grn) => {
            const ri = grn.receivedItems?.find((r) => r.itemName === item.itemName);
            return sum + (ri?.receivedQty || 0);
          }, 0);
          totalReceivedQty += alreadyReceivedQty;

          const remainingDispatchQty = Math.max(
            0,
            orderedQty - (alreadyReceivedQty + inTransitQty)
          );
          const remainingReceiveQty = Math.max(0, orderedQty - alreadyReceivedQty);

          return {
            ...item,
            orderedQty,
            alreadyDispatchedQty,
            alreadyReceivedQty,
            remainingDispatchQty,
            remainingReceiveQty,
          };
        });

        const totalRemainingDispatchQty = lineItemsWithDispatch.reduce(
          (sum, item) => sum + item.remainingDispatchQty,
          0
        );
        const totalPendingReceiveQty = Math.max(0, totalOrderedQty - totalReceivedQty);
        const isPartiallyDispatched = totalDispatchedQty > 0 && totalRemainingDispatchQty > 0;
        const isFullyDispatched = totalRemainingDispatchQty === 0;

        return {
          ...po,
          vendorName: vendor?.name || "Unknown Vendor",
          siteName: site?.name || "Unknown Site",
          projectName: project?.name || "Unknown Project",
          lineItemsWithDispatch,
          totalOrderedQty,
          totalDispatchedQty,
          totalReceivedQty,
          totalRemainingDispatchQty,
          totalPendingReceiveQty,
          isPartiallyDispatched,
          isFullyDispatched,
          dcCount: poDCs.length,
          grnCount: poGRNs.length,
        };
      })
    );

    // Only return POs that still have remaining items to dispatch
    let filtered = enriched.filter((po) => po.totalRemainingDispatchQty > 0);
    if (args.siteId) {
      filtered = filtered.filter((po) => po.siteId === args.siteId);
    }

    return filtered;
  },
});

/**
 * Get comprehensive multi-DC and multi-GRN delivery ledger for a Purchase Order.
 */
export const getPODispatchLedger = query({
  args: {
    purchaseOrderId: v.id("purchase_order"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) return null;

    // Assert caller access
    assertDocumentAccess(scope, po, po.refNo);

    const [vendor, site, project] = await Promise.all([
      ctx.db.get(po.vendorId),
      po.siteId ? (ctx.db.get(po.siteId) as Promise<Doc<"sites"> | null>) : Promise.resolve(null),
      ctx.db.get(po.projectId),
    ]);

    const dcs = await ctx.db
      .query("delivery_challan")
      .withIndex("by_purchaseOrderId", (q) => q.eq("purchaseOrderId", po._id))
      .collect();

    const grns = await ctx.db
      .query("grn")
      .withIndex("by_purchaseOrderId", (q) => q.eq("purchaseOrderId", po._id))
      .collect();

    const activeDCs = dcs.filter((d) => d.status !== "cancelled");

    let totalOrdered = 0;
    let totalDispatched = 0;
    let totalReceived = 0;

    const itemsLedger = po.lineItems.map((item) => {
      const ordered = item.quantity || 0;
      totalOrdered += ordered;

      const dispatched = activeDCs.reduce((sum, dc) => {
        const di = dc.dispatchedItems?.find((d) => d.itemName === item.itemName);
        return sum + (di?.dispatchedQty || 0);
      }, 0);
      totalDispatched += dispatched;

      const received = grns.reduce((sum, grn) => {
        const ri = grn.receivedItems?.find((r) => r.itemName === item.itemName);
        return sum + (ri?.receivedQty || 0);
      }, 0);
      totalReceived += received;

      return {
        itemName: item.itemName,
        unit: item.unit,
        orderedQty: ordered,
        dispatchedQty: dispatched,
        receivedQty: received,
        pendingDispatchQty: Math.max(0, ordered - dispatched),
        pendingReceiveQty: Math.max(0, ordered - received),
        isFullyDispatched: dispatched >= ordered,
        isFullyReceived: received >= ordered,
      };
    });

    const isFullyReceived = itemsLedger.every((i) => i.isFullyReceived);
    const isFullyDispatched = itemsLedger.every((i) => i.isFullyDispatched);

    return {
      po: {
        _id: po._id,
        refNo: po.refNo,
        status: po.status,
        deliveredQty: po.deliveredQty,
        pendingQty: po.pendingQty,
        vendorName: vendor?.name || "Unknown Vendor",
        siteName: site?.name || "Unknown Site",
        projectName: project?.name || "Unknown Project",
      },
      itemsLedger,
      dcs: dcs.map((d) => ({
        _id: d._id,
        refNo: d.refNo,
        vehicleNo: d.vehicleNo,
        driverName: d.driverName,
        driverPhone: d.driverPhone,
        dispatchDate: d.dispatchDate,
        expectedArrival: d.expectedArrival,
        status: d.status,
        isPartial: d.isPartial,
        dispatchedItems: d.dispatchedItems,
        _creationTime: d._creationTime,
      })),
      grns: grns.map((g) => ({
        _id: g._id,
        refNo: g.refNo,
        deliveredAt: g.deliveredAt,
        receivedItems: g.receivedItems,
        photoCount: g.photos?.length || 0,
      })),
      summary: {
        totalOrdered,
        totalDispatched,
        totalReceived,
        pendingDispatch: Math.max(0, totalOrdered - totalDispatched),
        pendingReceive: Math.max(0, totalOrdered - totalReceived),
        isFullyDispatched,
        isFullyReceived,
      },
    };
  },
});

/**
 * Cancel a Delivery Challan.
 */
export const cancelDC = mutation({
  args: {
    id: v.id("delivery_challan"),
    note: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "delivery_challans:cancel",
      args.token
    );

    const dc = await ctx.db.get(args.id);
    if (!dc) throw new Error("Delivery Challan not found.");

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, dc, dc.refNo);

    if (dc.status === "delivered") {
      throw new Error("Cannot cancel an already delivered challan.");
    }

    return await transition(ctx, {
      table: "delivery_challan",
      documentId: args.id,
      from: ["draft", "delivery_processing"],
      to: "cancelled",
      action: "delivery_challans:cancel",
      token: args.token,
      note: args.note,
    });
  },
});
