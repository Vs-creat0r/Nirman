// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Purchase Order — editable form fields only. Read-only and generated fields are excluded. */
export const purchase_orderSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  siteId: z.string().min(1, "Deliver to site is required").optional(),
  lineItems: z.array(z.object({
      itemName: z.string(),
      quantity: z.coerce.number().min(0.001, "Qty must be at least 0.001"),
      unit: z.string(),
      hsnSacCode: z.string().max(20, "HSN/SAC Code is too long").optional(),
      rate: z.coerce.number().min(0, "Rate must be at least 0"),
      isUnquotedAddition: z.boolean().optional(),
      additionReason: z.string().max(300, "Addition reason is too long").optional(),
    })).min(1, "Add at least 1 line items"),
  freight: z.coerce.number().min(0, "Freight must be at least 0").optional(),
  taxRate: z.coerce.number().min(0, "GST % must be at least 0").max(100, "GST % must be at most 100"),
  placeOfSupplyStateCode: z.string().max(2, "Place of supply (State code) is too long").optional(),
  siteContactPerson: z.string().max(100, "Site contact person is too long").optional(),
  siteContactPhone: z.string().max(20, "Site contact phone is too long").optional(),
  unloadingScope: z.enum(["buyer_scope", "vendor_scope"]).optional(),
  freightTerms: z.enum(["inclusive_in_rate", "extra_at_actuals", "fixed_freight", "to_pay_by_site"]).optional(),
  procurementNotes: z.string().max(1000, "Procurement notes is too long").optional(),
  paymentTerms: z.enum(["advance", "on_delivery", "7_days", "15_days", "30_days", "45_days"]),
  expectedDelivery: z.string().min(1, "Expected delivery is required").optional(),
  validUntil: z.string().min(1, "Valid until is required").optional(),
  termsAndConditions: z.string().optional(),
  cancellationReason: z.string().max(1000, "Cancellation reason is too long").optional(),
  reviewNote: z.string().max(1000, "Reviewer note is too long").optional(),
});

export type PurchaseOrderInput = z.infer<typeof purchase_orderSchema>;

export const purchase_orderStatuses = ["draft", "submitted", "queried", "rejected", "approved", "cancelled", "closed"] as const;
export type PurchaseOrderStatus = (typeof purchase_orderStatuses)[number];
