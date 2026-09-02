/**
 * @fileoverview Lifecycle Guard Evaluators.
 *
 * Implements declarative validation guards declared in contracts/ JSON definitions.
 * Guards are pure functions that evaluate document state and return pass/fail with
 * human-readable failure reasons.
 */

export interface GuardResult {
  passed: boolean;
  reason?: string;
}

export type GuardName = "hasAtLeastOneItem" | "hasAtLeastTwoQuotes" | "hasSelectedVendor";

export function evaluateGuard(guardName: string, doc: Record<string, unknown>): GuardResult {
  switch (guardName) {
    case "hasAtLeastOneItem": {
      const items = doc.items;
      if (!Array.isArray(items) || items.length === 0) {
        return {
          passed: false,
          reason: "Material Request must contain at least one line item.",
        };
      }
      return { passed: true };
    }

    case "hasAtLeastTwoQuotes": {
      const quotes = doc.vendorQuotes;
      if (!Array.isArray(quotes) || quotes.length < 2) {
        return {
          passed: false,
          reason: "Cost comparison requires at least 2 vendor quotes before submission.",
        };
      }
      return { passed: true };
    }

    case "hasSelectedVendor": {
      if (!doc.selectedVendorId) {
        return {
          passed: false,
          reason: "A winning vendor quote must be selected before approval.",
        };
      }
      return { passed: true };
    }

    default:
      throw new Error(`Unknown lifecycle guard: "${guardName}". All guards must be registered in guards.ts and generate-from-contracts.mjs.`);
  }
}
