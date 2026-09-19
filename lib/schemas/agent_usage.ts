// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import { z } from "zod";

/** Agent Usage — editable form fields only. Read-only and generated fields are excluded. */
export const agent_usageSchema = z.object({

});

export type AgentUsageInput = z.infer<typeof agent_usageSchema>;

export const agent_usageStatuses = [] as const;
export type AgentUsageStatus = (typeof agent_usageStatuses)[number];
