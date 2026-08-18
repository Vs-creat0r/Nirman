// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Site — editable form fields only. Read-only and generated fields are excluded. */
export const sitesSchema = z.object({
  name: z.string().min(2, "Site name is required").max(180, "Site name is too long"),
  code: z.string().regex(/^[A-Z0-9\-]{1,12}$/, "Site code is not in the expected format"),
  projectId: z.string().min(1, "Project is required"),
  address: z.string().max(400, "Address is too long").optional(),
  isActive: z.boolean(),
});

export type SitesInput = z.infer<typeof sitesSchema>;
