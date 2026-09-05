// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import type { CascadeRule, TransitionDef } from "./types";

export type MaterialRequestState = "draft" | "pending" | "queried" | "rejected" | "ready_for_cc" | "routed_to_rfq" | "routed_to_cc" | "review_cc" | "ready_for_po" | "review_po" | "pending_po" | "delivery_processing" | "delivered";

export const MATERIAL_REQUEST_INITIAL_STATE: MaterialRequestState = "draft";

export const MATERIAL_REQUEST_STATES = {
  draft: { kind: "editable", owner: "creator", terminal: false, badge: { label: "Draft", variant: "secondary" } },
  pending: { kind: "locked", owner: "none", terminal: false, badge: { label: "Pending", variant: "default" } },
  queried: { kind: "editable", owner: "creator", terminal: false, badge: { label: "Queried", variant: "destructive" } },
  rejected: { kind: "closed", owner: "none", terminal: true, badge: { label: "Rejected", variant: "destructive" } },
  ready_for_cc: { kind: "locked", owner: "none", terminal: false, badge: { label: "Approved / Ready for CC", variant: "default" } },
  routed_to_rfq: { kind: "locked", owner: "none", terminal: false, badge: { label: "Routed to RFQ", variant: "default" } },
  routed_to_cc: { kind: "locked", owner: "none", terminal: false, badge: { label: "Routed to CC", variant: "default" } },
  review_cc: { kind: "locked", owner: "none", terminal: false, badge: { label: "Review CC", variant: "default" } },
  ready_for_po: { kind: "locked", owner: "none", terminal: false, badge: { label: "Ready for PO", variant: "default" } },
  review_po: { kind: "locked", owner: "none", terminal: false, badge: { label: "Review PO", variant: "default" } },
  pending_po: { kind: "locked", owner: "none", terminal: false, badge: { label: "PO Issued", variant: "default" } },
  delivery_processing: { kind: "in_transit", owner: "none", terminal: false, badge: { label: "In Delivery", variant: "default" } },
  delivered: { kind: "closed", owner: "none", terminal: true, badge: { label: "Delivered", variant: "default" } },
} as const;

export const MATERIAL_REQUEST_OPEN_STATES: readonly MaterialRequestState[] = ["draft", "pending", "queried", "ready_for_cc", "routed_to_rfq", "routed_to_cc", "review_cc", "ready_for_po", "review_po", "pending_po", "delivery_processing"] as const;

export const MATERIAL_REQUEST_CLOSED_STATES: readonly MaterialRequestState[] = ["rejected", "delivered"] as const;

export const MATERIAL_REQUEST_EDITABLE_STATES: readonly MaterialRequestState[] = ["draft", "queried"] as const;

export const MATERIAL_REQUEST_LOCKED_STATES: readonly MaterialRequestState[] = ["pending", "ready_for_cc", "routed_to_rfq", "routed_to_cc", "review_cc", "ready_for_po", "review_po", "pending_po"] as const;

export const MATERIAL_REQUEST_TRANSITIONS = [
  {
    name: "submit",
    label: "Submit Request",
    from: ["draft", "queried"] as const,
    to: "pending",
    roles: ["site_supervisor", "project_manager", "admin"] as const,
    actor: "creator",
    guards: ["hasAtLeastOneItem"] as const,
  },
  {
    name: "approve",
    label: "Approve Request",
    from: ["pending"] as const,
    to: "ready_for_cc",
    roles: ["project_manager", "admin"] as const,
    actor: "approver",
  },
  {
    name: "reject",
    label: "Reject Request",
    from: ["pending"] as const,
    to: "rejected",
    roles: ["project_manager", "admin"] as const,
    actor: "approver",
    requiresNote: true,
  },
  {
    name: "query",
    label: "Query Request",
    from: ["pending"] as const,
    to: "queried",
    roles: ["project_manager", "admin"] as const,
    actor: "approver",
    requiresNote: true,
  },
  {
    name: "resubmit",
    label: "Resubmit Request",
    from: ["draft", "queried"] as const,
    to: "pending",
    roles: ["site_supervisor", "project_manager", "admin"] as const,
    actor: "creator",
    guards: ["hasAtLeastOneItem"] as const,
  },
  {
    name: "send_to_rfq",
    label: "Send to RFQ",
    from: ["ready_for_cc"] as const,
    to: "routed_to_rfq",
    roles: ["project_manager", "procurement_officer", "admin"] as const,
  },
  {
    name: "send_to_cc",
    label: "Send to CC",
    from: ["ready_for_cc"] as const,
    to: "routed_to_cc",
    roles: ["project_manager", "procurement_officer", "admin"] as const,
  },
  {
    name: "review_on_cc",
    label: "Move to CC Review",
    from: ["ready_for_cc", "routed_to_rfq", "routed_to_cc", "review_cc"] as const,
    to: "review_cc",
    roles: ["procurement_officer", "project_manager", "admin"] as const,
  },
  {
    name: "advance_on_cc_approval",
    label: "Advance to PO Ready",
    from: ["review_cc"] as const,
    to: "ready_for_po",
    roles: ["project_manager", "admin"] as const,
  },
  {
    name: "reset_on_cc_reject",
    label: "Reset to CC Ready",
    from: ["review_cc"] as const,
    to: "ready_for_cc",
    roles: ["project_manager", "admin"] as const,
  },
  {
    name: "review_on_po",
    label: "Move to PO Review",
    from: ["ready_for_po", "review_po"] as const,
    to: "review_po",
    roles: ["procurement_officer", "project_manager", "admin"] as const,
  },
  {
    name: "advance_on_po_approval",
    label: "Advance to Pending PO",
    from: ["review_po", "ready_for_po"] as const,
    to: "pending_po",
    roles: ["project_manager", "admin"] as const,
  },
  {
    name: "reset_on_po_reject",
    label: "Reset to PO Ready",
    from: ["review_po", "pending_po"] as const,
    to: "ready_for_po",
    roles: ["project_manager", "admin"] as const,
  },
  {
    name: "advance_on_dc",
    label: "Advance to Delivery In Progress",
    from: ["pending_po", "ready_for_po"] as const,
    to: "delivery_processing",
    roles: ["procurement_officer", "project_manager", "admin"] as const,
  },
  {
    name: "process_delivery",
    label: "Process Delivery Receipt",
    from: ["delivery_processing", "pending_po"] as const,
    to: "delivery_processing",
    roles: ["site_supervisor", "procurement_officer", "admin"] as const,
  },
  {
    name: "close_on_receipt",
    label: "Close on Full Receipt",
    from: ["delivery_processing", "pending_po"] as const,
    to: "delivered",
    roles: ["site_supervisor", "procurement_officer", "admin"] as const,
  },
  {
    name: "close_on_short_close",
    label: "Close on Short Close",
    from: ["pending_po", "delivery_processing"] as const,
    to: "delivered",
    roles: ["project_manager", "admin"] as const,
  },
] as const satisfies readonly TransitionDef<MaterialRequestState>[];

export type MaterialRequestTransitionName = (typeof MATERIAL_REQUEST_TRANSITIONS)[number]["name"];
