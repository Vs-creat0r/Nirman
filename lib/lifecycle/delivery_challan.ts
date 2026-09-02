// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import type { DeliveryChallanStatus } from "@/lib/schemas/delivery_challan";

export type DeliveryChallanStateKind = "editable" | "locked" | "closed" | "in_transit" | "received";

export const DELIVERY_CHALLAN_OPEN_STATES: readonly DeliveryChallanStatus[] = ["draft", "delivery_processing"] as const;

export const DELIVERY_CHALLAN_CLOSED_STATES: readonly DeliveryChallanStatus[] = ["delivered", "cancelled"] as const;

export const DELIVERY_CHALLAN_EDITABLE_STATES: readonly DeliveryChallanStatus[] = ["draft"] as const;

export const DELIVERY_CHALLAN_LOCKED_STATES: readonly DeliveryChallanStatus[] = [] as const;

export const DELIVERY_CHALLAN_STATUS_BADGES: Record<
  DeliveryChallanStatus,
  { readonly label: string; readonly variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  delivery_processing: { label: "In Transit", variant: "default" },
  delivered: { label: "Delivered", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
} as const;
