/**
 * @fileoverview Type definitions for Nirman Agent Evaluation Suite (Regression Net).
 *
 * Implements S6-6 T1:
 * Structured evaluation schemas for versioned scenarios, expected outcome assertions,
 * and test scoring metrics across golden paths, adversarial attacks, and refusal boundaries.
 */

import { UserRole } from "../../permissions";
import { VendorQuoteDraft, DraftCostComparisonContext, DraftCostComparisonResult } from "../model-provider";

export type EvalCategory =
  | "golden_path"
  | "rbac_refusal"
  | "lifecycle_refusal"
  | "uncertainty_refusal"
  | "adversarial_injection"
  | "self_correction"
  | "model_failure";

export interface ExpectedOutcomeSpec {
  readonly status: "proposed" | "incomplete";
  readonly minQuotes?: number;
  readonly maxQuotes?: number;
  readonly distinctVendors?: boolean;
  readonly expectedVendorIds?: readonly string[];
  readonly expectedReasonContains?: readonly string[];
  readonly forbiddenOutputTerms?: readonly string[];
  readonly maxAttemptsAllowed?: number;
  readonly expectedValidationOk?: boolean;
}

export interface EvalInputContext {
  readonly caller: {
    readonly _id: string;
    readonly name: string;
    readonly role: UserRole;
    readonly isActive?: boolean;
  };
  readonly rawMR: Record<string, unknown>;
  readonly candidateVendors: readonly Record<string, unknown>[];
  readonly itemRateHistory: readonly Record<string, unknown>[];
  readonly userPrompt?: string;
  readonly fakeModelConfig?: {
    readonly defaultQuotes?: readonly VendorQuoteDraft[];
    readonly defaultError?: string;
    readonly customHandler?: (
      ctx: DraftCostComparisonContext,
      attempt: number
    ) => Promise<DraftCostComparisonResult> | DraftCostComparisonResult;
  };
}

export interface EvalScenario {
  readonly id: string;
  readonly name: string;
  readonly category: EvalCategory;
  readonly description: string;
  readonly datasetVersion: string;
  readonly promptVersion: string;
  readonly input: EvalInputContext;
  readonly expected: ExpectedOutcomeSpec;
}

export interface EvalScenarioResult {
  readonly scenarioId: string;
  readonly name: string;
  readonly category: EvalCategory;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly actualStatus: "proposed" | "incomplete";
  readonly attemptsUsed: number;
  readonly failureReasons: readonly string[];
}

export interface CategoryScore {
  readonly category: EvalCategory;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
}

export interface EvalSummary {
  readonly datasetVersion: string;
  readonly promptVersion: string;
  readonly timestamp: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
  readonly byCategory: Record<EvalCategory, CategoryScore>;
  readonly results: readonly EvalScenarioResult[];
}

