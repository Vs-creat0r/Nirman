/**
 * @fileoverview Goods Receipt Note (GRN) backend operations and lifecycle.
 *
 * Full pipeline:
 * Delivery arrives on site →
 * Site Supervisor confirms receipt with mandatory unloading proof photos (Convex storage) →
 * GRN is automatically generated (never a manual form from scratch) →
 * Reconciles against cumulative ordered vs received quantities across all GRNs for the PO →
 * If all line items are fully received, transitions parent Material Request to `delivered` →
 * If partially received, updates PO `deliveredQty`/`pendingQty` while keeping MR in `delivery_processing`.
 */

import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { getCurrentUser } from "./rbac";
import { transition } from "./transition";
import { Id, Doc } from "./_generated/dataModel";
import { resolveCallerScope, filterScopedList, assertDocumentAccess } from "./scoping";

/**
 * Generates monotonic reference number: GRN-YYYY-NNNN
 */
async function generateGRNRefNo(ctx: MutationCtx): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `GRN-${currentYear}-`;

  const allGRNs = await ctx.db.query("grn").collect();
  let maxSeq = 0;

  for (const grn of allGRNs) {
    if (grn.refNo && grn.refNo.startsWith(prefix)) {
      const numPart = parseInt(grn.refNo.replace(prefix, ""), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Confirms delivery receipt on site, uploads unloading photos, and auto-generates a GRN.
 * Reconciles line item received quantities and checks whether the PO is fully or partially delivered.
 * Strictly blocks over-delivery.
 */
export const confirmDeliveryAndGenerateGRN = mutation({
  args: {
    deliveryChallanId: v.id("delivery_challan"),
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
    remarks: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "grn:create",
      args.token
    );

    // 1. Validate mandatory unloading photos (D2 requirement)
    if (!args.photos || args.photos.length === 0) {
      throw new Error("Mandatory unloading proof photo is required to confirm delivery receipt.");
    }

    if (!args.receivedItems || args.receivedItems.length === 0) {
      throw new Error("At least one received line item is required.");
    }

    // 2. Fetch Delivery Challan
    const dc = await ctx.db.get(args.deliveryChallanId);
    if (!dc) {
      throw new Error("Delivery Challan not found.");
    }

    const scope = await resolveCallerScope(ctx, args.token);
    assertDocumentAccess(scope, dc, dc.refNo);

    if (dc.status === "delivered") {
      throw new Error(`Delivery Challan ${dc.refNo} has already been marked as delivered.`);
    }

    if (dc.status === "cancelled") {
      throw new Error(`Cannot receive a cancelled Delivery Challan (${dc.refNo}).`);
    }

    // 3. Fetch linked Purchase Order
    const po = await ctx.db.get(dc.purchaseOrderId);
    if (!po) {
      throw new Error("Linked Purchase Order not found.");
    }

    // 4. Strict over-delivery check: received cannot exceed dispatched
    for (const item of args.receivedItems) {
      if (item.receivedQty < 0) {
        throw new Error(`Received quantity for "${item.itemName}" cannot be negative.`);
      }

      const dcItem = dc.dispatchedItems.find((di) => di.itemName === item.itemName);
      if (!dcItem) {
        throw new Error(`Item "${item.itemName}" was not found in Delivery Challan ${dc.refNo}.`);
      }

      if (item.receivedQty > dcItem.dispatchedQty) {
        throw new Error(
          `Received quantity (${item.receivedQty} ${item.unit}) for "${item.itemName}" exceeds dispatched quantity (${dcItem.dispatchedQty} ${item.unit}) on Challan ${dc.refNo}. Over-delivery is not allowed.`
        );
      }
    }

    const now = new Date().toISOString();
    const grnRefNo = await generateGRNRefNo(ctx);

    // 5. Auto-generate and insert GRN record
    const grnId = await ctx.db.insert("grn", {
      refNo: grnRefNo,
      purchaseOrderId: po._id,
      deliveryChallanId: dc._id,
      vendorId: dc.vendorId,
      siteId: dc.siteId,
      receivedItems: args.receivedItems,
      photos: args.photos,
      invoiceNumber: args.invoiceNumber?.trim() || undefined,
      poCreatedAt: po.reviewedAt || (po._creationTime ? new Date(po._creationTime).toISOString().split("T")[0] : undefined),
      deliveredAt: now,
      confirmedBy: user._id,
      remarks: args.remarks?.trim() || undefined,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    // 6. Transition Delivery Challan status to `delivered`
    await transition(ctx, {
      table: "delivery_challan",
      documentId: dc._id,
      from: "delivery_processing",
      to: "delivered",
      action: "delivery_challans:deliver",
      token: args.token,
      note: `Delivery confirmed on site by ${user.name}. GRN ${grnRefNo} auto-generated.`,
    });

    // Log GRN generated
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "auto_generate_grn",
      documentType: "grn",
      documentId: grnId,
      referenceId: grnRefNo,
      toStatus: "delivered",
      note: `Goods Receipt Note ${grnRefNo} generated for Challan ${dc.refNo} (PO: ${po.refNo})`,
      timestamp: now,
    });

    // 7. Calculate cumulative received quantities across all GRNs for this PO
    const allPO_GRNs = await ctx.db
      .query("grn")
      .withIndex("by_purchaseOrderId", (q) => q.eq("purchaseOrderId", po._id))
      .collect();

    let totalOrderedQty = 0;
    let totalCumulativeReceivedQty = 0;

    const itemReceiptProgress = po.lineItems.map((poi) => {
      const ordered = poi.quantity || 0;
      totalOrderedQty += ordered;

      const cumReceived = allPO_GRNs.reduce((sum, grn) => {
        const ri = grn.receivedItems?.find(
          (r) => r.itemName.toLowerCase().trim() === poi.itemName.toLowerCase().trim()
        );
        return sum + (ri?.receivedQty || 0);
      }, 0);
      totalCumulativeReceivedQty += cumReceived;

      return {
        itemName: poi.itemName,
        ordered,
        cumReceived,
        isFullyReceived: cumReceived >= ordered,
      };
    });

    const isPOFullyDelivered = itemReceiptProgress.every((i) => i.isFullyReceived);
    const totalPendingQty = Math.max(0, totalOrderedQty - totalCumulativeReceivedQty);

    // 8. Update project_items counters strictly using this GRN's receipt delta [FIX-I2]
    const mr = po.materialRequestId ? await ctx.db.get(po.materialRequestId) : null;
    for (const ri of args.receivedItems) {
      if (ri.receivedQty <= 0) continue;

      // 1. Resolve through PO line item projectItemId
      const matchedPOLine = po.lineItems.find(
        (poi) => poi.itemName.toLowerCase().trim() === ri.itemName.toLowerCase().trim()
      );
      let projectItemId = matchedPOLine?.projectItemId;

      // 2. Fallback: match through parent MR items
      if (!projectItemId && mr?.items) {
        const matchedMRItem = mr.items.find(
          (m) => m.itemName.toLowerCase().trim() === ri.itemName.toLowerCase().trim()
        );
        if (matchedMRItem?.projectItemId) {
          projectItemId = matchedMRItem.projectItemId;
        }
      }

      if (projectItemId) {
        const projectItem = await ctx.db.get(projectItemId);
        if (projectItem) {
          const currentProcured = projectItem.procuredQty ?? 0;
          const currentCommitted = projectItem.committedQty ?? 0;
          const newProcured = currentProcured + ri.receivedQty;
          const newCommitted = Math.max(0, currentCommitted - ri.receivedQty);

          await ctx.db.patch(projectItemId, {
            procuredQty: newProcured,
            committedQty: newCommitted,
          });
        }
      } else {
        console.error(`[GRN Receipt] Could not resolve projectItemId for received item "${ri.itemName}"`);
      }
    }

    // 9. Update PO's deliveredQty and pendingQty
    await ctx.db.patch(po._id, {
      deliveredQty: totalCumulativeReceivedQty,
      pendingQty: totalPendingQty,
      updatedBy: user._id,
      updatedAt: now,
    });

    // 10. If all ordered items are fully received, close the procurement loop! [FIX-I4]
    if (isPOFullyDelivered) {
      if (po.materialRequestId && mr && mr.status !== "delivered") {
        await transition(ctx, {
          table: "material_request",
          documentId: mr._id,
          from: ["delivery_processing", "pending_po"],
          to: "delivered",
          action: "material_requests:close_on_receipt",
          token: args.token,
          note: `Procurement complete. All ${totalCumulativeReceivedQty}/${totalOrderedQty} items received on site across ${allPO_GRNs.length} GRN(s) (final GRN ${grnRefNo}).`,
        });
      }

      // Close the PO via transition helper
      if (po.status !== "closed") {
        await transition(ctx, {
          table: "purchase_order",
          documentId: po._id,
          from: ["approved", "submitted"],
          to: "closed",
          action: "purchase_orders:close_on_receipt",
          token: args.token,
          note: `Purchase Order ${po.refNo} fully fulfilled (${totalCumulativeReceivedQty}/${totalOrderedQty} items received across ${allPO_GRNs.length} delivery batches).`,
          patch: {
            closureType: "fully_received",
          },
        });
      }
    } else {
      // Partial delivery: MR remains in delivery_processing
      if (po.materialRequestId && mr && mr.status !== "delivery_processing") {
        await transition(ctx, {
          table: "material_request",
          documentId: mr._id,
          from: ["pending_po", "ordered", "partially_fulfilled", "delivery_processing"],
          to: "delivery_processing",
          action: "material_requests:process_delivery",
          token: args.token,
          note: `Partial delivery received on site under PO ${po.refNo} (GRN ${grnRefNo}).`,
        });
      }

      await ctx.db.insert("logs", {
        actorId: user._id,
        actorRole: user.role,
        action: "grn_partial_receipt",
        documentType: "purchase_order",
        documentId: po._id,
        referenceId: po.refNo,
        note: `Partial receipt on site (GRN ${grnRefNo}): ${totalCumulativeReceivedQty}/${totalOrderedQty} total items received to date. ${totalPendingQty} items pending next delivery batch.`,
        timestamp: now,
      });
    }

    return {
      id: grnId,
      refNo: grnRefNo,
      dcRefNo: dc.refNo,
      status: "delivered",
      isPOFullyDelivered,
      totalDeliveredQty: totalCumulativeReceivedQty,
      totalPendingQty,
    };
  },
});

/**
 * List all GRN records with enriched relations and photo counts.
 */
export const listGRNs = query({
  args: {
    siteId: v.optional(v.id("sites")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    let allGrns = await ctx.db.query("grn").collect();

    // Enforce scoping
    let grns = filterScopedList(scope, allGrns);

    if (args.siteId) {
      grns = grns.filter((g) => g.siteId === args.siteId);
    }

    // Sort newest first
    grns.sort((a, b) => new Date(b._creationTime).getTime() - new Date(a._creationTime).getTime());

    // Enrich
    const enriched = await Promise.all(
      grns.map(async (grn) => {
        const [po, dc, vendor, site, confirmedByUser] = await Promise.all([
          ctx.db.get(grn.purchaseOrderId),
          ctx.db.get(grn.deliveryChallanId),
          ctx.db.get(grn.vendorId),
          grn.siteId ? ctx.db.get(grn.siteId) : null,
          ctx.db.get(grn.confirmedBy),
        ]);

        const hasDiscrepancy = grn.receivedItems.some(
          (i) => i.receivedQty < i.expectedQty
        );

        return {
          ...grn,
          hasDiscrepancy,
          poRefNo: po?.refNo || "Unknown PO",
          poTotalAmount: po?.totalAmount,
          materialRequestId: po?.materialRequestId,
          dcRefNo: dc?.refNo || "Unknown DC",
          vehicleNo: dc?.vehicleNo || "—",
          driverName: dc?.driverName || "—",
          vendorName: vendor?.name || "Unknown Vendor",
          siteName: site && "name" in site ? site.name : "Unknown Site",
          confirmedByName:
            confirmedByUser && "name" in confirmedByUser ? confirmedByUser.name : "Unknown User",
          itemCount: grn.receivedItems.length,
          photoCount: grn.photos.length,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single GRN with full relation snapshot and file URLs.
 */
export const getGRN = query({
  args: {
    id: v.id("grn"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    const grn = await ctx.db.get(args.id);
    if (!grn) return null;

    // Assert caller access
    assertDocumentAccess(scope, grn, grn.refNo);

    const [po, dc, vendor, site, confirmedByUser] = await Promise.all([
      ctx.db.get(grn.purchaseOrderId),
      ctx.db.get(grn.deliveryChallanId),
      ctx.db.get(grn.vendorId),
      grn.siteId ? (ctx.db.get(grn.siteId) as Promise<Doc<"sites"> | null>) : Promise.resolve(null),
      ctx.db.get(grn.confirmedBy) as Promise<Doc<"users"> | null>,
    ]);

    const [mr, cc] = await Promise.all([
      po?.materialRequestId ? ctx.db.get(po.materialRequestId) : null,
      po?.costComparisonId ? ctx.db.get(po.costComparisonId) : null,
    ]);

    // Resolve photo URLs from Convex storage
    const photoUrls = await Promise.all(
      grn.photos.map(async (storageId) => {
        const url = await ctx.storage.getUrl(storageId);
        return { storageId, url };
      })
    );

    const hasDiscrepancy = grn.receivedItems.some(
      (i) => i.receivedQty < i.expectedQty
    );

    return {
      ...grn,
      hasDiscrepancy,
      po,
      dc,
      mr,
      cc,
      vendor,
      site,
      confirmedByUser,
      confirmedUser: confirmedByUser,
      photoUrls,
    };
  },
});
