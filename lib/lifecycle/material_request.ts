// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import type { MaterialRequestStatus } from "@/lib/schemas/material_request";

export type MaterialRequestStateKind = "editable" | "locked" | "closed" | "in_transit" | "received";

export const MATERIAL_REQUEST_OPEN_STATES: readonly MaterialRequestStatus[] = ["draft", "pending", "queried", "ready_for_cc", "review_cc", "ready_for_po", "review_po", "pending_po", "delivery_processing"] as const;

export const MATERIAL_REQUEST_CLOSED_STATES: readonly MaterialRequestStatus[] = ["rejected", "delivered"] as const;

export const MATERIAL_REQUEST_EDITABLE_STATES: readonly MaterialRequestStatus[] = ["draft", "queried"] as const;

export const MATERIAL_REQUEST_LOCKED_STATES: readonly MaterialRequestStatus[] = ["pending", "ready_for_cc", "review_cc", "ready_for_po", "review_po", "pending_po"] as const;

export const MATERIAL_REQUEST_STATUS_BADGES: Record<
  MaterialRequestStatus,
  { readonly label: string; readonly variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  pending: { label: "Pending", variant: "default" },
  queried: { label: "Queried", variant: "destructive" },
  rejected: { label: "Rejected", variant: "destructive" },
  ready_for_cc: { label: "Ready for CC", variant: "default" },
  review_cc: { label: "Review CC", variant: "default" },
  ready_for_po: { label: "Ready for PO", variant: "default" },
  review_po: { label: "Review PO", variant: "default" },
  pending_po: { label: "PO Issued", variant: "default" },
  delivery_processing: { label: "In Delivery", variant: "default" },
  delivered: { label: "Delivered", variant: "default" },
} as const;
