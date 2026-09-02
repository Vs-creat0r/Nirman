// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import type { PurchaseOrderStatus } from "@/lib/schemas/purchase_order";

export type PurchaseOrderStateKind = "editable" | "locked" | "closed" | "in_transit" | "received";

export const PURCHASE_ORDER_OPEN_STATES: readonly PurchaseOrderStatus[] = ["draft", "submitted", "queried", "approved"] as const;

export const PURCHASE_ORDER_CLOSED_STATES: readonly PurchaseOrderStatus[] = ["rejected", "cancelled", "closed"] as const;

export const PURCHASE_ORDER_EDITABLE_STATES: readonly PurchaseOrderStatus[] = ["draft", "queried"] as const;

export const PURCHASE_ORDER_LOCKED_STATES: readonly PurchaseOrderStatus[] = ["submitted", "approved"] as const;

export const PURCHASE_ORDER_STATUS_BADGES: Record<
  PurchaseOrderStatus,
  { readonly label: string; readonly variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  submitted: { label: "Submitted", variant: "default" },
  queried: { label: "Queried", variant: "destructive" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  closed: { label: "Closed", variant: "secondary" },
} as const;
