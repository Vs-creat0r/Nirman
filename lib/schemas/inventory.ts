// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Inventory — editable form fields only. Read-only and generated fields are excluded. */
export const inventorySchema = z.object({
  itemName: z.string().min(1, "Item is required").max(180, "Item is too long"),
  category: z.enum(["cement", "steel", "aggregates", "consumables", "electrical", "plumbing", "finishes", "other"]).optional(),
  quantity: z.coerce.number().min(0, "Quantity must be at least 0"),
  unit: z.enum(["bags", "MT", "kg", "nos", "cum", "brass", "sqm", "ltr", "rmt"]),
  siteId: z.string().min(1, "Site is required").optional(),
  projectId: z.string().min(1, "Project is required").optional(),
  location: z.string().max(120, "Location is too long").optional(),
  reorderLevel: z.coerce.number().min(0, "Reorder level must be at least 0").optional(),
});

export type InventoryInput = z.infer<typeof inventorySchema>;
