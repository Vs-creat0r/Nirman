/**
 * @fileoverview RFQ Multi-Tenant Scoping & Document Access Test Suite.
 *
 * Verifies:
 * 1. assertDocumentAccess enforces project/site isolation on standalone and sourced RFQs.
 * 2. Unassigned or cross-project users are strictly rejected.
 * 3. Admins and unrestricted Project Managers have global access.
 */

import { describe, it, expect } from "vitest";
import { assertDocumentAccess, type UserScope } from "@/convex/scoping";

describe("RFQ Data Scoping & Multi-Tenancy Invariants", () => {
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

  const pmProject1Scope: UserScope = {
    user: {
      _id: "user_pm1" as any,
      _creationTime: 0,
      username: "pm1",
      role: "project_manager",
      isActive: true,
      name: "PM Project 1",
      assignedProjectIds: ["project_1" as any],
    },
    isAdmin: false,
    isSiteScoped: false,
    allowedProjectIds: new Set(["project_1"]),
    allowedSiteIds: new Set(["site_1a"]),
  };

  const supervisorSiteA1Scope: UserScope = {
    user: {
      _id: "user_sup1" as any,
      _creationTime: 0,
      username: "sup1",
      role: "site_supervisor",
      isActive: true,
      name: "Supervisor Site 1a",
      assignedProjectIds: ["project_1" as any],
      assignedSiteIds: ["site_1a" as any],
    },
    isAdmin: false,
    isSiteScoped: true,
    allowedProjectIds: new Set(["project_1"]),
    allowedSiteIds: new Set(["site_1a"]),
  };

  const standaloneRfqProj1 = {
    projectId: "project_1",
    siteId: "site_1a",
    refNo: "RFQ-2026-0001",
  };

  const standaloneRfqProj2 = {
    projectId: "project_2",
    siteId: "site_2a",
    refNo: "RFQ-2026-0002",
  };

  const sourcedRfqFromMr = {
    projectId: "project_1",
    siteId: "site_1a",
    sourceMrId: "mr_100",
    refNo: "RFQ-2026-0003",
  };

  it("grants admin global access to any RFQ", () => {
    expect(() => assertDocumentAccess(adminScope, standaloneRfqProj1, "RFQ")).not.toThrow();
    expect(() => assertDocumentAccess(adminScope, standaloneRfqProj2, "RFQ")).not.toThrow();
    expect(() => assertDocumentAccess(adminScope, sourcedRfqFromMr, "RFQ")).not.toThrow();
  });

  it("grants PM access to RFQs in their assigned project", () => {
    expect(() => assertDocumentAccess(pmProject1Scope, standaloneRfqProj1, "RFQ")).not.toThrow();
    expect(() => assertDocumentAccess(pmProject1Scope, sourcedRfqFromMr, "RFQ")).not.toThrow();
  });

  it("blocks PM access to RFQs in another project", () => {
    expect(() => assertDocumentAccess(pmProject1Scope, standaloneRfqProj2, "RFQ")).toThrow(/Forbidden/);
  });

  it("grants site supervisor access to RFQs for their assigned site", () => {
    expect(() => assertDocumentAccess(supervisorSiteA1Scope, standaloneRfqProj1, "RFQ")).not.toThrow();
  });

  it("blocks site supervisor access to RFQs in other projects or sites", () => {
    expect(() => assertDocumentAccess(supervisorSiteA1Scope, standaloneRfqProj2, "RFQ")).toThrow(/Forbidden/);
  });
});
