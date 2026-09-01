// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Stock Movement — editable form fields only. Read-only and generated fields are excluded. */
export const stock_movementsSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  projectId: z.string().min(1, "Project is required"),
  projectItemId: z.string().min(1, "Project Item (BOQ Line) is required").optional(),
  itemName: z.string().min(1, "Item is required").max(180, "Item is too long"),
  category: z.enum(["cement", "steel", "aggregates", "consumables", "electrical", "plumbing", "finishes", "other"]),
  unit: z.enum(["bags", "MT", "kg", "nos", "cum", "brass", "sqm", "ltr", "rmt"]),
  movementType: z.enum(["receipt", "issue", "transfer_out", "transfer_in", "return", "wastage", "adjustment", "reversal"]),
  quantity: z.coerce.number().min(0.0001, "Quantity must be at least 0.0001"),
  adjustmentDirection: z.enum(["add", "subtract"]).optional(),
  sourceType: z.enum(["grn", "manual", "transfer", "backfill"]),
  sourceId: z.string().max(100, "Source ID is too long").optional(),
  counterpartySiteId: z.string().min(1, "Counterparty Site is required").optional(),
  purpose: z.string().max(600, "Purpose is too long").optional(),
});

export type StockMovementsInput = z.infer<typeof stock_movementsSchema>;
