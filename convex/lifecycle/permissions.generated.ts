// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import type { UserRole } from "../permissions";

export const GENERATED_LIFECYCLE_PERMISSIONS = {
  "cost_comparisons:submit": ["procurement_officer", "project_manager", "admin"] as const,
  "cost_comparisons:approve": ["project_manager", "admin"] as const,
  "cost_comparisons:reject": ["project_manager", "admin"] as const,
  "cost_comparisons:query": ["project_manager", "admin"] as const,
  "cost_comparisons:resubmit": ["procurement_officer", "project_manager", "admin"] as const,
  "delivery_challans:dispatch": ["procurement_officer", "project_manager", "admin"] as const,
  "delivery_challans:deliver": ["site_supervisor", "procurement_officer", "admin"] as const,
  "delivery_challans:cancel": ["procurement_officer", "project_manager", "admin"] as const,
  "material_requests:submit": ["site_supervisor", "project_manager", "admin"] as const,
  "material_requests:approve": ["project_manager", "admin"] as const,
  "material_requests:reject": ["project_manager", "admin"] as const,
  "material_requests:query": ["project_manager", "admin"] as const,
  "material_requests:resubmit": ["site_supervisor", "project_manager", "admin"] as const,
  "material_requests:send_to_rfq": ["project_manager", "procurement_officer", "admin"] as const,
  "material_requests:send_to_cc": ["project_manager", "procurement_officer", "admin"] as const,
  "material_requests:review_on_cc": ["procurement_officer", "project_manager", "admin"] as const,
  "material_requests:advance_on_cc_approval": ["project_manager", "admin"] as const,
  "material_requests:reset_on_cc_reject": ["project_manager", "admin"] as const,
  "material_requests:review_on_po": ["procurement_officer", "project_manager", "admin"] as const,
  "material_requests:advance_on_po_approval": ["project_manager", "admin"] as const,
  "material_requests:reset_on_po_reject": ["project_manager", "admin"] as const,
  "material_requests:advance_on_dc": ["procurement_officer", "project_manager", "admin"] as const,
  "material_requests:process_delivery": ["site_supervisor", "procurement_officer", "admin"] as const,
  "material_requests:close_on_receipt": ["site_supervisor", "procurement_officer", "admin"] as const,
  "material_requests:close_on_short_close": ["project_manager", "admin"] as const,
  "purchase_orders:submit": ["procurement_officer", "project_manager", "admin"] as const,
  "purchase_orders:approve": ["project_manager", "admin"] as const,
  "purchase_orders:reject": ["project_manager", "admin"] as const,
  "purchase_orders:query": ["project_manager", "admin"] as const,
  "purchase_orders:resubmit": ["procurement_officer", "project_manager", "admin"] as const,
  "purchase_orders:cancel": ["project_manager", "admin"] as const,
  "purchase_orders:close": ["project_manager", "admin"] as const,
  "purchase_orders:close_on_receipt": ["site_supervisor", "procurement_officer", "admin"] as const,
  "rfqs:issue": ["procurement_officer", "admin"] as const,
  "rfqs:close": ["procurement_officer", "admin"] as const,
  "rfqs:archive": ["project_manager", "admin"] as const,
} as const satisfies Record<string, readonly UserRole[]>;

export type GeneratedLifecycleActionName = keyof typeof GENERATED_LIFECYCLE_PERMISSIONS;
