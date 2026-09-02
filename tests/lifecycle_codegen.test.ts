/**
 * @fileoverview Contract Lifecycle & Permissions Codegen Drift Test Suite.
 *
 * Implements S3-01 & S3-05 Gate 1 verification:
 * 1. Permissions Drift Test: Asserts generated lifecycle permissions against an immutable,
 *    hardcoded literal baseline policy for all 4 machines. Any discrepancy fails the suite.
 * 2. State Machine Structure Test: Asserts reachability, outgoing exits on non-terminal states,
 *    and valid transitions for all declared lifecycles (cost_comparison, material_request, purchase_order, delivery_challan).
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
import {
  PURCHASE_ORDER_INITIAL_STATE,
  PURCHASE_ORDER_STATES,
  PURCHASE_ORDER_TRANSITIONS,
} from "@/convex/lifecycle/purchase_order";
import {
  DELIVERY_CHALLAN_INITIAL_STATE,
  DELIVERY_CHALLAN_STATES,
  DELIVERY_CHALLAN_TRANSITIONS,
} from "@/convex/lifecycle/delivery_challan";

/**
 * Hardcoded Ground-Truth Policy Baseline for Lifecycle Actions.
 *
 * This literal represents the immutable expectation for all 4 state machines.
 * Any drift between contracts and this policy fails the gate.
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

  // Purchase Orders
  "purchase_orders:submit": ["procurement_officer", "project_manager", "admin"],
  "purchase_orders:approve": ["project_manager", "admin"],
  "purchase_orders:reject": ["project_manager", "admin"],
  "purchase_orders:query": ["project_manager", "admin"],
  "purchase_orders:resubmit": ["procurement_officer", "project_manager", "admin"],
  "purchase_orders:cancel": ["project_manager", "admin"],
  "purchase_orders:close": ["project_manager", "admin"],
  "purchase_orders:close_on_receipt": ["site_supervisor", "procurement_officer", "admin"],

  // Delivery Challans
  "delivery_challans:dispatch": ["procurement_officer", "project_manager", "admin"],
  "delivery_challans:deliver": ["site_supervisor", "procurement_officer", "admin"],
  "delivery_challans:cancel": ["procurement_officer", "project_manager", "admin"],
};

describe("S3-01 / S3-05 · Lifecycle Codegen & Permission Drift", () => {
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
        expect(declaredStates.has(t.to)).toBe(true);
        for (const f of t.from) {
          expect(declaredStates.has(f)).toBe(true);
        }
        expect(t.roles.length).toBeGreaterThan(0);
      }
    });

    it("validates BFS reachability from initial state to all states", () => {
      const reachable = new Set<string>([COST_COMPARISON_INITIAL_STATE]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of COST_COMPARISON_TRANSITIONS) {
          const fromReachable = t.from.some((f) => reachable.has(f));
          if (fromReachable && !reachable.has(t.to)) {
            reachable.add(t.to);
            changed = true;
          }
        }
      }

      const allStates = Object.keys(COST_COMPARISON_STATES);
      for (const state of allStates) {
        expect(
          reachable.has(state),
          `State "${state}" in cost_comparison is unreachable from initial state "${COST_COMPARISON_INITIAL_STATE}"!`
        ).toBe(true);
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
        expect(declaredStates.has(t.to)).toBe(true);
        for (const f of t.from) {
          expect(declaredStates.has(f)).toBe(true);
        }
        expect(t.roles.length).toBeGreaterThan(0);
      }
    });

    it("validates BFS reachability from initial state to all states", () => {
      const reachable = new Set<string>([MATERIAL_REQUEST_INITIAL_STATE]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of MATERIAL_REQUEST_TRANSITIONS) {
          const fromReachable = t.from.some((f) => reachable.has(f));
          if (fromReachable && !reachable.has(t.to)) {
            reachable.add(t.to);
            changed = true;
          }
        }
      }

      const allStates = Object.keys(MATERIAL_REQUEST_STATES);
      for (const state of allStates) {
        expect(
          reachable.has(state),
          `State "${state}" in material_request is unreachable from initial state "${MATERIAL_REQUEST_INITIAL_STATE}"!`
        ).toBe(true);
      }
    });
  });

  describe("Purchase Order Lifecycle State Machine Integrity", () => {
    it("has a valid initial state that exists in declared states", () => {
      expect(PURCHASE_ORDER_STATES).toHaveProperty(PURCHASE_ORDER_INITIAL_STATE);
    });

    it("ensures every non-terminal state has at least one outgoing transition", () => {
      const nonTerminalStates = Object.entries(PURCHASE_ORDER_STATES)
        .filter(([_, def]) => !def.terminal)
        .map(([sName]) => sName);

      for (const state of nonTerminalStates) {
        const hasExit = PURCHASE_ORDER_TRANSITIONS.some((t) =>
          (t.from as readonly string[]).includes(state)
        );
        expect(
          hasExit,
          `State "${state}" is non-terminal but has no outgoing transition!`
        ).toBe(true);
      }
    });

    it("ensures every transition references declared states and valid roles", () => {
      const declaredStates = new Set(Object.keys(PURCHASE_ORDER_STATES));
      for (const t of PURCHASE_ORDER_TRANSITIONS) {
        expect(declaredStates.has(t.to)).toBe(true);
        for (const f of t.from) {
          expect(declaredStates.has(f)).toBe(true);
        }
        expect(t.roles.length).toBeGreaterThan(0);
      }
    });

    it("validates BFS reachability from initial state to all PO states", () => {
      const reachable = new Set<string>([PURCHASE_ORDER_INITIAL_STATE]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of PURCHASE_ORDER_TRANSITIONS) {
          const fromReachable = t.from.some((f) => reachable.has(f));
          if (fromReachable && !reachable.has(t.to)) {
            reachable.add(t.to);
            changed = true;
          }
        }
      }

      const allStates = Object.keys(PURCHASE_ORDER_STATES);
      for (const state of allStates) {
        expect(
          reachable.has(state),
          `State "${state}" in purchase_order is unreachable from initial state "${PURCHASE_ORDER_INITIAL_STATE}"!`
        ).toBe(true);
      }
    });
  });

  describe("Delivery Challan Lifecycle State Machine Integrity", () => {
    it("has a valid initial state that exists in declared states", () => {
      expect(DELIVERY_CHALLAN_STATES).toHaveProperty(DELIVERY_CHALLAN_INITIAL_STATE);
    });

    it("ensures every non-terminal state has at least one outgoing transition", () => {
      const nonTerminalStates = Object.entries(DELIVERY_CHALLAN_STATES)
        .filter(([_, def]) => !def.terminal)
        .map(([sName]) => sName);

      for (const state of nonTerminalStates) {
        const hasExit = DELIVERY_CHALLAN_TRANSITIONS.some((t) =>
          (t.from as readonly string[]).includes(state)
        );
        expect(
          hasExit,
          `State "${state}" is non-terminal but has no outgoing transition!`
        ).toBe(true);
      }
    });

    it("ensures every transition references declared states and valid roles", () => {
      const declaredStates = new Set(Object.keys(DELIVERY_CHALLAN_STATES));
      for (const t of DELIVERY_CHALLAN_TRANSITIONS) {
        expect(declaredStates.has(t.to)).toBe(true);
        for (const f of t.from) {
          expect(declaredStates.has(f)).toBe(true);
        }
        expect(t.roles.length).toBeGreaterThan(0);
      }
    });

    it("validates BFS reachability from initial state to all DC states", () => {
      const reachable = new Set<string>([DELIVERY_CHALLAN_INITIAL_STATE]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of DELIVERY_CHALLAN_TRANSITIONS) {
          const fromReachable = t.from.some((f) => reachable.has(f));
          if (fromReachable && !reachable.has(t.to)) {
            reachable.add(t.to);
            changed = true;
          }
        }
      }

      const allStates = Object.keys(DELIVERY_CHALLAN_STATES);
      for (const state of allStates) {
        expect(
          reachable.has(state),
          `State "${state}" in delivery_challan is unreachable from initial state "${DELIVERY_CHALLAN_INITIAL_STATE}"!`
        ).toBe(true);
      }
    });
  });
});
