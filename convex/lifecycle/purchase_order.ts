// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import type { CascadeRule, TransitionDef } from "./types";

export type PurchaseOrderState = "draft" | "submitted" | "queried" | "rejected" | "approved" | "cancelled" | "closed";

export const PURCHASE_ORDER_INITIAL_STATE: PurchaseOrderState = "draft";

export const PURCHASE_ORDER_STATES = {
  draft: { kind: "editable", owner: "creator", terminal: false, badge: { label: "Draft", variant: "secondary" } },
  submitted: { kind: "locked", owner: "none", terminal: false, badge: { label: "Submitted", variant: "default" } },
  queried: { kind: "editable", owner: "creator", terminal: false, badge: { label: "Queried", variant: "destructive" } },
  approved: { kind: "locked", owner: "none", terminal: false, badge: { label: "Approved", variant: "default" } },
  rejected: { kind: "closed", owner: "none", terminal: true, badge: { label: "Rejected", variant: "destructive" } },
  cancelled: { kind: "closed", owner: "none", terminal: true, badge: { label: "Cancelled", variant: "destructive" } },
  closed: { kind: "closed", owner: "none", terminal: true, badge: { label: "Closed", variant: "secondary" } },
} as const;

export const PURCHASE_ORDER_OPEN_STATES: readonly PurchaseOrderState[] = ["draft", "submitted", "queried", "approved"] as const;

export const PURCHASE_ORDER_CLOSED_STATES: readonly PurchaseOrderState[] = ["rejected", "cancelled", "closed"] as const;

export const PURCHASE_ORDER_EDITABLE_STATES: readonly PurchaseOrderState[] = ["draft", "queried"] as const;

export const PURCHASE_ORDER_LOCKED_STATES: readonly PurchaseOrderState[] = ["submitted", "approved"] as const;

export const PURCHASE_ORDER_TRANSITIONS = [
  {
    name: "submit",
    label: "Submit for Approval",
    from: ["draft", "queried"] as const,
    to: "submitted",
    roles: ["procurement_officer", "project_manager", "admin"] as const,
    actor: "creator",
    cascades: [
      { table: "material_request", from: ["ready_for_po", "review_po"] as const, to: "review_po" }
    ] as const,
  },
  {
    name: "approve",
    label: "Approve Purchase Order",
    from: ["submitted"] as const,
    to: "approved",
    roles: ["project_manager", "admin"] as const,
    actor: "approver",
    cascades: [
      { table: "material_request", from: ["review_po", "ready_for_po"] as const, to: "pending_po" }
    ] as const,
  },
  {
    name: "reject",
    label: "Reject Purchase Order",
    from: ["submitted"] as const,
    to: "rejected",
    roles: ["project_manager", "admin"] as const,
    actor: "approver",
    cascades: [
      { table: "material_request", from: ["review_po"] as const, to: "ready_for_po" }
    ] as const,
    requiresNote: true,
  },
  {
    name: "query",
    label: "Query Purchase Order",
    from: ["submitted"] as const,
    to: "queried",
    roles: ["project_manager", "admin"] as const,
    actor: "approver",
    requiresNote: true,
  },
  {
    name: "resubmit",
    label: "Resubmit Purchase Order",
    from: ["queried"] as const,
    to: "submitted",
    roles: ["procurement_officer", "project_manager", "admin"] as const,
    actor: "creator",
    cascades: [
      { table: "material_request", from: ["ready_for_po", "review_po"] as const, to: "review_po" }
    ] as const,
  },
  {
    name: "cancel",
    label: "Cancel Purchase Order",
    from: ["submitted", "approved"] as const,
    to: "cancelled",
    roles: ["project_manager", "admin"] as const,
    actor: "approver",
    cascades: [
      { table: "material_request", from: ["review_po", "pending_po"] as const, to: "ready_for_po" }
    ] as const,
    requiresNote: true,
  },
  {
    name: "close",
    label: "Close Purchase Order",
    from: ["approved"] as const,
    to: "closed",
    roles: ["project_manager", "admin"] as const,
    cascades: [
      { table: "material_request", from: ["pending_po", "delivery_processing"] as const, to: "delivered" }
    ] as const,
    requiresNote: true,
  },
  {
    name: "close_on_receipt",
    label: "Close upon Full Receipt",
    from: ["approved", "submitted"] as const,
    to: "closed",
    roles: ["site_supervisor", "procurement_officer", "admin"] as const,
    cascades: [
      { table: "material_request", from: ["delivery_processing", "pending_po"] as const, to: "delivered" }
    ] as const,
  },
] as const satisfies readonly TransitionDef<PurchaseOrderState>[];

export type PurchaseOrderTransitionName = (typeof PURCHASE_ORDER_TRANSITIONS)[number]["name"];
