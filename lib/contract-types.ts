// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

export const ROLES = ["admin", "project_manager", "procurement_officer", "site_supervisor"] as const;
export type Role = (typeof ROLES)[number];

export const CONTRACT_TABLES = ["cost_comparison", "delivery_challan", "grn", "inventory", "logs", "material_request", "project_items", "projects", "purchase_order", "rfq", "settings", "sites", "users", "vendors"] as const;
export type ContractTable = (typeof CONTRACT_TABLES)[number];

/** Every status any document can hold, union of all contracts. */
export const ALL_STATUSES = ["draft", "submitted", "queried", "rejected", "approved", "delivery_processing", "delivered", "cancelled", "pending", "ready_for_cc", "review_cc", "ready_for_po", "review_po", "pending_po"] as const;
export type AnyStatus = (typeof ALL_STATUSES)[number];
