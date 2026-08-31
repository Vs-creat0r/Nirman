/**
 * @fileoverview Central Authorization & Permission Matrix for Nirman ERP.
 * 
 * Single source of truth for Role-Based Access Control (RBAC).
 * Enforces compile-time action mappings for every mutation and state transition.
 */

import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export type UserRole =
  | "admin"
  | "project_manager"
  | "procurement_officer"
  | "site_supervisor";

export const PERMISSIONS = {
  // Material Requests
  "material_requests:create": ["site_supervisor", "project_manager", "admin"],
  "material_requests:update": ["site_supervisor", "project_manager", "admin"],
  "material_requests:submit": ["site_supervisor", "project_manager", "admin"],
  "material_requests:approve": ["project_manager", "admin"],
  "material_requests:reject": ["project_manager", "admin"],
  "material_requests:query": ["project_manager", "admin"],
  "material_requests:resubmit": ["site_supervisor", "project_manager", "admin"],
  "material_requests:delete": ["site_supervisor", "project_manager", "admin"],
  "material_requests:add_note": ["site_supervisor", "project_manager", "procurement_officer", "admin"],
  "material_requests:process_delivery": ["site_supervisor", "procurement_officer", "admin"],
  "material_requests:review_on_cc": ["procurement_officer", "project_manager", "admin"],
  "material_requests:advance_on_cc_approval": ["project_manager", "admin"],
  "material_requests:reset_on_cc_reject": ["project_manager", "admin"],
  "material_requests:review_on_po": ["procurement_officer", "project_manager", "admin"],
  "material_requests:advance_on_po_approval": ["project_manager", "admin"],
  "material_requests:reset_on_po_reject": ["project_manager", "admin"],
  "material_requests:close_on_short_close": ["project_manager", "admin"],
  "material_requests:advance_on_dc": ["procurement_officer", "project_manager", "admin"],
  "material_requests:close_on_receipt": ["site_supervisor", "procurement_officer", "admin"],

  // Cost Comparisons
  "cost_comparisons:create": ["procurement_officer", "project_manager", "admin"],
  "cost_comparisons:update": ["procurement_officer", "project_manager", "admin"],
  "cost_comparisons:submit": ["procurement_officer", "project_manager", "admin"],
  "cost_comparisons:approve": ["project_manager", "admin"],
  "cost_comparisons:reject": ["project_manager", "admin"],
  "cost_comparisons:query": ["project_manager", "admin"],
  "cost_comparisons:resubmit": ["procurement_officer", "project_manager", "admin"],
  "cost_comparisons:delete": ["procurement_officer", "project_manager", "admin"],

  // Purchase Orders
  "purchase_orders:create": ["procurement_officer", "project_manager", "admin"],
  "purchase_orders:update": ["procurement_officer", "project_manager", "admin"],
  "purchase_orders:submit": ["procurement_officer", "project_manager", "admin"],
  "purchase_orders:approve": ["project_manager", "admin"],
  "purchase_orders:reject": ["project_manager", "admin"],
  "purchase_orders:query": ["project_manager", "admin"],
  "purchase_orders:resubmit": ["procurement_officer", "project_manager", "admin"],
  "purchase_orders:cancel": ["project_manager", "admin"],
  "purchase_orders:close": ["project_manager", "admin"],
  "purchase_orders:close_on_receipt": ["site_supervisor", "procurement_officer", "admin"],
  "purchase_orders:delete": ["procurement_officer", "project_manager", "admin"],

  // Delivery Challans
  "delivery_challans:create": ["procurement_officer", "project_manager", "admin"],
  "delivery_challans:update": ["procurement_officer", "project_manager", "admin"],
  "delivery_challans:dispatch": ["procurement_officer", "project_manager", "admin"],
  "delivery_challans:cancel": ["procurement_officer", "project_manager", "admin"],
  "delivery_challans:deliver": ["site_supervisor", "procurement_officer", "admin"],

  // Goods Received Notes (GRN)
  "grn:create": ["site_supervisor", "procurement_officer", "admin"],
  "grn:update": ["site_supervisor", "procurement_officer", "admin"],
  "grn:inspect": ["site_supervisor", "project_manager", "admin"],

  // Vendors
  "vendors:create": ["procurement_officer", "project_manager", "admin"],
  "vendors:update": ["procurement_officer", "project_manager", "admin"],
  "vendors:deactivate": ["procurement_officer", "project_manager", "admin"],
  "vendors:delete": ["admin"],

  // Admin / Master Data / Settings / Files
  "tc_templates:create": ["admin"],
  "tc_templates:update": ["admin"],
  "tc_templates:delete": ["admin"],
  "project_items:create": ["admin"],
  "project_items:backfill": ["admin"],
  "projects:manage": ["admin"],
  "sites:manage": ["admin"],
  "settings:manage": ["admin"],
  "users:manage": ["admin"],
  "users:change_role": ["admin"],
  "files:upload": ["site_supervisor", "project_manager", "procurement_officer", "admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type ActionName = keyof typeof PERMISSIONS;

/**
 * Resolves caller session and enforces permission for the given action.
 * Strictly throws if token is undefined, invalid, account is deactivated, or role is unauthorized.
 */
export async function requirePermission(
  ctx: MutationCtx | QueryCtx,
  action: ActionName,
  token?: string
): Promise<Doc<"users">> {
  if (!token) {
    throw new Error(`Unauthorized: No authentication token provided for action "${action}".`);
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error(`Unauthorized: Invalid or expired session token for action "${action}".`);
  }

  const user = await ctx.db.get(session.userId);
  if (!user) {
    throw new Error(`Unauthorized: User not found for session.`);
  }

  if (!user.isActive) {
    throw new Error("Unauthorized: Your account has been deactivated. Contact an administrator.");
  }

  const allowedRoles = PERMISSIONS[action] as readonly UserRole[];
  if (!allowedRoles.includes(user.role as UserRole)) {
    throw new Error(
      `Unauthorized: Action "${action}" requires one of these roles: [${allowedRoles.join(
        ", "
      )}]. Your role is: "${user.role}".`
    );
  }

  return user;
}
