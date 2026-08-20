// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** System Settings — editable form fields only. Read-only and generated fields are excluded. */
export const settingsSchema = z.object({
  requireManagerApprovalForRequests: z.boolean(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export const settingsStatuses = [] as const;
export type SettingsStatus = (typeof settingsStatuses)[number];
