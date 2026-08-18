// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Vendor — editable form fields only. Read-only and generated fields are excluded. */
export const vendorsSchema = z.object({
  name: z.string().min(2, "Vendor name is required").max(180, "Vendor name is too long"),
  contactPerson: z.string().max(120, "Contact person is too long").optional(),
  phone: z.string().regex(/^[0-9+\-\s]{7,20}$/, "Phone is not in the expected format"),
  email: z.string().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Email is not in the expected format").optional(),
  gstNo: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "GSTIN is not in the expected format").optional(),
  address: z.string().max(400, "Address is too long").optional(),
  category: z.enum(["cement", "steel", "aggregates", "consumables", "electrical", "plumbing", "finishes", "other"]).optional(),
  isActive: z.boolean(),
});

export type VendorsInput = z.infer<typeof vendorsSchema>;
