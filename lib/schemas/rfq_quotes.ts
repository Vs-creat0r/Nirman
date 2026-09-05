// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** RFQ Quotes — editable form fields only. Read-only and generated fields are excluded. */
export const rfq_quotesSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  itemId: z.string().optional(),
  itemName: z.string().min(1, "Item Name is required").max(180, "Item Name is too long"),
  category: z.string().optional(),
  unit: z.string(),
  quantity: z.coerce.number().min(0.001, "Quantity must be at least 0.001"),
  rate: z.coerce.number().min(0, "Rate must be at least 0"),
  taxRate: z.coerce.number().optional(),
  validityDate: z.string().min(1, "Quote Validity Date is required").optional(),
  quoteFileId: z.string().optional(),
  notes: z.string().max(1000, "Notes is too long").optional(),
});

export type RfqQuotesInput = z.infer<typeof rfq_quotesSchema>;

export const rfq_quotesStatuses = [] as const;
export type RfqQuotesStatus = (typeof rfq_quotesStatuses)[number];
