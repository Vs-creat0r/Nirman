// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Request for Quotation — editable form fields only. Read-only and generated fields are excluded. */
export const rfqSchema = z.object({
  materialRequestId: z.string().min(1, "Material request is required").optional(),
  projectItemIds: z.array(z.string()).optional(),
  vendorIds: z.array(z.string()).min(1, "Add at least 1 vendors"),
  items: z.array(z.object({
      itemName: z.string().min(1, "Item is required").max(180, "Item is too long"),
      quantity: z.coerce.number().min(0.001, "Qty must be at least 0.001"),
      unit: z.enum(["bags", "MT", "kg", "nos", "cum", "brass", "sqm", "ltr", "rmt"]),
      remarks: z.string().max(300, "Remarks is too long").optional(),
    })).min(1, "Add at least 1 items"),
  sentVia: z.enum(["whatsapp", "email", "manual"]).optional(),
  responseByDate: z.string().min(1, "Quotes needed by is required").optional(),
  notes: z.string().max(1000, "Notes is too long").optional(),
});

export type RfqInput = z.infer<typeof rfqSchema>;

export const rfqStatuses = ["draft", "submitted", "queried", "rejected", "approved"] as const;
export type RfqStatus = (typeof rfqStatuses)[number];
