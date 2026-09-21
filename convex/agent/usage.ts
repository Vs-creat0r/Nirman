/**
 * @fileoverview Agent Safety Switches & Rate Limiting Engine.
 *
 * Implements S6-7:
 * Implements S6-7 & S7:
 * - Runtime kill switch evaluation (agentEnabled).
 * - Per-user daily request cap enforcement (default 40 requests/day).
 * - Monthly organization-wide hard ceiling enforcement (default 1000 requests/month).
 * - Graceful refusals with zero thrown UI exceptions.
 * - Zero procurement document writes.
 * - Admin usage & rate limit aggregation dashboard query.
 */

import { query, mutation, QueryCtx, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { resolveCallerScope } from "../scoping";

export interface AgentSafetyCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly agentEnabled: boolean;
  readonly dailyUsageCount: number;
  readonly dailyCap: number;
  readonly monthlyUsageCount: number;
  readonly monthlyCap: number;
}

export interface AgentUserUsageItem {
  readonly userId: Id<"users">;
  readonly name: string;
  readonly username: string;
  readonly role: string;
  readonly email: string;
  readonly todayCount: number;
  readonly monthCount: number;
  readonly lastRequestAt: string;
}

export interface AgentUsageDashboardResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly agentEnabled: boolean;
  readonly dailyCap: number;
  readonly monthlyCap: number;
  readonly todayUsageCount: number;
  readonly monthlyUsageCount: number;
  readonly activeUsersTodayCount: number;
  readonly activeUsersMonthCount: number;
  readonly userBreakdown: AgentUserUsageItem[];
}

export function getCurrentDateStrings(): { date: string; month: string } {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  return { date, month };
}

export async function checkAgentSafetyHelper(
  ctx: QueryCtx,
  args: { token?: string; userId?: string }
): Promise<AgentSafetyCheckResult> {
  const settings = await ctx.db.query("settings").first();
  const agentEnabled = settings?.agentEnabled ?? true;
  const dailyCap = settings?.agentDailyUserCap ?? 40;
  const monthlyCap = settings?.agentMonthlyOrgCap ?? 1000;

  if (!agentEnabled) {
    return {
      allowed: false,
      reason: "AI assistant is turned off.",
      agentEnabled: false,
      dailyUsageCount: 0,
      dailyCap,
      monthlyUsageCount: 0,
      monthlyCap,
    };
  }

  let targetUserId = args.userId;
  if (!targetUserId && args.token) {
    try {
      const scope = await resolveCallerScope(ctx, args.token);
      targetUserId = String(scope.user._id);
    } catch {
      // Continue without user-specific checks if token resolution fails
    }
  }

  const { date: todayStr, month: monthStr } = getCurrentDateStrings();

  // 1. Check user daily cap
  let dailyUsageCount = 0;
  if (targetUserId) {
    const userDailyRecord = await ctx.db
      .query("agent_usage")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", targetUserId as Id<"users">).eq("date", todayStr)
      )
      .first();

    dailyUsageCount = userDailyRecord?.requestCount ?? 0;
    if (dailyUsageCount >= dailyCap) {
      return {
        allowed: false,
        reason: `Daily AI request limit reached (${dailyCap} requests/day). Manual quote entry remains fully available.`,
        agentEnabled: true,
        dailyUsageCount,
        dailyCap,
        monthlyUsageCount: 0,
        monthlyCap,
      };
    }
  }

  // 2. Check organization monthly ceiling
  const monthlyRecords = await ctx.db
    .query("agent_usage")
    .withIndex("by_month", (q) => q.eq("month", monthStr))
    .collect();

  const monthlyUsageCount = monthlyRecords.reduce((sum, r) => sum + (r.requestCount || 0), 0);
  if (monthlyUsageCount >= monthlyCap) {
    return {
      allowed: false,
      reason: `Monthly organization AI request limit reached (${monthlyCap} requests/month). Manual quote entry remains fully available.`,
      agentEnabled: true,
      dailyUsageCount,
      dailyCap,
      monthlyUsageCount,
      monthlyCap,
    };
  }

  return {
    allowed: true,
    agentEnabled: true,
    dailyUsageCount,
    dailyCap,
    monthlyUsageCount,
    monthlyCap,
  };
}

export async function recordAgentUsageHelper(
  ctx: MutationCtx,
  args: { userId: Id<"users"> }
): Promise<{ success: boolean; requestCount: number }> {
  const { date: todayStr, month: monthStr } = getCurrentDateStrings();
  const now = new Date().toISOString();

  const existing = await ctx.db
    .query("agent_usage")
    .withIndex("by_userId_date", (q) =>
      q.eq("userId", args.userId).eq("date", todayStr)
    )
    .first();

  if (existing) {
    const newCount = existing.requestCount + 1;
    await ctx.db.patch(existing._id, {
      requestCount: newCount,
      lastRequestAt: now,
    });
    return { success: true, requestCount: newCount };
  } else {
    await ctx.db.insert("agent_usage", {
      userId: args.userId,
      date: todayStr,
      month: monthStr,
      requestCount: 1,
      lastRequestAt: now,
    });
    return { success: true, requestCount: 1 };
  }
}

