// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Cost Comparison — editable form fields only. Read-only and generated fields are excluded. */
export const cost_comparisonSchema = z.object({
  materialRequestId: z.string().min(1, "Material request is required"),
  vendorQuotes: z.array(z.object({
      vendorId: z.string().min(1, "Vendor is required"),
      items: z.array(z.object({
      itemName: z.string(),
      quantity: z.coerce.number().min(0.001, "Qty must be at least 0.001"),
      unit: z.string(),
      rate: z.coerce.number().min(0, "Rate must be at least 0"),
    })),
      taxRate: z.coerce.number().min(0, "GST % must be at least 0").max(100, "GST % must be at most 100"),
      freight: z.coerce.number().min(0, "Freight must be at least 0").optional(),
      deliveryDays: z.coerce.number().min(0, "Delivery (days) must be at least 0").optional(),
      paymentTerms: z.enum(["advance", "on_delivery", "7_days", "15_days", "30_days", "45_days"]).optional(),
      quoteFileId: z.string().optional(),
      notes: z.string().max(500, "Notes is too long").optional(),
    })).min(2, "Add at least 2 vendor quotes"),
  selectedVendorId: z.string().min(1, "Selected vendor is required").optional(),
  selectionJustification: z.string().max(1000, "Justification is too long").optional(),
  reviewNote: z.string().max(1000, "Reviewer note is too long").optional(),
});

export type CostComparisonInput = z.infer<typeof cost_comparisonSchema>;

export const cost_comparisonStatuses = ["draft", "submitted", "queried", "rejected", "approved"] as const;
export type CostComparisonStatus = (typeof cost_comparisonStatuses)[number];
