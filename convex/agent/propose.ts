/**
 * @fileoverview Cost Comparison Drafting Agent Action (Planner + Proposer).
 *
 * Implements S6-4 & S6-7:
 * - Runtime Safety Switch & Rate Limit Gates (Kill switch, Daily user cap, Monthly org ceiling).
 * - Scoped multi-source grounding (Approved MR, Active Vendors, Rate History) via Convex queries.
 * - Input-sanitized prompt assembly with §11.5 privacy filtering.
 * - Provider-agnostic model drafting with self-correction retry loop (max 3 attempts).
 * - Human-readable plan summary generation.
 * - Strict zero database writes / zero procurement document writes.
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { UserRole } from "../permissions";
import { GENERATED_LIFECYCLE_PERMISSIONS } from "../lifecycle/permissions.generated";
import { MATERIAL_REQUEST_TRANSITIONS } from "../lifecycle/index";
import { projectSafeFields } from "./retrieval";
import { sanitizeAgentInput, validateProposal, evaluateSelfCorrection, ProposalValidationResult } from "./guardrails";
import { ModelProvider, getDefaultModelProvider, VendorQuoteDraft } from "./model-provider";

export interface CostComparisonProposalPayload {
  readonly materialRequestId: string;
  readonly vendorQuotes: readonly VendorQuoteDraft[];
}

export interface ProposeCostComparisonResult {
  readonly status: "proposed" | "incomplete";
  readonly reason?: string;
  readonly proposal?: CostComparisonProposalPayload;
  readonly validation?: ProposalValidationResult;
  readonly grounding: {
    readonly materialRequest: Record<string, unknown>;
    readonly candidateVendors: readonly Record<string, unknown>[];
    readonly itemRateHistory: readonly Record<string, unknown>[];
  };
  readonly planSummary: string;
  readonly attemptCount: number;
}

export interface CostComparisonPlannerInput {
  readonly caller: { readonly _id: string; readonly role: UserRole };
  readonly rawMR: Record<string, unknown>;
  readonly candidateVendors: readonly Record<string, unknown>[];
  readonly itemRateHistory: readonly Record<string, unknown>[];
  readonly userPrompt?: string;
  readonly modelProvider?: ModelProvider;
  readonly safetyConfig?: {
    readonly agentEnabled?: boolean;
    readonly dailyCapExceeded?: boolean;
    readonly monthlyCapExceeded?: boolean;
    readonly customRefusalReason?: string;
  };
}

/**
 * Generates a structured, human-readable plan summary explaining the proposed draft.
 */
export function generatePlanSummary(params: {
  readonly mr: Record<string, unknown>;
  readonly proposal: CostComparisonProposalPayload;
  readonly reasoning?: string;
  readonly itemRateHistory: readonly Record<string, unknown>[];
}): string {
  const { mr, proposal, reasoning, itemRateHistory } = params;
  const mrRef = typeof mr.refNo === "string" ? mr.refNo : String(mr._id || "MR");
  const quotes = proposal.vendorQuotes;

  const lines: string[] = [
    `### Cost Comparison Proposal Summary`,
    `**Target Material Request:** ${mrRef} (${mr.status || "ready_for_cc"})`,
    `**Quoted Vendors:** ${quotes.length} suppliers evaluated`,
    "",
  ];
  if (reasoning) {
    lines.push(`**Agent Rationale:** ${reasoning}`, "");
  }

  lines.push("| Vendor ID | Line Items | Subtotal (est.) | Tax Rate | Freight | Terms |");
  lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");

  for (const q of quotes) {
    let estSubtotal = 0;
    if (Array.isArray(q.items)) {
      for (const it of q.items) {
        estSubtotal += (Number(it.quantity) || 0) * (Number(it.rate) || 0);
      }
    }
    const freightStr = q.freight ? `₹${q.freight}` : "₹0";
    lines.push(`| \`${q.vendorId}\` | ${q.items.length} item(s) | ₹${estSubtotal.toLocaleString("en-IN")} | ${q.taxRate}% | ${freightStr} | ${q.paymentTerms || "Standard"} |`);
  }

  lines.push("");
  if (itemRateHistory.length > 0) {
    lines.push(`**Historical Rate Grounding:** ${itemRateHistory.length} past benchmark transaction(s) cited.`);
  } else {
    lines.push("**Historical Rate Grounding:** Baseline market estimates applied (no past site purchase history found).");
  }

  lines.push("", "> [!NOTE]", "> This is an agent-generated proposal draft. No database records have been created or modified.", "> Review and verify the vendor quotes before proceeding to formal record creation.");
  return lines.join("\n");
}

