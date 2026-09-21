/**
 * @fileoverview Vitest Suite for S7: Admin AI Usage & Observability Dashboard.
 *
 * Implements S7 Verification:
 * 1. Admin authorization enforcement (rejects non-admin roles and unauthenticated callers).
 * 2. Usage aggregation accuracy (today vs monthly request totals, active user deduplication, per-user breakdown calculations).
 * 3. Confirmed agent activity feed (filters only source === "agent-assisted", sorts newest first, enriches with actor and context).
 */

import { describe, it, expect } from "vitest";
import {
  getAgentUsageDashboardHelper,
  getCurrentDateStrings,
} from "../convex/agent/usage";
import { listAgentAssistedActivityHelper } from "../convex/agent/activity";
import { Id } from "../convex/_generated/dataModel";
import { UserRole } from "../convex/permissions";
import { QueryCtx } from "../convex/_generated/server";

describe("S7 Admin AI Usage & Observability Dashboard", () => {
  const adminUser = {
    _id: "user_admin" as Id<"users">,
    role: "admin" as UserRole,
    isActive: true,
    name: "Aaditya Admin",
    username: "admin",
    email: "admin@nirman.infra",
    assignedProjectIds: [],
    assignedSiteIds: [],
  };

  const poUser1 = {
    _id: "user_po1" as Id<"users">,
    role: "procurement_officer" as UserRole,
    isActive: true,
    name: "Priya PO",
    username: "po1",
    email: "priya@nirman.infra",
    assignedProjectIds: ["proj_A" as Id<"projects">],
    assignedSiteIds: [],
  };

  const poUser2 = {
    _id: "user_po2" as Id<"users">,
    role: "procurement_officer" as UserRole,
    isActive: true,
    name: "Rahul PO",
    username: "po2",
    email: "rahul@nirman.infra",
    assignedProjectIds: ["proj_B" as Id<"projects">],
    assignedSiteIds: [],
  };

  const pmUser = {
    _id: "user_pm" as Id<"users">,
    role: "project_manager" as UserRole,
    isActive: true,
    name: "Vikram PM",
    username: "pm",
    email: "vikram@nirman.infra",
    assignedProjectIds: ["proj_A" as Id<"projects">],
    assignedSiteIds: [],
  };

  const supervisorUser = {
    _id: "user_sup" as Id<"users">,
    role: "site_supervisor" as UserRole,
    isActive: true,
    name: "Suresh Site",
    username: "sup",
    email: "suresh@nirman.infra",
    assignedProjectIds: ["proj_A" as Id<"projects">],
    assignedSiteIds: ["site_A1" as Id<"sites">],
  };

  const defaultSettings = {
    _id: "settings_1" as Id<"settings">,
    agentEnabled: true,
    agentDailyUserCap: 40,
    agentMonthlyOrgCap: 1000,
  };

  function createMockDashboardCtx(options?: {
    settings?: Record<string, unknown>;
    usageRecords?: Array<{
      _id: string;
      userId: Id<"users">;
      date: string;
      month: string;
      requestCount: number;
      lastRequestAt: string;
    }>;
    logsRecords?: Array<{
      _id: string;
      _creationTime: number;
      actorId: Id<"users">;
      actorRole: string;
      action: string;
      documentType: string;
      documentId: string;
      referenceId: string;
      fromStatus?: string;
      toStatus?: string;
      note?: string;
      source?: "manual" | "agent-assisted";
      agentContext?: {
        proposalId?: string;
        provider?: string;
        model?: string;
        promptVersion?: string;
      };
      timestamp: string;
    }>;
  }) {
    const settings = options?.settings ?? defaultSettings;
    const usageRecords = options?.usageRecords ?? [];
    const logsRecords = options?.logsRecords ?? [];

    const userDb: Record<string, unknown> = {
      user_admin: adminUser,
      user_po1: poUser1,
      user_po2: poUser2,
      user_pm: pmUser,
      user_sup: supervisorUser,
    };

    const ctx = {
      db: {
        get: async (id: string) => {
          if (userDb[id]) return userDb[id];
          if (id === "settings_1") return settings;
          if (id === "site_A1") return { _id: "site_A1", projectId: "proj_A", name: "Site A-1" };
          return null;
        },
        query: (table: string) => {
          if (table === "sessions") {
            return {
              withIndex: (_name: string, cb: (q: { eq: (f: string, v: string) => void }) => void) => {
                let queriedToken: string | undefined;
                cb({ eq: (_field: string, val: string) => { queriedToken = val; } });
                const resolver = async () => {
                  if (queriedToken === "token_admin") {
                    return { _id: "s_admin", userId: adminUser._id, token: "token_admin", expiresAt: Date.now() + 86400000 };
                  }
                  if (queriedToken === "token_po1") {
                    return { _id: "s_po1", userId: poUser1._id, token: "token_po1", expiresAt: Date.now() + 86400000 };
                  }
                  if (queriedToken === "token_pm") {
                    return { _id: "s_pm", userId: pmUser._id, token: "token_pm", expiresAt: Date.now() + 86400000 };
                  }
                  if (queriedToken === "token_sup") {
                    return { _id: "s_sup", userId: supervisorUser._id, token: "token_sup", expiresAt: Date.now() + 86400000 };
                  }
                  return null;
                };
                return { unique: resolver, first: resolver };
              },
            };
          }

          if (table === "sites") {
            return {
              withIndex: (_name: string, _cb: (q: { eq: (f: string, v: string) => void }) => void) => ({
                collect: async () => [{ _id: "site_A1", projectId: "proj_A", name: "Site A-1" }],
              }),
              collect: async () => [{ _id: "site_A1", projectId: "proj_A", name: "Site A-1" }],
            };
          }

          if (table === "settings") {
            return {
              first: async () => settings,
              collect: async () => [settings],
            };
          }

          if (table === "agent_usage") {
            return {
              withIndex: (_name: string, cb: (q: { eq: (f: string, v: string) => unknown }) => void) => {
                let filterDate: string | undefined;
                let filterMonth: string | undefined;
                let filterUserId: string | undefined;

                const qHelper = {
                  eq: (f: string, v: string) => {
                    if (f === "date") filterDate = v;
                    if (f === "month") filterMonth = v;
                    if (f === "userId") filterUserId = v;
                    return qHelper;
                  },
                };
                cb(qHelper);

                return {
                  collect: async () => {
                    return usageRecords.filter((r) => {
                      if (filterDate && r.date !== filterDate) return false;
                      if (filterMonth && r.month !== filterMonth) return false;
                      if (filterUserId && r.userId !== filterUserId) return false;
                      return true;
                    });
                  },
                  first: async () => {
                    const matches = usageRecords.filter((r) => {
                      if (filterDate && r.date !== filterDate) return false;
                      if (filterMonth && r.month !== filterMonth) return false;
                      if (filterUserId && r.userId !== filterUserId) return false;
                      return true;
                    });
                    return matches[0] || null;
                  },
                };
              },
              collect: async () => usageRecords,
            };
          }

          if (table === "logs") {
            return {
              collect: async () => logsRecords,
            };
          }

          return {
            withIndex: () => ({
              collect: async () => [],
              first: async () => null,
            }),
            collect: async () => [],
            first: async () => null,
            unique: async () => null,
          };
        },
      },
    };

    return ctx as unknown as QueryCtx;
  }

  // ── 1. Authorization Guards ────────────────────────────────────────────

  describe("Authorization & Security Guards", () => {
    it("refuses getAgentUsageDashboard for unauthenticated callers", async () => {
      const ctx = createMockDashboardCtx();
      const result = await getAgentUsageDashboardHelper(ctx, { token: undefined });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Unauthorized");
      expect(result.userBreakdown).toEqual([]);
    });

    it("refuses getAgentUsageDashboard for non-admin callers (PO, PM, Supervisor)", async () => {
      const ctx = createMockDashboardCtx();

      const poResult = await getAgentUsageDashboardHelper(ctx, { token: "token_po1" });
      expect(poResult.ok).toBe(false);
      expect(poResult.error).toContain("Admin");

      const pmResult = await getAgentUsageDashboardHelper(ctx, { token: "token_pm" });
      expect(pmResult.ok).toBe(false);
      expect(pmResult.error).toContain("Admin");

      const supResult = await getAgentUsageDashboardHelper(ctx, { token: "token_sup" });
      expect(supResult.ok).toBe(false);
      expect(supResult.error).toContain("Admin");
    });

    it("refuses listAgentAssistedActivity for non-admin callers returning empty list", async () => {
      const { date: todayStr } = getCurrentDateStrings();
      const ctx = createMockDashboardCtx({
        logsRecords: [
          {
            _id: "log_1",
            _creationTime: Date.now(),
            actorId: poUser1._id,
            actorRole: "procurement_officer",
            action: "cc_created",
            documentType: "cost_comparison",
            documentId: "cc_1",
            referenceId: "CC-2026-0001",
            source: "agent-assisted",
            timestamp: `${todayStr}T10:00:00.000Z`,
          },
        ],
      });

      const poLogs = await listAgentAssistedActivityHelper(ctx, { token: "token_po1" });
      expect(poLogs).toEqual([]);

      const noTokenLogs = await listAgentAssistedActivityHelper(ctx, { token: undefined });
      expect(noTokenLogs).toEqual([]);
    });
  });

  // ── 2. Usage Aggregation Math ──────────────────────────────────────────

  describe("Usage Aggregation & Per-User Metrics", () => {
    it("correctly aggregates today and monthly requests with distinct active users", async () => {
      const { date: todayStr, month: monthStr } = getCurrentDateStrings();
      const yesterdayStr = `${monthStr}-01`;

      const usageRecords = [
        // User 1 today
        {
          _id: "u1",
          userId: poUser1._id,
          date: todayStr,
          month: monthStr,
          requestCount: 5,
          lastRequestAt: `${todayStr}T12:00:00.000Z`,
        },
        // User 1 earlier this month
        {
          _id: "u2",
          userId: poUser1._id,
          date: yesterdayStr,
          month: monthStr,
          requestCount: 15,
          lastRequestAt: `${yesterdayStr}T11:00:00.000Z`,
        },
        // User 2 today
        {
          _id: "u3",
          userId: poUser2._id,
          date: todayStr,
          month: monthStr,
          requestCount: 8,
          lastRequestAt: `${todayStr}T14:30:00.000Z`,
        },
      ];

      const ctx = createMockDashboardCtx({
        settings: {
          _id: "settings_1" as Id<"settings">,
          agentEnabled: true,
          agentDailyUserCap: 50,
          agentMonthlyOrgCap: 2000,
        },
        usageRecords,
      });

      const result = await getAgentUsageDashboardHelper(ctx, { token: "token_admin" });

      expect(result.ok).toBe(true);
      expect(result.agentEnabled).toBe(true);
      expect(result.dailyCap).toBe(50);
      expect(result.monthlyCap).toBe(2000);

      // Today usage: 5 (PO1) + 8 (PO2) = 13
      expect(result.todayUsageCount).toBe(13);

      // Monthly usage: 5 + 15 (PO1) + 8 (PO2) = 28
      expect(result.monthlyUsageCount).toBe(28);

      // Distinct active users
      expect(result.activeUsersTodayCount).toBe(2);
      expect(result.activeUsersMonthCount).toBe(2);

      // Breakdown verification
      expect(result.userBreakdown).toHaveLength(2);

      // Sorted by monthCount descending -> PO1 (20) first, then PO2 (8)
      const [first, second] = result.userBreakdown;
      expect(first.userId).toBe(poUser1._id);
      expect(first.name).toBe("Priya PO");
      expect(first.role).toBe("procurement_officer");
      expect(first.email).toBe("priya@nirman.infra");
      expect(first.todayCount).toBe(5);
      expect(first.monthCount).toBe(20);
      expect(first.lastRequestAt).toBe(`${todayStr}T12:00:00.000Z`);

      expect(second.userId).toBe(poUser2._id);
      expect(second.name).toBe("Rahul PO");
      expect(second.todayCount).toBe(8);
      expect(second.monthCount).toBe(8);
    });

    it("returns zero counts and empty breakdown when no usage records exist", async () => {
      const ctx = createMockDashboardCtx({ usageRecords: [] });
      const result = await getAgentUsageDashboardHelper(ctx, { token: "token_admin" });

      expect(result.ok).toBe(true);
      expect(result.todayUsageCount).toBe(0);
      expect(result.monthlyUsageCount).toBe(0);
      expect(result.activeUsersTodayCount).toBe(0);
      expect(result.activeUsersMonthCount).toBe(0);
      expect(result.userBreakdown).toEqual([]);
    });
  });

  // ── 3. Confirmed Activity Feed Filtering ────────────────────────────────

  describe("Agent Activity Feed Filtering & Enrichment", () => {
    it("returns only source === 'agent-assisted' logs sorted newest first with enriched user details", async () => {
      const now = Date.now();
      const logsRecords = [
        {
          _id: "log_manual",
          _creationTime: now - 3000,
          actorId: poUser1._id,
          actorRole: "procurement_officer",
          action: "cc_created",
          documentType: "cost_comparison",
          documentId: "cc_manual_1",
          referenceId: "CC-2026-0001",
          note: "Manual entry",
          source: "manual" as const,
          timestamp: "2026-09-21T09:00:00.000Z",
        },
        {
          _id: "log_agent_older",
          _creationTime: now - 2000,
          actorId: poUser1._id,
          actorRole: "procurement_officer",
          action: "cc_created",
          documentType: "cost_comparison",
          documentId: "cc_agent_1",
          referenceId: "CC-2026-0002",
          note: "AI-proposed, confirmed by Priya PO",
          source: "agent-assisted" as const,
          agentContext: {
            proposalId: "prop_123",
            provider: "gemini",
            model: "gemini-2.5-flash",
            promptVersion: "cc-proposal-v1",
          },
          timestamp: "2026-09-21T10:00:00.000Z",
        },
        {
          _id: "log_agent_newer",
          _creationTime: now - 1000,
          actorId: poUser2._id,
          actorRole: "procurement_officer",
          action: "cc_created",
          documentType: "cost_comparison",
          documentId: "cc_agent_2",
          referenceId: "CC-2026-0003",
          note: "AI-proposed, confirmed by Rahul PO",
          source: "agent-assisted" as const,
          agentContext: {
            proposalId: "prop_456",
            provider: "gemini",
            model: "gemini-2.5-flash",
            promptVersion: "cc-proposal-v1",
          },
          timestamp: "2026-09-21T11:00:00.000Z",
        },
      ];

      const ctx = createMockDashboardCtx({ logsRecords });
      const activity = await listAgentAssistedActivityHelper(ctx, {
        token: "token_admin",
        limit: 10,
      });

      // Manual log must be excluded
      expect(activity).toHaveLength(2);

      // Newest first: log_agent_newer (11:00:00) then log_agent_older (10:00:00)
      const [first, second] = activity;
      expect(first._id).toBe("log_agent_newer");
      expect(first.referenceId).toBe("CC-2026-0003");
      expect(first.actorName).toBe("Rahul PO");
      expect(first.actorRole).toBe("procurement_officer");
      expect(first.agentContext?.model).toBe("gemini-2.5-flash");
      expect(first.agentContext?.proposalId).toBe("prop_456");

      expect(second._id).toBe("log_agent_older");
      expect(second.referenceId).toBe("CC-2026-0002");
      expect(second.actorName).toBe("Priya PO");
    });
  });
});

