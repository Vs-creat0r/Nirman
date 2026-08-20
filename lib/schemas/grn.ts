// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Goods Receipt Note — editable form fields only. Read-only and generated fields are excluded. */
export const grnSchema = z.object({
  photos: z.array(z.string()).min(1, "Add at least 1 unloading photos"),
  invoiceNumber: z.string().max(60, "Invoice number is too long").optional(),
  remarks: z.string().max(600, "Remarks is too long").optional(),
});

export type GrnInput = z.infer<typeof grnSchema>;
