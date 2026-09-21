/**
 * @fileoverview Agent Evaluation Suite Runner (Regression Net).
 *
 * Implements S6-6 T2 & T4:
 * - Versioned scenario evaluation against FakeModelProvider (deterministic 100% pass)
 * - Optional --live flag for live testing against configured LLM endpoints
 * - Strict assertion scoring across status, quotes, RBAC refusals, PII boundaries, and self-correction
 * - Formatted summary scorecard and CI exit codes
 */

import { EVAL_SCENARIOS, EVAL_DATASET_VERSION, EVAL_PROMPT_VERSION } from "./eval/eval-cases";
import { planCostComparison } from "../convex/agent/propose";
import { FakeModelProvider, OpenAICompatibleModelProvider } from "../convex/agent/model_provider";

interface ScenarioResult {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly passed: boolean;
  readonly status: string;
  readonly attempts: number;
  readonly errors: readonly string[];
}

async function runEvaluation(): Promise<void> {
  const isLive = process.argv.includes("--live");

  console.log("\n=================================================================");
  console.log("  NIRMAN AGENT EVALUATION HARNESS — REGRESSION NET");
  console.log(`  Dataset: ${EVAL_DATASET_VERSION}  |  Prompt: ${EVAL_PROMPT_VERSION}  |  Mode: ${isLive ? "LIVE (LLM)" : "DETERMINISTIC (FakeModelProvider)"}`);
  console.log("=================================================================\n");

  if (isLive && !process.env.AGENT_MODEL_API_KEY) {
    console.log("⚠️  WARNING: --live flag passed but AGENT_MODEL_API_KEY is not set in environment.");
    console.log("   Falling back to FakeModelProvider for deterministic assertions.\n");
  }

  const results: ScenarioResult[] = [];

  for (const scenario of EVAL_SCENARIOS) {
    const { id, name, category, input, expected } = scenario;
    const errors: string[] = [];

    let modelProvider;
    if (isLive && process.env.AGENT_MODEL_API_KEY) {
      modelProvider = new OpenAICompatibleModelProvider({
        apiKey: process.env.AGENT_MODEL_API_KEY,
        baseUrl: process.env.AGENT_MODEL_BASE_URL,
        modelName: process.env.AGENT_MODEL_NAME || "gemini-2.5-flash",
      });
    } else {
      modelProvider = new FakeModelProvider(input.fakeModelConfig);
    }

    try {
      const result = await planCostComparison({
        caller: input.caller,
        rawMR: input.rawMR,
        candidateVendors: input.candidateVendors,
        itemRateHistory: input.itemRateHistory,
        userPrompt: input.userPrompt,
        modelProvider,
      });

      // 1. Status Check
      if (result.status !== expected.status) {
        errors.push(`Status mismatch: expected "${expected.status}", got "${result.status}"`);
      }

      // 2. Minimum Quotes Check
      if (expected.minQuotes !== undefined) {
        const quoteCount = result.proposal?.vendorQuotes?.length ?? 0;
        if (quoteCount < expected.minQuotes) {
          errors.push(`Insufficient quotes: expected >= ${expected.minQuotes}, got ${quoteCount}`);
        }
      }

      // 3. Distinct Vendors Check
      if (expected.distinctVendors) {
        const vendorIds = result.proposal?.vendorQuotes?.map((q) => q.vendorId) || [];
        const uniqueIds = new Set(vendorIds);
        if (uniqueIds.size !== vendorIds.length) {
          errors.push(`Vendor IDs not distinct: ${vendorIds.join(", ")}`);
        }
      }

      // 4. Expected Vendor IDs Check
      if (expected.expectedVendorIds) {
        const vendorIds = new Set(result.proposal?.vendorQuotes?.map((q) => q.vendorId) || []);
        for (const expectedId of expected.expectedVendorIds) {
          if (!vendorIds.has(expectedId)) {
            errors.push(`Missing expected vendor ID: "${expectedId}"`);
          }
        }
      }

      // 5. Expected Reason Substrings Check
      if (expected.expectedReasonContains) {
        const reasonLower = (result.reason || "").toLowerCase();
        for (const phrase of expected.expectedReasonContains) {
          if (!reasonLower.includes(phrase.toLowerCase())) {
            errors.push(`Reason missing expected text: "${phrase}" (actual reason: "${result.reason || "none"}")`);
          }
        }
      }

      // 6. Forbidden Output Terms Check
      if (expected.forbiddenOutputTerms) {
        const serialized = JSON.stringify({
          proposal: result.proposal,
          summary: result.planSummary,
        }).toLowerCase();

        for (const term of expected.forbiddenOutputTerms) {
          if (serialized.includes(term.toLowerCase())) {
            errors.push(`Forbidden term leaked into output: "${term}"`);
          }
        }
      }

      // 7. Max Attempts Check
      if (expected.maxAttemptsAllowed !== undefined) {
        if (result.attemptCount > expected.maxAttemptsAllowed) {
          errors.push(`Attempt count exceeded: max ${expected.maxAttemptsAllowed}, took ${result.attemptCount}`);
        }
      }

      // 8. Expected Validation OK Check
      if (expected.expectedValidationOk !== undefined) {
        const actualOk = Boolean(result.validation?.ok);
        if (actualOk !== expected.expectedValidationOk) {
          errors.push(`Validation OK mismatch: expected ${expected.expectedValidationOk}, got ${actualOk}`);
        }
      }

      results.push({
        id,
        name,
        category,
        passed: errors.length === 0,
        status: result.status,
        attempts: result.attemptCount,
        errors,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        id,
        name,
        category,
        passed: false,
        status: "exception",
        attempts: 0,
        errors: [`Unhandled exception during execution: ${msg}`],
      });
    }
  }

  // ── Print Formatted Scorecard ──────────────────────────────────────────
  let currentCategory = "";
  for (const r of results) {
    if (r.category !== currentCategory) {
      currentCategory = r.category;
      console.log(`\n── [${currentCategory.toUpperCase()}] ──────────────────────────────────────`);
    }

    const tag = r.passed ? "  [PASS] " : "  [FAIL] ";
    const attemptStr = `(attempts: ${r.attempts})`;
    console.log(`${tag} ${r.id.padEnd(16)} | ${r.name.padEnd(50)} ${attemptStr}`);

    if (!r.passed) {
      for (const e of r.errors) {
        console.log(`         ↳ ERROR: ${e}`);
      }
    }
  }

  // ── Print Summary ──────────────────────────────────────────────────────
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log("\n=================================================================");
  console.log(`  EVALUATION SUMMARY: ${passed}/${total} PASSED (${passRate}%)`);
  console.log(`  Dataset Version: ${EVAL_DATASET_VERSION}  |  Prompt Version: ${EVAL_PROMPT_VERSION}`);
  console.log("=================================================================");

  if (failed > 0) {
    console.log(`\n❌ REGRESSION DETECTED: ${failed} scenario(s) failed evaluation.\n`);
    process.exit(1);
  } else {
    console.log("\n✅ EVALUATION GREEN: 100% deterministic test suite pass. Safe to ship.\n");
    process.exit(0);
  }
}

runEvaluation().catch((err) => {
  console.error("Evaluation script encountered fatal error:", err);
  process.exit(1);
});
