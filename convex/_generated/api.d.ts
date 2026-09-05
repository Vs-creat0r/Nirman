/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as company_settings from "../company_settings.js";
import type * as cost_comparisons from "../cost_comparisons.js";
import type * as dashboard from "../dashboard.js";
import type * as delivery_challans from "../delivery_challans.js";
import type * as files from "../files.js";
import type * as grn from "../grn.js";
import type * as http from "../http.js";
import type * as lifecycle from "../lifecycle.js";
import type * as lifecycle_actions from "../lifecycle/actions.js";
import type * as lifecycle_cost_comparison from "../lifecycle/cost_comparison.js";
import type * as lifecycle_delivery_challan from "../lifecycle/delivery_challan.js";
import type * as lifecycle_guards from "../lifecycle/guards.js";
import type * as lifecycle_index from "../lifecycle/index.js";
import type * as lifecycle_material_request from "../lifecycle/material_request.js";
import type * as lifecycle_purchase_order from "../lifecycle/purchase_order.js";
import type * as lifecycle_rfq from "../lifecycle/rfq.js";
import type * as lifecycle_types from "../lifecycle/types.js";
import type * as logs from "../logs.js";
import type * as material_requests from "../material_requests.js";
import type * as movement_actions from "../movement_actions.js";
import type * as movements from "../movements.js";
import type * as pdf from "../pdf.js";
import type * as pdf_data from "../pdf_data.js";
import type * as permissions from "../permissions.js";
import type * as project_items from "../project_items.js";
import type * as projects from "../projects.js";
import type * as purchase_order_approvals from "../purchase_order_approvals.js";
import type * as purchase_order_closure from "../purchase_order_closure.js";
import type * as purchase_order_commitments from "../purchase_order_commitments.js";
import type * as purchase_orders from "../purchase_orders.js";
import type * as rbac from "../rbac.js";
import type * as rfq_quotes from "../rfq_quotes.js";
import type * as rfqs from "../rfqs.js";
import type * as scoping from "../scoping.js";
import type * as seed from "../seed.js";
import type * as sites from "../sites.js";
import type * as tc_templates from "../tc_templates.js";
import type * as transition from "../transition.js";
import type * as users from "../users.js";
import type * as vendors from "../vendors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  company_settings: typeof company_settings;
  cost_comparisons: typeof cost_comparisons;
  dashboard: typeof dashboard;
  delivery_challans: typeof delivery_challans;
  files: typeof files;
  grn: typeof grn;
  http: typeof http;
  lifecycle: typeof lifecycle;
  "lifecycle/actions": typeof lifecycle_actions;
  "lifecycle/cost_comparison": typeof lifecycle_cost_comparison;
  "lifecycle/delivery_challan": typeof lifecycle_delivery_challan;
  "lifecycle/guards": typeof lifecycle_guards;
  "lifecycle/index": typeof lifecycle_index;
  "lifecycle/material_request": typeof lifecycle_material_request;
  "lifecycle/purchase_order": typeof lifecycle_purchase_order;
  "lifecycle/rfq": typeof lifecycle_rfq;
  "lifecycle/types": typeof lifecycle_types;
  logs: typeof logs;
  material_requests: typeof material_requests;
  movement_actions: typeof movement_actions;
  movements: typeof movements;
  pdf: typeof pdf;
  pdf_data: typeof pdf_data;
  permissions: typeof permissions;
  project_items: typeof project_items;
  projects: typeof projects;
  purchase_order_approvals: typeof purchase_order_approvals;
  purchase_order_closure: typeof purchase_order_closure;
  purchase_order_commitments: typeof purchase_order_commitments;
  purchase_orders: typeof purchase_orders;
  rbac: typeof rbac;
  rfq_quotes: typeof rfq_quotes;
  rfqs: typeof rfqs;
  scoping: typeof scoping;
  seed: typeof seed;
  sites: typeof sites;
  tc_templates: typeof tc_templates;
  transition: typeof transition;
  users: typeof users;
  vendors: typeof vendors;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
