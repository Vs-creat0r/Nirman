// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Request for Quotation — editable form fields only. Read-only and generated fields are excluded. */
export const rfqSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  siteId: z.string().min(1, "Site is required").optional(),
  vendorIds: z.array(z.string()).min(1, "Add at least 1 invited vendors"),
  requestedItems: z.array(z.object({
      itemName: z.string().min(1, "Item is required").max(180, "Item is too long"),
      category: z.string().optional(),
      quantity: z.coerce.number().min(0.001, "Qty must be at least 0.001"),
      unit: z.enum(["bags", "MT", "kg", "nos", "cum", "brass", "sqm", "ltr", "rmt"]),
      description: z.string().max(300, "Description / Specs is too long").optional(),
    })).min(1, "Add at least 1 requested items"),
  dueDate: z.string().min(1, "Quotes Due Date is required").optional(),
  sentVia: z.enum(["whatsapp", "email", "manual"]).optional(),
  notes: z.string().max(1000, "Notes / Instructions is too long").optional(),
});

export type RfqInput = z.infer<typeof rfqSchema>;

export const rfqStatuses = ["draft", "open", "closed", "archived"] as const;
export type RfqStatus = (typeof rfqStatuses)[number];
