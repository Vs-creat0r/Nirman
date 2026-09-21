/**
 * @fileoverview Vitest Test Suite for Agent Evaluation (Regression Net).
 *
 * Implements S6-6 T3:
 * - Deterministic assertion of all 23 scenarios from EVAL_SCENARIOS
 * - Evaluates status, quotes, RBAC refusals, lifecycle refusals, adversarial inputs, PII stripping, and self-correction
 * - Asserts 100% pass rate
 */

import { describe, it, expect } from "vitest";
import { EVAL_SCENARIOS, EVAL_DATASET_VERSION, EVAL_PROMPT_VERSION } from "../scripts/eval/eval-cases";
import { planCostComparison } from "../convex/agent/propose";
import { FakeModelProvider } from "../convex/agent/model-provider";

describe("Agent Evaluation Harness (Regression Net)", () => {
  it("verifies dataset and prompt versioning constants", () => {
    expect(EVAL_DATASET_VERSION).toBe("eval-v1");
    expect(EVAL_PROMPT_VERSION).toBe("s6-v1");
    expect(EVAL_SCENARIOS.length).toBeGreaterThanOrEqual(20);
  });

  describe.each(EVAL_SCENARIOS)("Scenario: $id - $name ($category)", (scenario) => {
    it(`evaluates ${scenario.id} against expected contract specification`, async () => {
      const { input, expected } = scenario;
      const modelProvider = new FakeModelProvider(input.fakeModelConfig);

      const result = await planCostComparison({
        caller: input.caller,
        rawMR: input.rawMR,
        candidateVendors: input.candidateVendors,
        itemRateHistory: input.itemRateHistory,
        userPrompt: input.userPrompt,
        modelProvider,
      });

      // 1. Status Check
      expect(result.status).toBe(expected.status);

      // 2. Minimum Quotes Check
      if (expected.minQuotes !== undefined) {
        expect(result.proposal?.vendorQuotes?.length ?? 0).toBeGreaterThanOrEqual(expected.minQuotes);
      }

      // 3. Distinct Vendors Check
      if (expected.distinctVendors) {
        const vendorIds = result.proposal?.vendorQuotes?.map((q) => q.vendorId) || [];
        const uniqueIds = new Set(vendorIds);
        expect(uniqueIds.size).toBe(vendorIds.length);
      }

      // 4. Expected Vendor IDs Check
      if (expected.expectedVendorIds) {
        const vendorIds = new Set(result.proposal?.vendorQuotes?.map((q) => q.vendorId) || []);
        for (const expectedId of expected.expectedVendorIds) {
          expect(vendorIds.has(expectedId)).toBe(true);
        }
      }

      // 5. Expected Reason Substrings Check
      if (expected.expectedReasonContains) {
        const reasonLower = (result.reason || "").toLowerCase();
        for (const phrase of expected.expectedReasonContains) {
          expect(reasonLower).toContain(phrase.toLowerCase());
        }
      }

      // 6. Forbidden Output Terms Check
      if (expected.forbiddenOutputTerms) {
        const serialized = JSON.stringify({
          proposal: result.proposal,
          summary: result.planSummary,
        }).toLowerCase();

        for (const term of expected.forbiddenOutputTerms) {
          expect(serialized).not.toContain(term.toLowerCase());
        }
      }

      // 7. Max Attempts Check
      if (expected.maxAttemptsAllowed !== undefined) {
        expect(result.attemptCount).toBeLessThanOrEqual(expected.maxAttemptsAllowed);
      }

      // 8. Expected Validation OK Check
      if (expected.expectedValidationOk !== undefined) {
        expect(Boolean(result.validation?.ok)).toBe(expected.expectedValidationOk);
      }
    });
  });
});

