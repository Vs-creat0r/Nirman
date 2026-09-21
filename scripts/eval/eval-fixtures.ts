/**
 * @fileoverview Shared Fixtures for Nirman Agent Evaluation Suite.
 *
 * Implements S6-6 T1:
 * Versioned caller profiles, vendor fixtures, material requests, and quote drafts
 * used across the regression test scenarios.
 */

import { UserRole } from "../../convex/permissions";
import { VendorQuoteDraft } from "../../convex/agent/model_provider";

export const EVAL_DATASET_VERSION = "eval-v1";
export const EVAL_PROMPT_VERSION = "s6-v1";

export interface FixtureCaller extends Record<string, unknown> {
  readonly _id: string;
  readonly name: string;
  readonly role: UserRole;
  readonly isActive: boolean;
}

export interface FixtureVendor extends Record<string, unknown> {
  readonly _id: string;
  readonly name: string;
  readonly category: string;
  readonly status: "active" | "inactive";
}

export const CALLER_PO: FixtureCaller = {
  _id: "user_po",
  name: "Priya PO",
  role: "procurement_officer",
  isActive: true,
};

export const CALLER_PM: FixtureCaller = {
  _id: "user_pm",
  name: "Anil PM",
  role: "project_manager",
  isActive: true,
};

export const CALLER_SUP: FixtureCaller = {
  _id: "user_sup",
  name: "Ravi Supervisor",
  role: "site_supervisor",
  isActive: true,
};

export const CALLER_INACTIVE: FixtureCaller = {
  _id: "user_inactive",
  name: "Inactive User",
  role: "procurement_officer",
  isActive: false,
};

export const VENDOR_A: FixtureVendor = {
  _id: "v_alpha",
  name: "Alpha Steel & Cement Ltd",
  category: "materials",
  status: "active",
};

export const VENDOR_B: FixtureVendor = {
  _id: "v_beta",
  name: "Beta Buildcon Supplies",
  category: "materials",
  status: "active",
};

export const VENDOR_C: FixtureVendor = {
  _id: "v_gamma",
  name: "Gamma Infra Trade",
  category: "materials",
  status: "active",
};

export const VENDOR_INACTIVE: FixtureVendor = {
  _id: "v_inactive",
  name: "Old Defunct Supplies",
  category: "materials",
  status: "inactive",
};

export const STANDARD_VENDORS_2: readonly FixtureVendor[] = [VENDOR_A, VENDOR_B];
export const STANDARD_VENDORS_3: readonly FixtureVendor[] = [VENDOR_A, VENDOR_B, VENDOR_C];

export const STANDARD_MR = {
  _id: "mr_approved_101",
  refNo: "MR-2026-0101",
  projectId: "proj_metro_a",
  siteId: "site_pier_1",
  status: "ready_for_cc",
  priority: "normal",
  items: [
    { itemName: "Cement 53 Grade", quantity: 100, unit: "bags" },
    { itemName: "Steel 12mm TMT", quantity: 5, unit: "MT" },
  ],
};

export const STANDARD_QUOTES: readonly VendorQuoteDraft[] = [
  {
    vendorId: "v_alpha",
    items: [
      { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 350 },
      { itemName: "Steel 12mm TMT", quantity: 5, unit: "MT", rate: 60000 },
    ],
    taxRate: 18,
    freight: 500,
    paymentTerms: "30_days",
  },
  {
    vendorId: "v_beta",
    items: [
      { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 340 },
      { itemName: "Steel 12mm TMT", quantity: 5, unit: "MT", rate: 61000 },
    ],
    taxRate: 18,
    freight: 800,
    paymentTerms: "15_days",
  },
];

export const SINGLE_QUOTE_A: readonly VendorQuoteDraft[] = [
  {
    vendorId: "v_alpha",
    items: [{ itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 350 }],
    taxRate: 18,
  },
];

