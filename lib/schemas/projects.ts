// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Project — editable form fields only. Read-only and generated fields are excluded. */
export const projectsSchema = z.object({
  name: z.string().min(2, "Project name is required").max(180, "Project name is too long"),
  code: z.string().regex(/^[A-Z0-9\-]{2,20}$/, "Project code is not in the expected format"),
  client: z.string().max(180, "Client is too long").optional(),
  startDate: z.string().min(1, "Start date is required").optional(),
  endDate: z.string().min(1, "Target completion is required").optional(),
  tenderFileId: z.string().optional(),
});

export type ProjectsInput = z.infer<typeof projectsSchema>;
