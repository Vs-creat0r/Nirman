/**
 * @fileoverview Core Evaluation Scenarios (Golden Path, RBAC, Lifecycle & Uncertainty Refusals).
 * Implements S6-6 T1: Versioned Eval Dataset.
 */

import { EvalScenario } from "./eval-types";
import {
  EVAL_DATASET_VERSION,
  EVAL_PROMPT_VERSION,
  CALLER_PO,
  CALLER_PM,
  CALLER_SUP,
  VENDOR_A,
  VENDOR_INACTIVE,
  STANDARD_VENDORS_2,
  STANDARD_VENDORS_3,
  STANDARD_MR,
  STANDARD_QUOTES,
} from "./eval-fixtures";

export const CORE_EVAL_SCENARIOS: readonly EvalScenario[] = [
  // ── 1. Golden Path (Valid Proposals) ─────────────────────────────────
  {
    id: "eval_gp_01",
    name: "Standard Approved MR with 2 Vendors",
    category: "golden_path",
    description: "Evaluates standard 2-vendor draft generation for ready_for_cc MR.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: STANDARD_MR,
      candidateVendors: STANDARD_VENDORS_2,
      itemRateHistory: [],
      fakeModelConfig: { defaultQuotes: STANDARD_QUOTES },
    },
    expected: {
      status: "proposed",
      minQuotes: 2,
      distinctVendors: true,
      expectedVendorIds: ["v_alpha", "v_beta"],
      maxAttemptsAllowed: 1,
      expectedValidationOk: true,
    },
  },
  {
    id: "eval_gp_02",
    name: "Multi-Item MR with 3 Vendor Quotes",
    category: "golden_path",
    description: "Evaluates 3-vendor competitive comparison for multi-line items.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: {
        ...STANDARD_MR,
        _id: "mr_multi_item",
        items: [
          { itemName: "Cement 53 Grade", quantity: 200, unit: "bags" },
          { itemName: "Steel 12mm TMT", quantity: 10, unit: "MT" },
          { itemName: "River Sand", quantity: 20, unit: "cum" },
        ],
      },
      candidateVendors: STANDARD_VENDORS_3,
      itemRateHistory: [],
      fakeModelConfig: {
        defaultQuotes: [
          ...STANDARD_QUOTES,
          {
            vendorId: "v_gamma",
            items: [
              { itemName: "Cement 53 Grade", quantity: 200, unit: "bags", rate: 345 },
              { itemName: "Steel 12mm TMT", quantity: 10, unit: "MT", rate: 60500 },
              { itemName: "River Sand", quantity: 20, unit: "cum", rate: 1200 },
            ],
            taxRate: 18,
            freight: 1200,
          },
        ],
      },
    },
    expected: {
      status: "proposed",
      minQuotes: 3,
      distinctVendors: true,
      expectedVendorIds: ["v_alpha", "v_beta", "v_gamma"],
      maxAttemptsAllowed: 1,
      expectedValidationOk: true,
    },
  },
  {
    id: "eval_gp_03",
    name: "Urgent Priority MR with Historical Rate Grounding",
    category: "golden_path",
    description: "Evaluates proposal generation with historical rate benchmark context.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: { ...STANDARD_MR, priority: "urgent", refNo: "MR-2026-URGENT" },
      candidateVendors: STANDARD_VENDORS_2,
      itemRateHistory: [
        { table: "purchase_order", refNo: "PO-2025-099", matchedItem: { itemName: "Cement 53 Grade", rate: 345 } },
      ],
      fakeModelConfig: { defaultQuotes: STANDARD_QUOTES },
    },
    expected: {
      status: "proposed",
      minQuotes: 2,
      distinctVendors: true,
      maxAttemptsAllowed: 1,
      expectedValidationOk: true,
    },
  },
  {
    id: "eval_gp_04",
    name: "Project Manager Authorized Proposer",
    category: "golden_path",
    description: "Evaluates authorized PM proposing a draft cost comparison.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PM,
      rawMR: STANDARD_MR,
      candidateVendors: STANDARD_VENDORS_2,
      itemRateHistory: [],
      fakeModelConfig: { defaultQuotes: STANDARD_QUOTES },
    },
    expected: {
      status: "proposed",
      minQuotes: 2,
      distinctVendors: true,
      maxAttemptsAllowed: 1,
      expectedValidationOk: true,
    },
  },

  // ── 2. RBAC Refusals ─────────────────────────────────────────────────
  {
    id: "eval_rbac_01",
    name: "Site Supervisor Refusal",
    category: "rbac_refusal",
    description: "Asserts site supervisor is refused from initiating cost comparison proposals.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_SUP,
      rawMR: STANDARD_MR,
      candidateVendors: STANDARD_VENDORS_2,
      itemRateHistory: [],
    },
    expected: {
      status: "incomplete",
      expectedReasonContains: ["Unauthorized", "site_supervisor"],
      maxAttemptsAllowed: 0,
    },
  },
  {
    id: "eval_rbac_02",
    name: "Unassigned Role Refusal",
    category: "rbac_refusal",
    description: "Asserts non-procurement role is rejected by RBAC gate.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: { _id: "user_unknown", name: "Guest User", role: "site_supervisor", isActive: true },
      rawMR: STANDARD_MR,
      candidateVendors: STANDARD_VENDORS_2,
      itemRateHistory: [],
    },
    expected: {
      status: "incomplete",
      expectedReasonContains: ["Unauthorized"],
      maxAttemptsAllowed: 0,
    },
  },

  // ── 3. Lifecycle Status Refusals ─────────────────────────────────────
  {
    id: "eval_life_01",
    name: "Parent MR in Draft Status Refusal",
    category: "lifecycle_refusal",
    description: "Asserts MR in draft status cannot be used for cost comparison drafting.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: { ...STANDARD_MR, status: "draft" },
      candidateVendors: STANDARD_VENDORS_2,
      itemRateHistory: [],
    },
    expected: {
      status: "incomplete",
      expectedReasonContains: ["draft", "ready_for_cc"],
      maxAttemptsAllowed: 0,
    },
  },
  {
    id: "eval_life_02",
    name: "Parent MR in Pending Status Refusal",
    category: "lifecycle_refusal",
    description: "Asserts unapproved pending MR is refused.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: { ...STANDARD_MR, status: "pending" },
      candidateVendors: STANDARD_VENDORS_2,
      itemRateHistory: [],
    },
    expected: {
      status: "incomplete",
      expectedReasonContains: ["pending", "ready_for_cc"],
      maxAttemptsAllowed: 0,
    },
  },
  {
    id: "eval_life_03",
    name: "Parent MR in Rejected Status Refusal",
    category: "lifecycle_refusal",
    description: "Asserts rejected MR is refused from CC drafting.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: { ...STANDARD_MR, status: "rejected" },
      candidateVendors: STANDARD_VENDORS_2,
      itemRateHistory: [],
    },
    expected: {
      status: "incomplete",
      expectedReasonContains: ["rejected", "ready_for_cc"],
      maxAttemptsAllowed: 0,
    },
  },
  {
    id: "eval_life_04",
    name: "Parent MR in Queried Status Refusal",
    category: "lifecycle_refusal",
    description: "Asserts queried MR awaiting supervisor edit is refused.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: { ...STANDARD_MR, status: "queried" },
      candidateVendors: STANDARD_VENDORS_2,
      itemRateHistory: [],
    },
    expected: {
      status: "incomplete",
      expectedReasonContains: ["queried", "ready_for_cc"],
      maxAttemptsAllowed: 0,
    },
  },
  {
    id: "eval_life_05",
    name: "Parent MR in Terminal Delivered Status Refusal",
    category: "lifecycle_refusal",
    description: "Asserts terminal delivered MR cannot have new CC drafted.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: { ...STANDARD_MR, status: "delivered" },
      candidateVendors: STANDARD_VENDORS_2,
      itemRateHistory: [],
    },
    expected: {
      status: "incomplete",
      expectedReasonContains: ["delivered", "ready_for_cc"],
      maxAttemptsAllowed: 0,
    },
  },

  // ── 4. Uncertainty Refusals ──────────────────────────────────────────
  {
    id: "eval_uncert_01",
    name: "Zero Vendors Uncertainty Refusal",
    category: "uncertainty_refusal",
    description: "Asserts refusal when 0 candidate vendors are available (no invented suppliers).",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: STANDARD_MR,
      candidateVendors: [],
      itemRateHistory: [],
    },
    expected: {
      status: "incomplete",
      expectedReasonContains: ["Uncertainty Refusal", "0 active vendor"],
      maxAttemptsAllowed: 0,
    },
  },
  {
    id: "eval_uncert_02",
    name: "Single Vendor Uncertainty Refusal",
    category: "uncertainty_refusal",
    description: "Asserts refusal when only 1 active vendor is available (requires >= 2).",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: STANDARD_MR,
      candidateVendors: [VENDOR_A],
      itemRateHistory: [],
    },
    expected: {
      status: "incomplete",
      expectedReasonContains: ["Uncertainty Refusal", "1 active vendor"],
      maxAttemptsAllowed: 0,
    },
  },
  {
    id: "eval_uncert_03",
    name: "Active + Inactive Vendor Refusal",
    category: "uncertainty_refusal",
    description: "Asserts inactive vendors are filtered out, leaving insufficient active vendors.",
    datasetVersion: EVAL_DATASET_VERSION,
    promptVersion: EVAL_PROMPT_VERSION,
    input: {
      caller: CALLER_PO,
      rawMR: STANDARD_MR,
      candidateVendors: [VENDOR_A, VENDOR_INACTIVE],
      itemRateHistory: [],
    },
    expected: {
      status: "incomplete",
      expectedReasonContains: ["Uncertainty Refusal", "1 active vendor"],
      maxAttemptsAllowed: 0,
    },
  },
];