export async function getAgentUsageDashboardHelper(
  ctx: QueryCtx,
  args: { token?: string }
): Promise<AgentUsageDashboardResult> {
  let scope;
  try {
    scope = await resolveCallerScope(ctx, args.token);
  } catch {
    return {
      ok: false,
      error: "Unauthorized: Invalid or missing authentication token",
      agentEnabled: false,
      dailyCap: 0,
      monthlyCap: 0,
      todayUsageCount: 0,
      monthlyUsageCount: 0,
      activeUsersTodayCount: 0,
      activeUsersMonthCount: 0,
      userBreakdown: [],
    };
  }

  if (!scope.isAdmin) {
    return {
      ok: false,
      error: "Unauthorized: Admin privileges required",
      agentEnabled: false,
      dailyCap: 0,
      monthlyCap: 0,
      todayUsageCount: 0,
      monthlyUsageCount: 0,
      activeUsersTodayCount: 0,
      activeUsersMonthCount: 0,
      userBreakdown: [],
    };
  }

  const settings = await ctx.db.query("settings").first();
  const agentEnabled = settings?.agentEnabled ?? true;
  const dailyCap = settings?.agentDailyUserCap ?? 40;
  const monthlyCap = settings?.agentMonthlyOrgCap ?? 1000;

  const { date: todayStr, month: monthStr } = getCurrentDateStrings();

  // Query records for current month
  const monthlyRecords = await ctx.db
    .query("agent_usage")
    .withIndex("by_month", (q) => q.eq("month", monthStr))
    .collect();

  // Query records for today
  const todayRecords = await ctx.db
    .query("agent_usage")
    .withIndex("by_date", (q) => q.eq("date", todayStr))
    .collect();

  const todayUsageCount = todayRecords.reduce((sum, r) => sum + (r.requestCount || 0), 0);
  const monthlyUsageCount = monthlyRecords.reduce((sum, r) => sum + (r.requestCount || 0), 0);

  const activeUsersTodayCount = new Set(
    todayRecords.filter((r) => (r.requestCount || 0) > 0).map((r) => String(r.userId))
  ).size;

  const activeUsersMonthCount = new Set(
    monthlyRecords.filter((r) => (r.requestCount || 0) > 0).map((r) => String(r.userId))
  ).size;

  // Aggregate by user
  const userMap = new Map<
    string,
    { todayCount: number; monthCount: number; lastRequestAt: string; userId: Id<"users"> }
  >();

  for (const r of monthlyRecords) {
    const uid = String(r.userId);
    const existing = userMap.get(uid) || {
      todayCount: 0,
      monthCount: 0,
      lastRequestAt: "",
      userId: r.userId,
    };
    existing.monthCount += r.requestCount || 0;
    if (r.lastRequestAt && r.lastRequestAt > existing.lastRequestAt) {
      existing.lastRequestAt = r.lastRequestAt;
    }
    userMap.set(uid, existing);
  }

  for (const r of todayRecords) {
    const uid = String(r.userId);
    const existing = userMap.get(uid) || {
      todayCount: 0,
      monthCount: 0,
      lastRequestAt: "",
      userId: r.userId,
    };
    existing.todayCount = r.requestCount || 0;
    if (r.lastRequestAt && r.lastRequestAt > existing.lastRequestAt) {
      existing.lastRequestAt = r.lastRequestAt;
    }
    userMap.set(uid, existing);
  }

  const userBreakdown: AgentUserUsageItem[] = await Promise.all(
    Array.from(userMap.values()).map(async (u) => {
      const userDoc = await ctx.db.get(u.userId);
      return {
        userId: u.userId,
        name: userDoc?.name || "Unknown User",
        username: userDoc?.username || "unknown",
        role: userDoc?.role || "unknown",
        email: userDoc?.email || "",
        todayCount: u.todayCount,
        monthCount: u.monthCount,
        lastRequestAt: u.lastRequestAt,
      };
    })
  );

  userBreakdown.sort((a, b) => b.monthCount - a.monthCount || b.todayCount - a.todayCount);

  return {
    ok: true,
    agentEnabled,
    dailyCap,
    monthlyCap,
    todayUsageCount,
    monthlyUsageCount,
    activeUsersTodayCount,
    activeUsersMonthCount,
    userBreakdown,
  };
}

// ── Public / Internal Convex Endpoints ─────────────────────────────────

export const checkAgentSafety = query({
  args: {
    token: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await checkAgentSafetyHelper(ctx, args);
  },
});

export const recordAgentUsage = mutation({
  args: {
    userId: v.id("users"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await recordAgentUsageHelper(ctx, { userId: args.userId });
  },
});

export const getAgentUsageDashboard = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await getAgentUsageDashboardHelper(ctx, args);
  },
});
