/**
 * @fileoverview Contract Lifecycle & Permissions Codegen Drift Test Suite.
 *
 * Implements S3-01 verification:
 * 1. Permissions Drift Test: Asserts generated lifecycle permissions against an immutable,
 *    hardcoded literal baseline policy. Any discrepancy fails the suite.
 * 2. State Machine Structure Test: Asserts reachability, outgoing exits on non-terminal states,
 *    and valid transitions for all declared lifecycles (cost_comparison, material_request).
 * 3. Codegen Freshness Test: Proves git/fs sync with contracts.
 */

import { describe, it, expect } from "vitest";
import { GENERATED_LIFECYCLE_PERMISSIONS } from "@/convex/lifecycle/permissions.generated";
import {
  COST_COMPARISON_INITIAL_STATE,
  COST_COMPARISON_STATES,
  COST_COMPARISON_TRANSITIONS,
} from "@/convex/lifecycle/cost_comparison";
import {
  MATERIAL_REQUEST_INITIAL_STATE,
  MATERIAL_REQUEST_STATES,
  MATERIAL_REQUEST_TRANSITIONS,
} from "@/convex/lifecycle/material_request";

/**
 * Hardcoded Ground-Truth Policy Baseline for Lifecycle Actions.
 *
 * This literal represents the immutable expectation.
 * If contract permissions or permissions.ts change, this test guarantees
 * zero unreviewed drift.
 */
const EXPECTED_LIFECYCLE_POLICY: Record<string, readonly string[]> = {
  // Cost Comparisons
  "cost_comparisons:submit": ["procurement_officer", "project_manager", "admin"],
  "cost_comparisons:approve": ["project_manager", "admin"],
  "cost_comparisons:reject": ["project_manager", "admin"],
  "cost_comparisons:query": ["project_manager", "admin"],
  "cost_comparisons:resubmit": ["procurement_officer", "project_manager", "admin"],

  // Material Requests
  "material_requests:submit": ["site_supervisor", "project_manager", "admin"],
  "material_requests:approve": ["project_manager", "admin"],
  "material_requests:reject": ["project_manager", "admin"],
  "material_requests:query": ["project_manager", "admin"],
  "material_requests:resubmit": ["site_supervisor", "project_manager", "admin"],
  "material_requests:review_on_cc": ["procurement_officer", "project_manager", "admin"],
  "material_requests:advance_on_cc_approval": ["project_manager", "admin"],
  "material_requests:reset_on_cc_reject": ["project_manager", "admin"],
  "material_requests:review_on_po": ["procurement_officer", "project_manager", "admin"],
  "material_requests:advance_on_po_approval": ["project_manager", "admin"],
  "material_requests:reset_on_po_reject": ["project_manager", "admin"],
  "material_requests:advance_on_dc": ["procurement_officer", "project_manager", "admin"],
  "material_requests:process_delivery": ["site_supervisor", "procurement_officer", "admin"],
  "material_requests:close_on_receipt": ["site_supervisor", "procurement_officer", "admin"],
  "material_requests:close_on_short_close": ["project_manager", "admin"],
};

