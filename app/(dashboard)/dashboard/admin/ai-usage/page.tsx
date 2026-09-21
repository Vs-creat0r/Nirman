"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import { StatusBadge } from "@/components/document/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { AgentActivityItem } from "@/convex/agent/activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Users,
  Calendar,
  ExternalLink,
  Settings,
  Zap,
  ArrowRight,
  Clock,
  FileText,
  FileBarChart2,
  ShoppingBag,
  Truck,
  ClipboardCheck,
} from "lucide-react";

export default function AdminAiUsageDashboardPage() {
  const { role, isLoading: isRoleLoading } = useRole();
  const { token } = useSession();

  const dashboard = useQuery(
    api.agent.usage.getAgentUsageDashboard,
    token ? { token } : "skip"
  );

  const activityLogs = useQuery(
    api.agent.activity.listAgentAssistedActivity,
    token ? { token, limit: 100 } : "skip"
  );

  const getDocumentHref = (docType: string, refId: string) => {
    if (refId.startsWith("MR-") || docType === "material_request") {
      return role === "site_supervisor"
        ? "/dashboard/supervisor/material-requests"
        : "/dashboard/manager/material-requests";
    }
    if (refId.startsWith("CC-") || docType === "cost_comparison") {
      return role === "project_manager"
        ? "/dashboard/manager/cost-comparisons"
        : "/dashboard/procurement/cost-comparisons";
    }
    if (refId.startsWith("PO-") || docType === "purchase_order") {
      return role === "project_manager"
        ? "/dashboard/manager/purchase-orders"
        : "/dashboard/procurement/purchase-orders";
    }
    if (refId.startsWith("DC-") || docType === "delivery_challan") {
      return "/dashboard/deliveries";
    }
    if (refId.startsWith("GRN-") || docType === "grn") {
      return "/dashboard/grn";
    }
    if (docType === "vendors") {
      return "/dashboard/procurement/vendors";
    }
    return null;
  };

  const getDocIcon = (docType: string) => {
    switch (docType) {
      case "material_request":
        return <FileText className="h-3.5 w-3.5 text-[--info]" />;
      case "cost_comparison":
        return <FileBarChart2 className="h-3.5 w-3.5 text-primary" />;
      case "purchase_order":
        return <ShoppingBag className="h-3.5 w-3.5 text-[--warning]" />;
      case "delivery_challan":
        return <Truck className="h-3.5 w-3.5 text-[--info]" />;
      case "grn":
        return <ClipboardCheck className="h-3.5 w-3.5 text-[--success]" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  if (!isRoleLoading && role !== "admin") {
    return (
      <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card space-y-3">
        <ShieldAlert className="h-10 w-10 text-[--destructive] mx-auto" />
        <h2 className="text-base font-bold text-foreground">Access Restricted</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          The AI Usage & Observability Dashboard is restricted to System Administrators.
        </p>
      </div>
    );
  }

  const isLoading = dashboard === undefined;
  const agentEnabled = dashboard?.agentEnabled ?? true;
  const dailyCap = dashboard?.dailyCap ?? 40;
  const monthlyCap = dashboard?.monthlyCap ?? 1000;
  const todayUsage = dashboard?.todayUsageCount ?? 0;
  const monthlyUsage = dashboard?.monthlyUsageCount ?? 0;
  const activeUsersMonth = dashboard?.activeUsersMonthCount ?? 0;
  const activeUsersToday = dashboard?.activeUsersTodayCount ?? 0;
  const userBreakdown = dashboard?.userBreakdown ?? [];

  const monthlyPercentage = Math.min(
    100,
    Math.round((monthlyUsage / (monthlyCap || 1)) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              AI Usage & Observability
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary flex items-center gap-1.5 border border-primary/20">
              <Sparkles className="h-3 w-3" />
              Admin Telemetry
            </span>
          </div>
          <p className="text-xs text-muted-foreground select-none mt-1">
            Real-time monitor for AI proposal volumes, safety switches, per-user quotas, and confirmed workflow executions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/admin/settings">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" />
              Configure Caps & Switches
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Kill-Switch Status */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              AI Copilot Status
            </CardTitle>
            <Bot className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-7 w-24 bg-muted animate-pulse rounded" />
            ) : agentEnabled ? (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[--success] animate-pulse" />
                <span className="text-base font-bold text-foreground">Operational</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[--destructive]" />
                <span className="text-base font-bold text-[--destructive]">Disabled</span>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {agentEnabled ? "Runtime kill-switch active" : "Kill-switch engaged (AI turned off)"}
            </p>
          </CardContent>
        </Card>

        {/* Tile 2: Requests Today */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Today&apos;s Proposals
            </CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-7 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {todayUsage}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Cap: <span className="font-semibold">{dailyCap}</span> req/user/day
            </p>
          </CardContent>
        </Card>

        {/* Tile 3: Monthly Org Usage */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Monthly Org Usage
            </CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1.5">
            {isLoading ? (
              <div className="h-7 w-28 bg-muted animate-pulse rounded" />
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                  {monthlyUsage}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  / {monthlyCap} ({monthlyPercentage}%)
                </span>
              </div>
            )}
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  monthlyPercentage >= 100
                    ? "bg-[--destructive]"
                    : monthlyPercentage >= 80
                    ? "bg-[--warning]"
                    : "bg-primary"
                }`}
                style={{ width: `${monthlyPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tile 4: Active Users */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Active AI Users
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-7 w-12 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {activeUsersMonth}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              <span className="font-semibold">{activeUsersToday}</span> active today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-User Usage Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">Per-User Usage Breakdown</h2>
            <p className="text-xs text-muted-foreground">
              Quota tracking and consumption breakdown by individual team members for the current calendar month.
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {userBreakdown.length} {userBreakdown.length === 1 ? "user" : "users"} tracked
          </span>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <div className="h-6 w-1/3 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted/60 animate-pulse rounded" />
              <div className="h-10 w-full bg-muted/30 animate-pulse rounded" />
            </div>
          ) : userBreakdown.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Users className="h-6 w-6 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">
                No AI proposal activity recorded this month.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 border-b border-border text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Team Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Today Requests</th>
                    <th className="px-4 py-3 text-right">Month Requests</th>
                    <th className="px-4 py-3">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {userBreakdown.map((u) => (
                    <tr key={String(u.userId)} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center shrink-0 border border-primary/20">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block">
                              {u.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {u.email || `@${u.username}`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground border border-border capitalize">
                          {u.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        <span className={u.todayCount >= dailyCap ? "text-[--destructive]" : "text-foreground"}>
                          {u.todayCount}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-normal"> / {dailyCap}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        {u.monthCount}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                        {u.lastRequestAt ? (
                          <>
                            <span>{new Date(u.lastRequestAt).toLocaleDateString()}</span>{" "}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(u.lastRequestAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmed Agent Activity Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">Confirmed AI-Assisted Actions</h2>
            <p className="text-xs text-muted-foreground">
              Immutable audit stream of procurement documents created or transitioned via AI proposals and confirmed by authorized users.
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {activityLogs?.length ?? 0} confirmed actions
          </span>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
          {activityLogs === undefined ? (
            <div className="p-6 space-y-3">
              <div className="h-6 w-1/3 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted/60 animate-pulse rounded" />
              <div className="h-10 w-full bg-muted/30 animate-pulse rounded" />
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Bot className="h-6 w-6 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">
                No confirmed AI-assisted actions recorded yet. When users confirm AI-drafted Cost Comparisons or Purchase Orders, they will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 border-b border-border text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Confirmed By</th>
                    <th className="px-4 py-3">Document Reference</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">AI Model / Context</th>
                    <th className="px-4 py-3">Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activityLogs.map((log) => {
                  {activityLogs.map((log: AgentActivityItem) => {
                    const href = getDocumentHref(log.documentType, log.referenceId);
                    return (
                      <tr key={log._id} className="hover:bg-muted/30 transition-colors">
                        {/* Timestamp */}
                        <td className="px-4 py-3 text-muted-foreground font-mono">
                          <span className="text-foreground font-medium">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </td>

                        {/* Actor */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                              {log.actorName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground block">
                                {log.actorName}
                              </span>
                              <span className="text-[10px] text-muted-foreground capitalize">
                                {log.actorRole.replace("_", " ")}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Document Reference */}
                        <td className="px-4 py-3 font-mono">
                          <div className="flex items-center gap-1.5">
                            {getDocIcon(log.documentType)}
                            {href ? (
                              <Link
                                href={href}
                                className="font-semibold text-primary hover:underline flex items-center gap-1 group"
                              >
                                <span>{log.referenceId}</span>
                                <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                            ) : (
                              <span className="font-semibold text-foreground">
                                {log.referenceId}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground capitalize block pl-5">
                            {log.documentType.replace("_", " ")}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-muted text-foreground border border-border">
                            {log.action}
                          </span>
                        </td>

                        {/* AI Model & Context */}
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                              <Sparkles className="h-2.5 w-2.5" />
                              {log.agentContext?.model || "gemini-2.5-flash"}
                            </span>
                            {log.agentContext?.proposalId ? (
                              <span className="block text-[9px] text-muted-foreground font-mono truncate max-w-[120px]">
                                {log.agentContext.proposalId}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Audit Note */}
                        <td className="px-4 py-3 max-w-xs">
                          {log.note ? (
                            <span className="text-muted-foreground text-[11px] line-clamp-2 italic">
                              &ldquo;{log.note}&rdquo;
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

