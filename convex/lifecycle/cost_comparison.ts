// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

export interface CascadeRule {
  readonly table: string;
  readonly from: readonly string[];
  readonly to: string;
}

export interface TransitionDef<TState extends string = string, TRole extends string = string> {
  readonly name: string;
  readonly label?: string;
  readonly from: readonly TState[];
  readonly to: TState;
  readonly roles: readonly TRole[];
  readonly actor?: string;
  readonly guards?: readonly string[];
  readonly cascades?: readonly CascadeRule[];
  readonly requiresNote?: boolean;
}

export type CostComparisonState = "draft" | "submitted" | "queried" | "rejected" | "approved";

export const COST_COMPARISON_INITIAL_STATE: CostComparisonState = "draft";

export const COST_COMPARISON_STATES = {
  draft: { kind: "editable", owner: "creator", terminal: false, badge: { label: "Draft", variant: "secondary" } },
  submitted: { kind: "locked", owner: "none", terminal: false, badge: { label: "Submitted", variant: "default" } },
  queried: { kind: "editable", owner: "creator", terminal: false, badge: { label: "Queried", variant: "destructive" } },
  approved: { kind: "closed", owner: "none", terminal: true, badge: { label: "Approved", variant: "default" } },
  rejected: { kind: "closed", owner: "none", terminal: true, badge: { label: "Rejected", variant: "destructive" } },
} as const;

export const COST_COMPARISON_TRANSITIONS = [
  {
    name: "submit",
    label: "Submit for Review",
    from: ["draft", "queried"] as const,
    to: "submitted",
    roles: ["procurement_officer", "project_manager", "admin"] as const,
    actor: "creator",
    guards: ["hasAtLeastTwoQuotes"] as const,
    cascades: [
      { table: "material_request", from: ["ready_for_cc", "review_cc"] as const, to: "review_cc" }
    ] as const,
  },
  {
    name: "approve",
    label: "Approve Quotes",
    from: ["submitted"] as const,
    to: "approved",
    roles: ["project_manager", "admin"] as const,
    actor: "approver",
    guards: ["hasSelectedVendor"] as const,
    cascades: [
      { table: "material_request", from: ["review_cc"] as const, to: "ready_for_po" }
    ] as const,
  },
  {
    name: "reject",
    label: "Reject Quotes",
    from: ["submitted"] as const,
    to: "rejected",
    roles: ["project_manager", "admin"] as const,
    actor: "approver",
    cascades: [
      { table: "material_request", from: ["review_cc"] as const, to: "ready_for_cc" }
    ] as const,
    requiresNote: true,
  },
  {
    name: "query",
    label: "Query Quotes",
    from: ["submitted"] as const,
    to: "queried",
    roles: ["project_manager", "admin"] as const,
    actor: "approver",
    requiresNote: true,
  },
  {
    name: "resubmit",
    label: "Resubmit for Review",
    from: ["queried"] as const,
    to: "submitted",
    roles: ["procurement_officer", "project_manager", "admin"] as const,
    actor: "creator",
    cascades: [
      { table: "material_request", from: ["ready_for_cc", "review_cc"] as const, to: "review_cc" }
    ] as const,
  },
] as const satisfies readonly TransitionDef<CostComparisonState>[];

export type CostComparisonTransitionName = (typeof COST_COMPARISON_TRANSITIONS)[number]["name"];
