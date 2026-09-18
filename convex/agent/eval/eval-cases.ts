/**
 * @fileoverview Versioned Agent Evaluation Dataset (Regression Net).
 *
 * Implements S6-6 T1 & T4:
 * - Dataset Version: "eval-v1"
 * - Prompt Version: "s6-v1"
 *
 * Discipline:
 * ANY change to prompt templates, retrieval projections, tool signatures,
 * guardrails, or model provider adapters MUST re-run this evaluation suite
 * (`npm run eval:agent`) and achieve a 100% deterministic pass rate before shipping.
 */

import { EvalScenario } from "./eval-types";
import { CORE_EVAL_SCENARIOS } from "./eval-cases-core";
import { ADVERSARIAL_EVAL_SCENARIOS } from "./eval-cases-adversarial";

export { EVAL_DATASET_VERSION, EVAL_PROMPT_VERSION } from "./eval-fixtures";
export { CORE_EVAL_SCENARIOS } from "./eval-cases-core";
export { ADVERSARIAL_EVAL_SCENARIOS } from "./eval-cases-adversarial";

export const EVAL_SCENARIOS: readonly EvalScenario[] = [
  ...CORE_EVAL_SCENARIOS,
  ...ADVERSARIAL_EVAL_SCENARIOS,
];
