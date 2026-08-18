// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** User — editable form fields only. Read-only and generated fields are excluded. */
export const usersSchema = z.object({
  name: z.string().min(2, "Full name is required").max(120, "Full name is too long"),
  email: z.string().max(180, "Email is too long").regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Email is not in the expected format"),
  role: z.enum(["admin", "project_manager", "procurement_officer", "site_supervisor"]),
  phone: z.string().regex(/^[0-9+\-\s]{7,20}$/, "Phone is not in the expected format").optional(),
  assignedProjectIds: z.array(z.string()).optional(),
  assignedSiteIds: z.array(z.string()).optional(),
  isActive: z.boolean(),
});

export type UsersInput = z.infer<typeof usersSchema>;
