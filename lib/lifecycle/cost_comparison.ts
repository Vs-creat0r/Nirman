// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import type { CostComparisonStatus } from "@/lib/schemas/cost_comparison";

export type CostComparisonStateKind = "editable" | "locked" | "closed" | "in_transit" | "received";

export const COST_COMPARISON_OPEN_STATES: readonly CostComparisonStatus[] = ["draft", "submitted", "queried"] as const;

export const COST_COMPARISON_CLOSED_STATES: readonly CostComparisonStatus[] = ["approved", "rejected"] as const;

export const COST_COMPARISON_EDITABLE_STATES: readonly CostComparisonStatus[] = ["draft", "queried"] as const;

export const COST_COMPARISON_LOCKED_STATES: readonly CostComparisonStatus[] = ["submitted"] as const;

export const COST_COMPARISON_STATUS_BADGES: Record<
  CostComparisonStatus,
  { readonly label: string; readonly variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  submitted: { label: "Submitted", variant: "default" },
  queried: { label: "Queried", variant: "destructive" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
} as const;