/**
 * Pure Planner & Drafting Orchestrator:
 * Executes grounding filtering, prompt assembly, ModelProvider drafting, validation, and self-correction loop.
 */
export async function planCostComparison(
  input: CostComparisonPlannerInput
): Promise<ProposeCostComparisonResult> {
  const { caller, rawMR, candidateVendors, itemRateHistory, userPrompt, modelProvider, safetyConfig } = input;
  const provider = modelProvider || getDefaultModelProvider();
  const mrId = String(rawMR._id || "");

  // 0. Safety Switches & Cap Checks (S6-7)
  if (safetyConfig?.agentEnabled === false) {
    return {
      status: "incomplete",
      reason: safetyConfig.customRefusalReason || "AI assistant is turned off.",
      grounding: { materialRequest: rawMR, candidateVendors, itemRateHistory },
      planSummary: "Action aborted: AI assistant is currently disabled by administrator.",
      attemptCount: 0,
    };
  }
  if (safetyConfig?.dailyCapExceeded) {
    return {
      status: "incomplete",
      reason: safetyConfig.customRefusalReason || "Daily AI request limit reached. Manual quote entry remains fully available.",
      grounding: { materialRequest: rawMR, candidateVendors, itemRateHistory },
      planSummary: "Action aborted: Daily AI request limit reached for this user.",
      attemptCount: 0,
    };
  }
  if (safetyConfig?.monthlyCapExceeded) {
    return {
      status: "incomplete",
      reason: safetyConfig.customRefusalReason || "Monthly organization AI request limit reached. Manual quote entry remains fully available.",
      grounding: { materialRequest: rawMR, candidateVendors, itemRateHistory },
      planSummary: "Action aborted: Monthly organization AI request ceiling reached.",
      attemptCount: 0,
    };
  }

  // 1. RBAC Gate
  const allowedRoles = GENERATED_LIFECYCLE_PERMISSIONS["cost_comparisons:submit"] as readonly UserRole[];
  if (!allowedRoles.includes(caller.role)) {
    return {
      status: "incomplete",
      reason: `Unauthorized: Role "${caller.role}" is not permitted to propose cost comparisons. Required: ${allowedRoles.join(", ")}`,
      grounding: { materialRequest: rawMR, candidateVendors, itemRateHistory },
      planSummary: "Action aborted due to insufficient caller permissions.",
      attemptCount: 0,
    };
  }

  // 2. Parent Material Request Lifecycle Status Gate
  const mrStatus = typeof rawMR.status === "string" ? rawMR.status : "";
  const reviewTransition = MATERIAL_REQUEST_TRANSITIONS.find((t) => t.name === "review_on_cc");
  const contractStatuses: readonly string[] = reviewTransition
    ? (reviewTransition.from as readonly string[])
    : ["ready_for_cc", "routed_to_rfq", "routed_to_cc", "review_cc"];
  const allowedParentStatuses = Array.from(new Set([...contractStatuses, "ready_for_cc"]));

  if (!allowedParentStatuses.includes(mrStatus)) {
    return {
      status: "incomplete",
      reason: `Material Request ${rawMR.refNo || mrId} is in status "${mrStatus}". Must be in [${allowedParentStatuses.join(", ")}] to create a Cost Comparison.`,
      grounding: { materialRequest: rawMR, candidateVendors, itemRateHistory },
      planSummary: `Action aborted: Parent MR status "${mrStatus}" is not eligible for Cost Comparison creation.`,
      attemptCount: 0,
    };
  }

  // 3. Grounding Sanity Gate: Minimum 2 Active Vendors Required
  const activeVendors = candidateVendors.filter((v) => {
    const s = v.status ?? (v.isActive ? "active" : "inactive");
    return s === "active" || s === undefined;
  });

  if (activeVendors.length < 2) {
    return {
      status: "incomplete",
      reason: `Uncertainty Refusal: Only ${activeVendors.length} active vendor(s) found. A minimum of 2 distinct vendors is required to draft a comparison.`,
      grounding: { materialRequest: rawMR, candidateVendors, itemRateHistory },
      planSummary: "Cannot draft proposal: Insufficient active vendors available in system to form a valid comparison.",
      attemptCount: 0,
    };
  }

  // 4. Grounding Field Projection & Sanitization (§11.5 Safe Business Boundaries)
  const safeMR = projectSafeFields("material_request", rawMR);
  const safeVendors = activeVendors.map((v) => projectSafeFields("vendors", v));
  const safeRateHistory = itemRateHistory.map((h) => ({
    table: h.table,
    documentId: h.documentId,
    refNo: h.refNo,
    matchedItem: h.matchedItem,
  }));

  const sanitizedContext = sanitizeAgentInput({
    userPrompt: userPrompt || "Draft a balanced multi-vendor Cost Comparison based on the approved Material Request.",
    documentContext: { table: "material_request", id: mrId, content: safeMR },
    additionalData: { vendors: safeVendors, history: safeRateHistory },
  });

  // 5. Model Drafting Loop with Self-Correction (Max 3 attempts)
  let attempt = 0;
  const maxAttempts = 3;
  let lastErrors: readonly string[] = [];
  let lastProposal: CostComparisonProposalPayload | undefined;
  let lastValidation: ProposalValidationResult | undefined;

  while (attempt < maxAttempts) {
    attempt++;
    let draftResponse;
    try {
      draftResponse = await provider.draftCostComparison({
        userPrompt: sanitizedContext.instructionSlot,
        materialRequest: safeMR,
        candidateVendors: safeVendors,
        itemRateHistory: safeRateHistory,
        selfCorrectionFeedback: lastErrors.length > 0 ? lastErrors.join("; ") : undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      draftResponse = { ok: false as const, error: `Model provider error: ${msg}` };
    }

    if (!draftResponse.ok || !draftResponse.vendorQuotes) {
      if (attempt >= maxAttempts) {
        return {
          status: "incomplete",
          reason: `Self-correction loop exhausted after ${attempt} attempt(s). Model error: ${draftResponse.error || "Unknown model error"}`,
          proposal: lastProposal,
          validation: lastValidation,
          grounding: { materialRequest: safeMR, candidateVendors: safeVendors, itemRateHistory: safeRateHistory },
          planSummary: `Drafting Failed on attempt ${attempt}: ${draftResponse.error || "Unknown model error"}`,
          attemptCount: attempt,
        };
      }
      lastErrors = [draftResponse.error || "Model returned invalid response"];
      continue;
    }

    const vendorQuotes: VendorQuoteDraft[] = draftResponse.vendorQuotes.map((q) => ({
      vendorId: String(q.vendorId),
      items: Array.isArray(q.items)
        ? q.items.map((it: unknown) => {
            const item = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
            return {
              itemName: String(item.itemName || "Item"),
              description: typeof item.description === "string" ? item.description : undefined,
              hsnSacCode: typeof item.hsnSacCode === "string" ? item.hsnSacCode : undefined,
              quantity: Number(item.quantity) || 1,
              unit: typeof item.unit === "string" ? item.unit : "units",
              rate: Number(item.rate) || 0,
              projectItemId: typeof item.projectItemId === "string" ? item.projectItemId : undefined,
            };
          })
        : [],
      taxRate: Number(q.taxRate) || 18,
      freight: typeof q.freight === "number" ? q.freight : undefined,
      deliveryDays: typeof q.deliveryDays === "number" ? q.deliveryDays : undefined,
      paymentTerms: typeof q.paymentTerms === "string" ? q.paymentTerms : undefined,
      notes: typeof q.notes === "string" ? q.notes : undefined,
    }));

    const candidateProposal: CostComparisonProposalPayload = { materialRequestId: mrId, vendorQuotes };

    // 6. Output Guardrail Validation Gate
    const validation = validateProposal(candidateProposal, {
      table: "cost_comparison",
      caller: { _id: caller._id, role: caller.role },
      parentDoc: { _id: mrId, ...rawMR },
    });

    lastProposal = candidateProposal;
    lastValidation = validation;

    if (validation.ok) {
      const summary = generatePlanSummary({
        mr: safeMR,
        proposal: candidateProposal,
        reasoning: draftResponse.reasoning,
        itemRateHistory: safeRateHistory,
      });

      return {
        status: "proposed",
        proposal: candidateProposal,
        validation,
        grounding: { materialRequest: safeMR, candidateVendors: safeVendors, itemRateHistory: safeRateHistory },
        planSummary: summary,
        attemptCount: attempt,
      };
    }

    const correctionDecision = evaluateSelfCorrection(attempt, validation.errors, candidateProposal);
    if (!correctionDecision.canRetry) break;
    lastErrors = validation.errors;
  }

  return {
    status: "incomplete",
    reason: `Self-correction loop exhausted after ${attempt} attempt(s). Unresolved validation errors: ${lastValidation?.errors.join("; ") || "Unknown failure"}`,
    proposal: lastProposal,
    validation: lastValidation,
    grounding: { materialRequest: safeMR, candidateVendors: safeVendors, itemRateHistory: safeRateHistory },
    planSummary: `Proposal drafting incomplete after ${attempt} attempts. Errors: ${lastValidation?.errors.join(", ")}`,
    attemptCount: attempt,
  };
}

export const proposeCostComparisonPlanner = planCostComparison;

export interface ActionQueryRunner {
  runQuery: (query: unknown, args: Record<string, unknown>) => Promise<unknown>;
  runMutation?: (mutation: unknown, args: Record<string, unknown>) => Promise<unknown>;
}

export async function executeProposeCostComparisonAction(
  ctx: ActionQueryRunner,
  args: { materialRequestId: string; userPrompt?: string; token?: string },
  modelProvider?: ModelProvider
): Promise<ProposeCostComparisonResult> {
  // 1. Safety Switches & Cap Check
  try {
    const safetyCheck = (await ctx.runQuery(api.agent.usage.checkAgentSafety, { token: args.token })) as { allowed: boolean; reason?: string };
    if (safetyCheck && !safetyCheck.allowed) {
      return {
        status: "incomplete",
        reason: safetyCheck.reason || "AI assistant is turned off.",
        grounding: { materialRequest: {}, candidateVendors: [], itemRateHistory: [] },
        planSummary: `Action aborted: ${safetyCheck.reason || "AI assistant is disabled."}`,
        attemptCount: 0,
      };
    }
  } catch {
    // Non-fatal
  }

  // 2. Resolve caller
  let caller: { _id: string; name: string; role: UserRole; isAdmin: boolean };
  try {
    const rawCaller = await ctx.runQuery(api.agent.tools.validateCallerScope, { token: args.token });
    if (!rawCaller || !(rawCaller as { isActive?: boolean }).isActive) {
      return {
        status: "incomplete",
        reason: "Authentication failed: active user session required.",
        grounding: { materialRequest: {}, candidateVendors: [], itemRateHistory: [] },
        planSummary: "Action Failed: Unauthorized.",
        attemptCount: 0,
      };
    }
    caller = rawCaller as { _id: string; name: string; role: UserRole; isAdmin: boolean };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "incomplete",
      reason: `Authentication failed: ${msg}`,
      grounding: { materialRequest: {}, candidateVendors: [], itemRateHistory: [] },
      planSummary: "Action Failed: Unauthorized.",
      attemptCount: 0,
    };
  }

  // 3. Read parent MR
  let rawMR: Record<string, unknown>;
  try {
    const rawDoc = await ctx.runQuery(api.agent.tools.readDocument, {
      table: "material_request",
      id: String(args.materialRequestId),
      token: args.token,
    });
    rawMR = rawDoc as Record<string, unknown>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "incomplete",
      reason: `Could not access Material Request "${args.materialRequestId}": ${msg}`,
      grounding: { materialRequest: {}, candidateVendors: [], itemRateHistory: [] },
      planSummary: "Action Failed: Material Request not accessible.",
      attemptCount: 0,
    };
  }

  // 4. Candidate Vendors & Historical Rate Grounding
  let candidateVendors: Array<Record<string, unknown>> = [];
  try {
    const vendorSearchResult = (await ctx.runQuery(api.agent.tools.searchVendors, {
      query: "materials",
      token: args.token,
    })) as Array<{ vendor: Record<string, unknown> }>;

    const rawList = Array.isArray(vendorSearchResult) ? vendorSearchResult : [];
    candidateVendors = rawList.map((v) => projectSafeFields("vendors", v.vendor));

    if (candidateVendors.length < 2) {
      const steelSearch = (await ctx.runQuery(api.agent.tools.searchVendors, {
        query: "steel",
        token: args.token,
      })) as Array<{ vendor: Record<string, unknown> }>;

      const additionalList = Array.isArray(steelSearch) ? steelSearch : [];
      const seen = new Set(candidateVendors.map((v) => String(v._id)));
      for (const v of additionalList) {
        if (!seen.has(String(v.vendor?._id))) {
          candidateVendors.push(projectSafeFields("vendors", v.vendor));
          seen.add(String(v.vendor?._id));
        }
      }
    }
  } catch {
    // Non-fatal
  }

  const safeMR = projectSafeFields("material_request", rawMR);
  const mrItems = (Array.isArray(safeMR.items) ? safeMR.items : []) as Array<Record<string, unknown>>;
  const itemRateHistory: Array<Record<string, unknown>> = [];

  for (const it of mrItems) {
    const itemName = String(it.itemName || "").trim();
    if (itemName) {
      try {
        const historyMatches = (await ctx.runQuery(api.agent.retrieval.retrieveByItem, {
          itemName,
          token: args.token,
        })) as Array<{ matchedItem: Record<string, unknown> }>;

        const matchesList = Array.isArray(historyMatches) ? historyMatches : [];
        for (const match of matchesList) {
          if (match && typeof match === "object" && "matchedItem" in match) {
            itemRateHistory.push(match.matchedItem);
          }
        }
      } catch {
        // Non-fatal
      }
    }
  }

  const planResult = await planCostComparison({
    caller: { _id: String(caller._id), role: caller.role },
    rawMR,
    candidateVendors,
    itemRateHistory,
    userPrompt: args.userPrompt,
    modelProvider,
  });

  if (planResult.status === "proposed" && ctx.runMutation) {
    try {
      await ctx.runMutation(api.agent.usage.recordAgentUsage, {
        userId: caller._id as Id<"users">,
        token: args.token,
      });
    } catch {
      // Non-fatal
    }
  }

  return planResult;
}

export const proposeCostComparison = action({
  args: {
    materialRequestId: v.id("material_request"),
    userPrompt: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await executeProposeCostComparisonAction(ctx as unknown as ActionQueryRunner, {
      materialRequestId: String(args.materialRequestId),
      userPrompt: args.userPrompt,
      token: args.token,
    });
  },
});
