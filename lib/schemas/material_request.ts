// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Material Request — editable form fields only. Read-only and generated fields are excluded. */
export const material_requestSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  siteId: z.string().min(1, "Site is required").optional(),
  items: z.array(z.object({
      itemName: z.string().min(1, "Item is required").max(180, "Item is too long"),
      description: z.string().max(300, "Description is too long").optional(),
      quantity: z.coerce.number().min(0.001, "Quantity must be at least 0.001"),
      unit: z.enum(["bags", "MT", "kg", "nos", "cum", "brass", "sqm", "ltr", "rmt"]),
    })).min(1, "Add at least 1 items"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  requiredBy: z.string().min(1, "Required by is required").optional(),
  notes: z.string().max(1000, "Notes is too long").optional(),
});

export type MaterialRequestInput = z.infer<typeof material_requestSchema>;

export const material_requestStatuses = ["draft", "pending", "queried", "rejected", "ready_for_cc", "review_cc", "ready_for_po", "review_po", "pending_po", "delivery_processing", "delivered"] as const;
export type MaterialRequestStatus = (typeof material_requestStatuses)[number];
