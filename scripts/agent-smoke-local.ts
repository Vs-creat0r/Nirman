/**
 * LOCAL SMOKE TEST — Cost Comparison agent vs a REAL LLM (Omniroute / any OpenAI-compatible).
 *
 * WHERE THIS GOES: repo root as  scripts/agent-smoke-local.ts
 * HOW TO RUN (in YOUR own terminal, where localhost reaches Omniroute):
 *     cd D:\NOTION\nirman\nirman
 *     npx tsx scripts/agent-smoke-local.ts
 *
 * WHY LOCAL, NOT CONVEX: the Convex action runs in Convex cloud and cannot reach
 * your machine's localhost. This script runs the REAL planner + REAL guardrails
 * (only the DB grounding is stubbed) directly against your local Omniroute endpoint.
 * Your key never leaves your PC. This is a dev-only test harness — do NOT commit a real key.
 *
 * PROVIDER SWAP (production): change the 3 constants below (or the AGENT_MODEL_* env vars).
 *   Omniroute (local):  BASE_URL http://localhost:<port>/v1        KEY <omniroute key>
 *   OpenAI:             BASE_URL https://api.openai.com/v1          MODEL gpt-4o-mini
 *   Gemini (OpenAI API): BASE_URL https://generativelanguage.googleapis.com/v1beta/openai/  MODEL gemini-2.0-flash
 */

import { planCostComparison } from "../convex/agent/propose";
import { OpenAICompatibleModelProvider } from "../convex/agent/model-provider";

// ── 1. FILL THESE for Omniroute (or set AGENT_MODEL_* env vars) ──────────────
const BASE_URL = process.env.AGENT_MODEL_BASE_URL || "http://localhost:20128/v1"; // <-- your Omniroute OpenAI-compatible endpoint
const API_KEY = process.env.AGENT_MODEL_API_KEY || "sk-2e6f160c28fd218b-b2ab27-58dab1e2";            // <-- whatever Omniroute expects
const MODEL_NAME = process.env.AGENT_MODEL_NAME || "agy/gemini-3.6-flash-medium";                 // <-- a model id Omniroute routes
// ─────────────────────────────────────────────────────────────────────────────

const provider = new OpenAICompatibleModelProvider({
  apiKey: API_KEY,
  baseUrl: BASE_URL,
  modelName: MODEL_NAME,
  timeoutMs: 60000, // local models can be slow on first token
});

// Stubbed grounding — mirrors what the Convex queries would supply, already field-projected.
const caller = { _id: "user_local_test", role: "procurement_officer" as const };

const rawMR = {
  _id: "mr_local_test",
  refNo: "MR-SMOKE-001",
  status: "ready_for_cc",
  items: [
    { itemName: "Portland Cement (OPC 53)", quantity: 100, unit: "bags", projectItemId: "pi_cement_01" },
    { itemName: "TMT Steel Bar 12mm", quantity: 2, unit: "tonnes", projectItemId: "pi_steel_01" },
  ],
};

const candidateVendors = [
  { _id: "vendor_a", name: "Shakti Building Materials", category: "cement", isActive: true, status: "active" },
  { _id: "vendor_b", name: "Gujarat Steel Traders", category: "steel", isActive: true, status: "active" },
  { _id: "vendor_c", name: "Metro Hardware Supply", category: "general", isActive: true, status: "active" },
];

const itemRateHistory = [
  { table: "purchase_orders", documentId: "po_hist_1", refNo: "PO-2025-044",
    matchedItem: { itemName: "Portland Cement (OPC 53)", rate: 352, unit: "bags" } },
  { table: "purchase_orders", documentId: "po_hist_2", refNo: "PO-2025-051",
    matchedItem: { itemName: "TMT Steel Bar 12mm", rate: 61000, unit: "tonnes" } },
];

// Fields that must NEVER appear in what reached the model (§11.5 boundary check).
const FORBIDDEN_KEYS = ["phone", "email", "gst", "gstin", "pan", "address", "bankAccount", "accountNumber", "contactPerson"];

function scanForPII(label: string, rows: readonly Record<string, unknown>[]): string[] {
  const leaks: string[] = [];
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (FORBIDDEN_KEYS.some((f) => k.toLowerCase().includes(f))) leaks.push(`${label}.${k}`);
    }
  }
  return leaks;
}

async function main() {
  console.log("=".repeat(70));
  console.log("NIRMAN AGENT — LOCAL REAL-LLM SMOKE TEST");
  console.log(`Provider endpoint : ${BASE_URL}`);
  console.log(`Model             : ${MODEL_NAME}`);
  console.log("=".repeat(70));

  // ── RUN 1: happy path against the real model ───────────────────────────────
  console.log("\n> RUN 1 — real drafting (agent ON)\n");
  const t0 = Date.now();
  const result = await planCostComparison({
    caller,
    rawMR,
    candidateVendors,
    itemRateHistory,
    userPrompt: "Draft a balanced 2-vendor cost comparison for the approved material request.",
    modelProvider: provider,
  });
  const ms = Date.now() - t0;

  console.log(`status        : ${result.status}`);
  console.log(`attemptCount  : ${result.attemptCount}`);
  console.log(`latency       : ${ms} ms`);
  if (result.reason) console.log(`reason        : ${result.reason}`);
  if (result.validation && !result.validation.ok) console.log(`validation    : ${result.validation.errors.join("; ")}`);

  const quotes = result.proposal?.vendorQuotes ?? [];
  console.log(`vendorQuotes  : ${quotes.length}`);
  console.log("\n--- planSummary ---\n" + result.planSummary + "\n");
  console.log("--- proposal (raw) ---");
  console.log(JSON.stringify(result.proposal, null, 2));

  // ── PII boundary check on the grounding that was sent to the model ─────────
  const leaks = [
    ...scanForPII("candidateVendors", result.grounding.candidateVendors as Record<string, unknown>[]),
    ...scanForPII("materialRequest", [result.grounding.materialRequest as Record<string, unknown>]),
  ];
  console.log("\n--- §11.5 data-boundary check ---");
  console.log(leaks.length === 0 ? "PASS — no forbidden fields in grounding" : "FAIL — leaked: " + leaks.join(", "));

  // ── RUN 2: kill switch (no model call should happen) ───────────────────────
  console.log("\n> RUN 2 — kill switch (agent OFF)\n");
  const off = await planCostComparison({
    caller, rawMR, candidateVendors, itemRateHistory,
    modelProvider: provider,
    safetyConfig: { agentEnabled: false },
  });
  console.log(`status : ${off.status}   (expected: incomplete)`);
  console.log(`reason : ${off.reason}`);

  // ── Verdict ────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  const pass =
    result.status === "proposed" &&
    quotes.length >= 2 &&
    leaks.length === 0 &&
    off.status === "incomplete";
  console.log(pass ? "SMOKE TEST PASSED" : "SMOKE TEST FAILED — inspect output above");
  console.log("=".repeat(70));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("\nSmoke test threw:", err);
  process.exit(1);
});
