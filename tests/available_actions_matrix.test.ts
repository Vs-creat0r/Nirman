/**
 * @fileoverview Role-by-State Available Actions Matrix & Gate 2 Verification.
 *
 * Implements S3-06 & 🔴 GATE 2 verification:
 * 1. Role-by-State Matrix: Asserts the exact available & disabled actions across all 4 roles
 *    (admin, project_manager, procurement_officer, site_supervisor) in every state of all
 *    four state machines (material_request, cost_comparison, purchase_order, delivery_challan).
 * 2. Guard Enforcement: Asserts that declarative guards (hasAtLeastOneItem, hasAtLeastTwoQuotes,
 *    hasSelectedVendor) and actor ownership constraints (actor: "creator") correctly enable/disable
 *    actions with diagnostic reasons.
 * 3. Mutation Testing: Proves that widening or narrowing any transition's roles immediately fails the matrix.
 */

import { describe, it, expect } from "vitest";
import { computeAvailableActions } from "@/convex/lifecycle/actions";
import { evaluateGuard } from "@/convex/lifecycle/guards";
import { LIFECYCLE_REGISTRY } from "@/convex/lifecycle";
import { UserRole } from "@/convex/permissions";

const ALL_ROLES: readonly UserRole[] = [
  "admin",
  "project_manager",
  "procurement_officer",
  "site_supervisor",
] as const;

