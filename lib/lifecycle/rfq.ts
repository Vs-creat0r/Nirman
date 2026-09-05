// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import type { RfqStatus } from "@/lib/schemas/rfq";

export type RfqStateKind = "editable" | "locked" | "closed" | "in_transit" | "received";

export const RFQ_OPEN_STATES: readonly RfqStatus[] = ["draft", "open", "closed"] as const;

export const RFQ_CLOSED_STATES: readonly RfqStatus[] = ["archived"] as const;

export const RFQ_EDITABLE_STATES: readonly RfqStatus[] = ["draft"] as const;

export const RFQ_LOCKED_STATES: readonly RfqStatus[] = ["open", "closed"] as const;

export const RFQ_STATUS_BADGES: Record<
  RfqStatus,
  { readonly label: string; readonly variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  open: { label: "Open", variant: "default" },
  closed: { label: "Closed", variant: "default" },
  archived: { label: "Archived", variant: "destructive" },
} as const;
