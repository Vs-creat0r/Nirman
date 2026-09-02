// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

export * from "./cost_comparison";
export * from "./delivery_challan";
export * from "./material_request";
export * from "./purchase_order";
export * from "./permissions.generated";

export const LIFECYCLE_REGISTRY = {
  cost_comparison: {
    initial: COST_COMPARISON_INITIAL_STATE,
    states: COST_COMPARISON_STATES,
    transitions: COST_COMPARISON_TRANSITIONS,
  },
  delivery_challan: {
    initial: DELIVERY_CHALLAN_INITIAL_STATE,
    states: DELIVERY_CHALLAN_STATES,
    transitions: DELIVERY_CHALLAN_TRANSITIONS,
  },
  material_request: {
    initial: MATERIAL_REQUEST_INITIAL_STATE,
    states: MATERIAL_REQUEST_STATES,
    transitions: MATERIAL_REQUEST_TRANSITIONS,
  },
  purchase_order: {
    initial: PURCHASE_ORDER_INITIAL_STATE,
    states: PURCHASE_ORDER_STATES,
    transitions: PURCHASE_ORDER_TRANSITIONS,
  },
} as const;

export type LifecycleTable = keyof typeof LIFECYCLE_REGISTRY;
