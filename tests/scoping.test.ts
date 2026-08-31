import { describe, it, expect } from "vitest";
import {
  UserScope,
  canAccessDocument,
  assertDocumentAccess,
  filterScopedList,
} from "../convex/scoping";

describe("Data Scoping & Authorization Boundaries (S1-04)", () => {
  const adminScope: UserScope = {
    user: {
      _id: "user_admin" as any,
      _creationTime: 0,
      username: "admin",
      role: "admin",
      isActive: true,
      name: "Admin User",
    },
    isAdmin: true,
    isSiteScoped: false,
    allowedProjectIds: new Set<string>(),
    allowedSiteIds: new Set<string>(),
  };

  const supervisorSiteA1Scope: UserScope = {
    user: {
      _id: "user_sup_a1" as any,
      _creationTime: 0,
      username: "sup_a1",
      role: "site_supervisor",
      isActive: true,
      name: "Supervisor Site A1",
      assignedProjectIds: ["proj_A" as any],
      assignedSiteIds: ["site_A1" as any],
    },
    isAdmin: false,
    isSiteScoped: true,
    allowedProjectIds: new Set<string>(["proj_A"]),
    allowedSiteIds: new Set<string>(["site_A1"]),
  };

  const pmProjectAScope: UserScope = {
    user: {
      _id: "user_pm_a" as any,
      _creationTime: 0,
      username: "pm_a",
      role: "project_manager",
      isActive: true,
      name: "PM Project A",
      assignedProjectIds: ["proj_A" as any],
    },
    isAdmin: false,
    isSiteScoped: false,
    allowedProjectIds: new Set<string>(["proj_A"]),
    allowedSiteIds: new Set<string>(["site_A1", "site_A2"]),
  };

  const pmProjectA_ExtendedSiteB1Scope: UserScope = {
    user: {
      _id: "user_pm_extended" as any,
      _creationTime: 0,
      username: "pm_ext",
      role: "project_manager",
      isActive: true,
      name: "PM Project A + Ext B1",
      assignedProjectIds: ["proj_A" as any],
      assignedSiteIds: ["site_B1" as any],
    },
    isAdmin: false,
    isSiteScoped: false,
    allowedProjectIds: new Set<string>(["proj_A"]),
    allowedSiteIds: new Set<string>(["site_A1", "site_A2", "site_B1"]),
  };

  const unassignedUserScope: UserScope = {
    user: {
      _id: "user_unassigned" as any,
      _creationTime: 0,
      username: "unassigned_po",
      role: "procurement_officer",
      isActive: true,
      name: "Unassigned Procurement Officer",
    },
    isAdmin: false,
    isSiteScoped: false,
    allowedProjectIds: new Set<string>(),
    allowedSiteIds: new Set<string>(),
  };

  describe("Admin Scope Access", () => {
    it("allows admin global access across all projects and sites unconditionally", () => {
      expect(canAccessDocument(adminScope, { projectId: "proj_A" as any, siteId: "site_A1" as any })).toBe(true);
      expect(canAccessDocument(adminScope, { projectId: "proj_B" as any, siteId: "site_B2" as any })).toBe(true);
      expect(canAccessDocument(adminScope, { projectId: "proj_random" as any })).toBe(true);
    });
  });

  describe("Site Supervisor Isolation & Site-Level Precedence", () => {
    it("allows supervisor to access their assigned site A-1 under project A", () => {
      expect(
        canAccessDocument(supervisorSiteA1Scope, {
          projectId: "proj_A" as any,
          siteId: "site_A1" as any,
        })
      ).toBe(true);
    });

    it("strictly blocks supervisor from another site A-2 even under the same parent Project A", () => {
      // Invariant: sharing parent projectId NEVER bypasses site scoping
      expect(
        canAccessDocument(supervisorSiteA1Scope, {
          projectId: "proj_A" as any,
          siteId: "site_A2" as any,
        })
      ).toBe(false);
    });

    it("blocks supervisor from foreign project B site B-1", () => {
      expect(
        canAccessDocument(supervisorSiteA1Scope, {
          projectId: "proj_B" as any,
          siteId: "site_B1" as any,
        })
      ).toBe(false);
    });

    it("allows supervisor to access project-level document if parent project is in allowedProjectIds", () => {
      expect(
        canAccessDocument(supervisorSiteA1Scope, {
          projectId: "proj_A" as any,
        })
      ).toBe(true);
    });
  });

  describe("Project Manager Scoping & Extension Semantics", () => {
    it("allows PM on Project A to access all sites (A-1, A-2) under Project A", () => {
      expect(
        canAccessDocument(pmProjectAScope, {
          projectId: "proj_A" as any,
          siteId: "site_A1" as any,
        })
      ).toBe(true);
      expect(
        canAccessDocument(pmProjectAScope, {
          projectId: "proj_A" as any,
          siteId: "site_A2" as any,
        })
      ).toBe(true);
      expect(
        canAccessDocument(pmProjectAScope, {
          projectId: "proj_A" as any,
        })
      ).toBe(true);
    });

    it("blocks PM on Project A from accessing Project B documents", () => {
      expect(
        canAccessDocument(pmProjectAScope, {
          projectId: "proj_B" as any,
          siteId: "site_B1" as any,
        })
      ).toBe(false);
      expect(
        canAccessDocument(pmProjectAScope, {
          projectId: "proj_B" as any,
        })
      ).toBe(false);
    });

    it("verifies site assignments extend PM access to Site B-1 without narrowing Project A", () => {
      // Still has full access to Project A
      expect(
        canAccessDocument(pmProjectA_ExtendedSiteB1Scope, {
          projectId: "proj_A" as any,
          siteId: "site_A1" as any,
        })
      ).toBe(true);
      // Extended access to specific site B-1
      expect(
        canAccessDocument(pmProjectA_ExtendedSiteB1Scope, {
          projectId: "proj_B" as any,
          siteId: "site_B1" as any,
        })
      ).toBe(true);
      // Still blocked from other sites in Project B
      expect(
        canAccessDocument(pmProjectA_ExtendedSiteB1Scope, {
          projectId: "proj_B" as any,
          siteId: "site_B2" as any,
        })
      ).toBe(false);
    });
  });

  describe("Fail-Closed Invariant for Unassigned Users", () => {
    it("unassigned user has zero access to any project or site document", () => {
      expect(
        canAccessDocument(unassignedUserScope, {
          projectId: "proj_A" as any,
          siteId: "site_A1" as any,
        })
      ).toBe(false);
      expect(
        canAccessDocument(unassignedUserScope, {
          projectId: "proj_A" as any,
        })
      ).toBe(false);
      expect(
        canAccessDocument(unassignedUserScope, {
          projectId: "proj_B" as any,
          siteId: "site_B1" as any,
        })
      ).toBe(false);
    });

    it("filterScopedList returns empty array for unassigned user", () => {
      const docs = [
        { id: "1", projectId: "proj_A" as any, siteId: "site_A1" as any },
        { id: "2", projectId: "proj_A" as any, siteId: "site_A2" as any },
        { id: "3", projectId: "proj_B" as any, siteId: "site_B1" as any },
      ];

      const scoped = filterScopedList(unassignedUserScope, docs);
      expect(scoped).toEqual([]);
    });
  });

  describe("assertDocumentAccess IDOR Protection", () => {
    it("throws Forbidden error when user tries to access document outside their scope", () => {
      expect(() =>
        assertDocumentAccess(
          supervisorSiteA1Scope,
          { projectId: "proj_A" as any, siteId: "site_A2" as any },
          "MR-2026-0099"
        )
      ).toThrowError(/Forbidden: You do not have access to document "MR-2026-0099"/);
    });

    it("does not throw when caller has valid scope", () => {
      expect(() =>
        assertDocumentAccess(
          supervisorSiteA1Scope,
          { projectId: "proj_A" as any, siteId: "site_A1" as any },
          "MR-2026-0001"
        )
      ).not.toThrow();
    });
  });

  describe("File Authorization & Parent Document IDOR Protection", () => {
    const parentGRNSiteA1 = {
      _id: "grn_01" as any,
      refNo: "GRN-2026-0001",
      siteId: "site_A1" as any,
      purchaseOrderId: "po_01" as any,
      photos: ["storage_photo_site_a1" as any],
    };

    const parentGRNSiteA2 = {
      _id: "grn_02" as any,
      refNo: "GRN-2026-0002",
      siteId: "site_A2" as any,
      purchaseOrderId: "po_02" as any,
      photos: ["storage_photo_site_a2" as any],
    };

    it("allows site supervisor to access files attached to their own site's GRN", () => {
      expect(canAccessDocument(supervisorSiteA1Scope, parentGRNSiteA1)).toBe(true);
    });

    it("strictly forbids site supervisor from accessing photos attached to a foreign site's GRN", () => {
      expect(canAccessDocument(supervisorSiteA1Scope, parentGRNSiteA2)).toBe(false);
      expect(() =>
        assertDocumentAccess(supervisorSiteA1Scope, parentGRNSiteA2, parentGRNSiteA2.refNo)
      ).toThrowError(/Forbidden: You do not have access to document "GRN-2026-0002"/);
    });
  });
});