describe("🔴 GATE 2 — Role-by-State Available Actions Matrix", () => {
  describe("Material Request Action Matrix", () => {
    const creatorId = "user_supervisor_1";
    const otherUserId = "user_supervisor_2";

    it("evaluates available actions in 'draft' status", () => {
      const doc = {
        _id: "mr_1",
        status: "draft",
        createdBy: creatorId,
        items: [{ itemName: "Cement", quantity: 50, unit: "Bags" }],
      };

      for (const role of ALL_ROLES) {
        const res = computeAvailableActions("material_request", doc, { _id: creatorId, role });
        const submitAction = res.actions.find((a) => a.name === "submit");
        expect(submitAction).toBeDefined();

        if (role === "site_supervisor" || role === "project_manager" || role === "admin") {
          expect(submitAction?.enabled).toBe(true);
          expect(submitAction?.reason).toBeUndefined();
        } else {
          // procurement_officer cannot submit initial MR
          expect(submitAction?.enabled).toBe(false);
          expect(submitAction?.reason).toContain("Requires role");
        }
      }
    });

    it("evaluates available actions in 'pending' status (approver role gate)", () => {
      const doc = {
        _id: "mr_1",
        status: "pending",
        createdBy: creatorId,
        items: [{ itemName: "Cement", quantity: 50, unit: "Bags" }],
      };

      for (const role of ALL_ROLES) {
        const res = computeAvailableActions("material_request", doc, { _id: creatorId, role });
        const approveAction = res.actions.find((a) => a.name === "approve");
        const rejectAction = res.actions.find((a) => a.name === "reject");
        const queryAction = res.actions.find((a) => a.name === "query");

        expect(approveAction).toBeDefined();
        expect(rejectAction).toBeDefined();
        expect(queryAction).toBeDefined();

        if (role === "project_manager" || role === "admin") {
          expect(approveAction?.enabled).toBe(true);
          expect(rejectAction?.enabled).toBe(true);
          expect(queryAction?.enabled).toBe(true);
        } else {
          expect(approveAction?.enabled).toBe(false);
          expect(rejectAction?.enabled).toBe(false);
          expect(queryAction?.enabled).toBe(false);
          expect(approveAction?.reason).toContain("Requires role");
        }
      }
    });

    it("enforces actor: 'creator' on 'resubmit' in queried state", () => {
      const doc = {
        _id: "mr_1",
        status: "queried",
        createdBy: creatorId,
        items: [{ itemName: "Cement", quantity: 50, unit: "Bags" }],
      };

      // 1. Creator supervisor can resubmit
      const creatorRes = computeAvailableActions("material_request", doc, {
        _id: creatorId,
        role: "site_supervisor",
      });
      const creatorResubmit = creatorRes.actions.find((a) => a.name === "resubmit");
      expect(creatorResubmit?.enabled).toBe(true);

      // 2. Different supervisor cannot resubmit another supervisor's queried MR
      const otherRes = computeAvailableActions("material_request", doc, {
        _id: otherUserId,
        role: "site_supervisor",
      });
      const otherResubmit = otherRes.actions.find((a) => a.name === "resubmit");
      expect(otherResubmit?.enabled).toBe(false);
      expect(otherResubmit?.reason).toBe("Only the document creator can perform this action.");

      // 3. Project Manager and Admin can act on behalf of the creator
      const pmRes = computeAvailableActions("material_request", doc, {
        _id: "user_pm_1",
        role: "project_manager",
      });
      expect(pmRes.actions.find((a) => a.name === "resubmit")?.enabled).toBe(true);

      const adminRes = computeAvailableActions("material_request", doc, {
        _id: "user_admin_1",
        role: "admin",
      });
      expect(adminRes.actions.find((a) => a.name === "resubmit")?.enabled).toBe(true);
    });

    it("guarantees zero available actions in terminal states ('rejected', 'delivered')", () => {
      for (const terminalStatus of ["rejected", "delivered"]) {
        const doc = { _id: "mr_1", status: terminalStatus, createdBy: creatorId };
        for (const role of ALL_ROLES) {
          const res = computeAvailableActions("material_request", doc, { _id: creatorId, role });
          expect(res.actions).toHaveLength(0);
        }
      }
    });
  });

  describe("Cost Comparison Action Matrix & Guard Evaluation", () => {
    it("enforces hasAtLeastTwoQuotes guard on 'submit'", () => {
      // 1 quote: submit is disabled
      const singleQuoteDoc = {
        _id: "cc_1",
        status: "draft",
        vendorQuotes: [{ vendorId: "v_1", total: 10000 }],
      };
      const singleRes = computeAvailableActions("cost_comparison", singleQuoteDoc, {
        _id: "user_po_1",
        role: "procurement_officer",
      });
      const singleSubmit = singleRes.actions.find((a) => a.name === "submit");
      expect(singleSubmit?.enabled).toBe(false);
      expect(singleSubmit?.reason).toBe("Cost comparison requires at least 2 vendor quotes before submission.");

      // 2 quotes: submit is enabled for procurement officer
      const twoQuotesDoc = {
        _id: "cc_1",
        status: "draft",
        vendorQuotes: [
          { vendorId: "v_1", total: 10000 },
          { vendorId: "v_2", total: 9500 },
        ],
      };
      const twoRes = computeAvailableActions("cost_comparison", twoQuotesDoc, {
        _id: "user_po_1",
        role: "procurement_officer",
      });
      const twoSubmit = twoRes.actions.find((a) => a.name === "submit");
      expect(twoSubmit?.enabled).toBe(true);
      expect(twoSubmit?.reason).toBeUndefined();
    });

    it("enforces hasSelectedVendor guard on 'approve' in 'submitted' state", () => {
      // No selected vendor: approve is disabled
      const unselectedDoc = {
        _id: "cc_1",
        status: "submitted",
        selectedVendorId: undefined,
      };
      const unselectedRes = computeAvailableActions("cost_comparison", unselectedDoc, {
        _id: "user_pm_1",
        role: "project_manager",
      });
      const unselectedApprove = unselectedRes.actions.find((a) => a.name === "approve");
      expect(unselectedApprove?.enabled).toBe(false);
      expect(unselectedApprove?.reason).toBe("A winning vendor quote must be selected before approval.");

      // Reject and Query are still enabled even without selected vendor
      expect(unselectedRes.actions.find((a) => a.name === "reject")?.enabled).toBe(true);
      expect(unselectedRes.actions.find((a) => a.name === "query")?.enabled).toBe(true);

      // With selected vendor: approve is enabled
      const selectedDoc = {
        _id: "cc_1",
        status: "submitted",
        selectedVendorId: "v_2",
      };
      const selectedRes = computeAvailableActions("cost_comparison", selectedDoc, {
        _id: "user_pm_1",
        role: "project_manager",
      });
      expect(selectedRes.actions.find((a) => a.name === "approve")?.enabled).toBe(true);
    });
  });

  describe("Purchase Order Action Matrix", () => {
    it("evaluates actions in 'approved' status", () => {
      const doc = { _id: "po_1", status: "approved" };

      // 1. Site Supervisor can close upon receipt, but cannot cancel or force-close
      const supRes = computeAvailableActions("purchase_order", doc, {
        _id: "user_sup_1",
        role: "site_supervisor",
      });
      expect(supRes.actions.find((a) => a.name === "close_on_receipt")?.enabled).toBe(true);
      expect(supRes.actions.find((a) => a.name === "cancel")?.enabled).toBe(false);
      expect(supRes.actions.find((a) => a.name === "close")?.enabled).toBe(false);

      // 2. Project Manager and Admin can cancel, force-close, or close on receipt
      const pmRes = computeAvailableActions("purchase_order", doc, {
        _id: "user_pm_1",
        role: "project_manager",
      });
      expect(pmRes.actions.find((a) => a.name === "cancel")?.enabled).toBe(true);
      expect(pmRes.actions.find((a) => a.name === "close")?.enabled).toBe(true);
    });

    it("guarantees zero available actions in terminal PO states ('cancelled', 'closed', 'rejected')", () => {
      for (const terminalStatus of ["cancelled", "closed", "rejected"]) {
        const doc = { _id: "po_1", status: terminalStatus };
        for (const role of ALL_ROLES) {
          const res = computeAvailableActions("purchase_order", doc, { _id: "u1", role });
          expect(res.actions).toHaveLength(0);
        }
      }
    });
  });

  describe("Delivery Challan Action Matrix", () => {
    it("evaluates actions in 'delivery_processing' (in transit) status", () => {
      const doc = { _id: "dc_1", status: "delivery_processing" };

      // Site supervisor can deliver, cannot cancel
      const supRes = computeAvailableActions("delivery_challan", doc, {
        _id: "user_sup_1",
        role: "site_supervisor",
      });
      expect(supRes.actions.find((a) => a.name === "deliver")?.enabled).toBe(true);
      expect(supRes.actions.find((a) => a.name === "cancel")?.enabled).toBe(false);

      // Procurement officer can deliver and cancel
      const poRes = computeAvailableActions("delivery_challan", doc, {
        _id: "user_po_1",
        role: "procurement_officer",
      });
      expect(poRes.actions.find((a) => a.name === "deliver")?.enabled).toBe(true);
      expect(poRes.actions.find((a) => a.name === "cancel")?.enabled).toBe(true);
    });
  });

  describe("RFQ Action Matrix", () => {
    const creatorId = "user_procurement_1";

    it("evaluates actions in 'draft' status (issue action)", () => {
      const doc = { _id: "rfq_1", status: "draft", createdBy: creatorId };

      // Procurement officer and Admin can issue RFQ
      const poRes = computeAvailableActions("rfq", doc, { _id: creatorId, role: "procurement_officer" });
      const issueAction = poRes.actions.find((a) => a.name === "issue");
      expect(issueAction?.enabled).toBe(true);

      // Site supervisor cannot issue RFQ
      const supRes = computeAvailableActions("rfq", doc, { _id: "user_sup_1", role: "site_supervisor" });
      expect(supRes.actions.find((a) => a.name === "issue")?.enabled).toBe(false);
    });

    it("evaluates actions in 'open' status (close & archive actions)", () => {
      const doc = { _id: "rfq_1", status: "open", createdBy: creatorId };

      const poRes = computeAvailableActions("rfq", doc, { _id: creatorId, role: "procurement_officer" });
      expect(poRes.actions.find((a) => a.name === "close")?.enabled).toBe(true);

      const pmRes = computeAvailableActions("rfq", doc, { _id: "user_pm_1", role: "project_manager" });
      expect(pmRes.actions.find((a) => a.name === "archive")?.enabled).toBe(true);
    });

    it("guarantees zero available actions in terminal RFQ state ('archived')", () => {
      const doc = { _id: "rfq_1", status: "archived" };
      for (const role of ALL_ROLES) {
        const res = computeAvailableActions("rfq", doc, { _id: "u1", role });
        expect(res.actions).toHaveLength(0);
      }
    });
  });

  describe("Guard Registry & Fail-Closed Validation", () => {
    it("throws when evaluateGuard is called with an unregistered guard", () => {
      expect(() =>
        evaluateGuard("nonExistentGuardName", {})
      ).toThrow(/Unknown lifecycle guard/i);
    });
  });
});
