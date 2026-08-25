// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Terms & Conditions Template — editable form fields only. Read-only and generated fields are excluded. */
export const tc_templatesSchema = z.object({
  name: z.string(),
  content: z.string(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean(),
});

export type TcTemplatesInput = z.infer<typeof tc_templatesSchema>;
