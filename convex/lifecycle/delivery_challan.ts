// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

export interface CascadeRule {
  readonly table: string;
  readonly from: readonly string[];
  readonly to: string;
}

export interface TransitionDef<TState extends string = string, TRole extends string = string> {
  readonly name: string;
  readonly label?: string;
  readonly from: readonly TState[];
  readonly to: TState;
  readonly roles: readonly TRole[];
  readonly actor?: string;
  readonly guards?: readonly string[];
  readonly cascades?: readonly CascadeRule[];
  readonly requiresNote?: boolean;
}

export type DeliveryChallanState = "draft" | "delivery_processing" | "delivered" | "cancelled";

export const DELIVERY_CHALLAN_INITIAL_STATE: DeliveryChallanState = "draft";

export const DELIVERY_CHALLAN_STATES = {
  draft: { kind: "editable", owner: "creator", terminal: false, badge: { label: "Draft", variant: "secondary" } },
  delivery_processing: { kind: "in_transit", owner: "none", terminal: false, badge: { label: "In Transit", variant: "default" } },
  delivered: { kind: "closed", owner: "none", terminal: true, badge: { label: "Delivered", variant: "default" } },
  cancelled: { kind: "closed", owner: "none", terminal: true, badge: { label: "Cancelled", variant: "destructive" } },
} as const;

export const DELIVERY_CHALLAN_TRANSITIONS = [
  {
    name: "dispatch",
    label: "Dispatch Shipment",
    from: ["draft"] as const,
    to: "delivery_processing",
    roles: ["procurement_officer", "project_manager", "admin"] as const,
    actor: "creator",
    cascades: [
      { table: "material_request", from: ["pending_po", "ready_for_po"] as const, to: "delivery_processing" }
    ] as const,
  },
  {
    name: "deliver",
    label: "Confirm Delivery",
    from: ["delivery_processing"] as const,
    to: "delivered",
    roles: ["site_supervisor", "procurement_officer", "admin"] as const,
    actor: "approver",
  },
  {
    name: "cancel",
    label: "Cancel Delivery Challan",
    from: ["draft", "delivery_processing"] as const,
    to: "cancelled",
    roles: ["procurement_officer", "project_manager", "admin"] as const,
    requiresNote: true,
  },
] as const satisfies readonly TransitionDef<DeliveryChallanState>[];

export type DeliveryChallanTransitionName = (typeof DELIVERY_CHALLAN_TRANSITIONS)[number]["name"];
