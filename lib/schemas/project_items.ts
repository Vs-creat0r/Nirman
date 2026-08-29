// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Project Item (BOQ) — editable form fields only. Read-only and generated fields are excluded. */
export const project_itemsSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  itemName: z.string().min(1, "Item is required").max(180, "Item is too long"),
  category: z.enum(["cement", "steel", "aggregates", "consumables", "electrical", "plumbing", "finishes", "other"]).optional(),
  subcategory: z.string().max(100, "Subcategory is too long").optional(),
  unit: z.enum(["bags", "MT", "kg", "nos", "cum", "brass", "sqm", "ltr", "rmt"]),
  boqQty: z.coerce.number().min(0, "BOQ quantity must be at least 0"),
  estimatedRate: z.coerce.number().min(0, "Estimated rate must be at least 0").optional(),
  description: z.string().max(600, "Description is too long").optional(),
});

export type ProjectItemsInput = z.infer<typeof project_itemsSchema>;
