// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Delivery Challan — editable form fields only. Read-only and generated fields are excluded. */
export const delivery_challanSchema = z.object({
  purchaseOrderId: z.string().min(1, "Purchase order is required"),
  vehicleNo: z.string().regex(/^[A-Z0-9\-\s]{4,20}$/, "Vehicle number is not in the expected format"),
  driverName: z.string().min(2, "Driver name is required").max(120, "Driver name is too long"),
  driverPhone: z.string().regex(/^[0-9+\-\s]{7,20}$/, "Driver contact is not in the expected format").optional(),
  dispatchedItems: z.array(z.object({
      itemName: z.string(),
      dispatchedQty: z.coerce.number().min(0.001, "Dispatching must be at least 0.001"),
      unit: z.string(),
    })).min(1, "Add at least 1 items dispatched"),
  dispatchDate: z.string().min(1, "Dispatch date is required"),
  expectedArrival: z.string().min(1, "Expected arrival is required"),
  notes: z.string().max(1000, "Notes is too long").optional(),
});

export type DeliveryChallanInput = z.infer<typeof delivery_challanSchema>;

export const delivery_challanStatuses = ["draft", "delivery_processing", "delivered", "cancelled"] as const;
export type DeliveryChallanStatus = (typeof delivery_challanStatuses)[number];