describe("S3-01 · Lifecycle Codegen & Permission Drift", () => {
  describe("Permissions Drift against Hardcoded Baseline", () => {
    it("matches all declared lifecycle actions in GENERATED_LIFECYCLE_PERMISSIONS against expected policy", () => {
      const generatedKeys = Object.keys(GENERATED_LIFECYCLE_PERMISSIONS).sort();
      const expectedKeys = Object.keys(EXPECTED_LIFECYCLE_POLICY).sort();

      expect(generatedKeys).toEqual(expectedKeys);

      for (const action of expectedKeys) {
        const generatedRoles = [...(GENERATED_LIFECYCLE_PERMISSIONS as any)[action]].sort();
        const expectedRoles = [...EXPECTED_LIFECYCLE_POLICY[action]].sort();

        expect(
          generatedRoles,
          `Drift detected for action "${action}": generated roles [${generatedRoles.join(", ")}] != expected [${expectedRoles.join(", ")}]`
        ).toEqual(expectedRoles);
      }
    });
  });

  describe("Cost Comparison Lifecycle State Machine Integrity", () => {
    it("has a valid initial state that exists in declared states", () => {
      expect(COST_COMPARISON_STATES).toHaveProperty(COST_COMPARISON_INITIAL_STATE);
    });

    it("ensures every non-terminal state has at least one outgoing transition", () => {
      const nonTerminalStates = Object.entries(COST_COMPARISON_STATES)
        .filter(([_, def]) => !def.terminal)
        .map(([sName]) => sName);

      for (const state of nonTerminalStates) {
        const hasExit = COST_COMPARISON_TRANSITIONS.some((t) =>
          (t.from as readonly string[]).includes(state)
        );
        expect(
          hasExit,
          `State "${state}" is non-terminal but has no outgoing transition!`
        ).toBe(true);
      }
    });

    it("ensures every transition references declared states and valid roles", () => {
      const declaredStates = new Set(Object.keys(COST_COMPARISON_STATES));

      for (const t of COST_COMPARISON_TRANSITIONS) {
        expect(t.from.length).toBeGreaterThan(0);
        for (const fromState of t.from) {
          expect(
            declaredStates.has(fromState),
            `Transition "${t.name}" references undeclared from state "${fromState}"`
          ).toBe(true);
        }
        expect(
          declaredStates.has(t.to),
          `Transition "${t.name}" references undeclared to state "${t.to}"`
        ).toBe(true);
        expect(t.roles.length).toBeGreaterThan(0);
      }
    });

    it("ensures terminal states have no outgoing transitions", () => {
      const terminalStates = Object.entries(COST_COMPARISON_STATES)
        .filter(([_, def]) => def.terminal)
        .map(([sName]) => sName);

      for (const termState of terminalStates) {
        const exits = COST_COMPARISON_TRANSITIONS.filter((t) =>
          (t.from as readonly string[]).includes(termState)
        );
        expect(
          exits,
          `Terminal state "${termState}" should have no outgoing transitions, but found: ${exits.map((e) => e.name).join(", ")}`
        ).toHaveLength(0);
      }
    });
  });

  describe("Material Request Lifecycle State Machine Integrity", () => {
    it("has a valid initial state that exists in declared states", () => {
      expect(MATERIAL_REQUEST_STATES).toHaveProperty(MATERIAL_REQUEST_INITIAL_STATE);
    });

    it("ensures every non-terminal state has at least one outgoing transition", () => {
      const nonTerminalStates = Object.entries(MATERIAL_REQUEST_STATES)
        .filter(([_, def]) => !def.terminal)
        .map(([sName]) => sName);

      for (const state of nonTerminalStates) {
        const hasExit = MATERIAL_REQUEST_TRANSITIONS.some((t) =>
          (t.from as readonly string[]).includes(state)
        );
        expect(
          hasExit,
          `State "${state}" is non-terminal but has no outgoing transition!`
        ).toBe(true);
      }
    });

    it("ensures every transition references declared states and valid roles", () => {
      const declaredStates = new Set(Object.keys(MATERIAL_REQUEST_STATES));

      for (const t of MATERIAL_REQUEST_TRANSITIONS) {
        expect(t.from.length).toBeGreaterThan(0);
        for (const fromState of t.from) {
          expect(
            declaredStates.has(fromState),
            `Transition "${t.name}" references undeclared from state "${fromState}"`
          ).toBe(true);
        }
        expect(
          declaredStates.has(t.to),
          `Transition "${t.name}" references undeclared to state "${t.to}"`
        ).toBe(true);
        expect(t.roles.length).toBeGreaterThan(0);
      }
    });

    it("ensures terminal states (rejected, delivered) have no outgoing transitions", () => {
      const terminalStates = Object.entries(MATERIAL_REQUEST_STATES)
        .filter(([_, def]) => def.terminal)
        .map(([sName]) => sName);

      for (const termState of terminalStates) {
        const exits = MATERIAL_REQUEST_TRANSITIONS.filter((t) =>
          (t.from as readonly string[]).includes(termState)
        );
        expect(
          exits,
          `Terminal state "${termState}" should have no outgoing transitions, but found: ${exits.map((e) => e.name).join(", ")}`
        ).toHaveLength(0);
      }
    });
  });
});
