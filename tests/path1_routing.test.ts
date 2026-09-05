/**
 * @fileoverview Path-1 Routing (MR -> RFQ vs Direct CC) Test Suite.
 *
 * Verifies:
 * 1. Approved MR in "ready_for_cc" status can branch to:
 *    - "routed_to_rfq" via transition "send_to_rfq"
 *    - "routed_to_cc" via transition "send_to_cc"
 * 2. Downstream convergence: both "routed_to_rfq" and "routed_to_cc" can
 *    advance to "review_cc" when Cost Comparison is submitted.
 * 3. Authorized roles: project_manager, procurement_officer, admin.
 */

import { describe, it, expect } from "vitest";
import {
  MATERIAL_REQUEST_STATES,
  MATERIAL_REQUEST_TRANSITIONS,
} from "@/convex/lifecycle/material_request";

describe("Path-1 Routing Transitions (Material Request -> RFQ / CC)", () => {
  it("registers routed_to_rfq and routed_to_cc states in the lifecycle registry", () => {
    expect(MATERIAL_REQUEST_STATES).toHaveProperty("routed_to_rfq");
    expect(MATERIAL_REQUEST_STATES).toHaveProperty("routed_to_cc");
    expect(MATERIAL_REQUEST_STATES.routed_to_rfq.kind).toBe("locked");
    expect(MATERIAL_REQUEST_STATES.routed_to_cc.kind).toBe("locked");
  });

  it("permits send_to_rfq transition from ready_for_cc", () => {
    const sendToRfq = MATERIAL_REQUEST_TRANSITIONS.find((t) => t.name === "send_to_rfq");
    expect(sendToRfq).toBeDefined();
    expect(sendToRfq?.from).toContain("ready_for_cc");
    expect(sendToRfq?.to).toBe("routed_to_rfq");
    expect(sendToRfq?.roles).toContain("project_manager");
    expect(sendToRfq?.roles).toContain("procurement_officer");
    expect(sendToRfq?.roles).toContain("admin");
  });

  it("permits send_to_cc transition from ready_for_cc", () => {
    const sendToCc = MATERIAL_REQUEST_TRANSITIONS.find((t) => t.name === "send_to_cc");
    expect(sendToCc).toBeDefined();
    expect(sendToCc?.from).toContain("ready_for_cc");
    expect(sendToCc?.to).toBe("routed_to_cc");
    expect(sendToCc?.roles).toContain("project_manager");
    expect(sendToCc?.roles).toContain("procurement_officer");
    expect(sendToCc?.roles).toContain("admin");
  });

  it("allows review_on_cc from ready_for_cc, routed_to_rfq, and routed_to_cc", () => {
    const reviewOnCc = MATERIAL_REQUEST_TRANSITIONS.find((t) => t.name === "review_on_cc");
    expect(reviewOnCc).toBeDefined();
    expect(reviewOnCc?.from).toContain("ready_for_cc");
    expect(reviewOnCc?.from).toContain("routed_to_rfq");
    expect(reviewOnCc?.from).toContain("routed_to_cc");
    expect(reviewOnCc?.to).toBe("review_cc");
  });
});
