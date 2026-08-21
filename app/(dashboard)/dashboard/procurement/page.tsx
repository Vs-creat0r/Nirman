"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import {
  ShoppingBag,
  FileBarChart2,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Plus,
  Building2,
  FileText,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProcurementDashboard() {
  const { token } = useSession();
  const { user } = useRole();

  const metrics = useQuery(
    api.dashboard.getProcurementDashboardMetrics,
    token ? { token } : "skip"
  );


  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Procurement Officer Portal
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              Procurement Desk
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Welcome back, {user?.name || "Procurement Officer"}. Compare multi-vendor quotes, issue formal POs, and manage supplier profiles.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/dashboard/procurement/cost-comparisons/new">
            <Button size="sm" className="gap-1.5 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" />
              New Cost Comparison
            </Button>
          </Link>
          <Link href="/dashboard/procurement/vendors">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <Users className="h-3.5 w-3.5" />
              Vendor Master
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Action Required Alert Banners ── */}
      {metrics && metrics.ccsAwaitingPOCount > 0 && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {metrics.ccsAwaitingPOCount} Approved Cost Comparison{metrics.ccsAwaitingPOCount > 1 ? "s" : ""} Ready for PO Generation
              </h3>
              <p className="text-[11px] text-muted-foreground">
                The winning vendor quote has been authorized by the Project Manager. You can issue the purchase order immediately.
              </p>
            </div>
          </div>
          <Link href="/dashboard/procurement/purchase-orders">
            <Button size="sm" className="text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              Generate POs
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {metrics && (metrics.queriedCCCount > 0 || metrics.queriedPOCount > 0) && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400">
                Action Needed on Queried Documents
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {metrics.queriedCCCount > 0 && `${metrics.queriedCCCount} Cost Comparison(s) queried.`}{" "}
                {metrics.queriedPOCount > 0 && `${metrics.queriedPOCount} Purchase Order(s) queried by manager.`}
              </p>
            </div>
          </div>
          <Link href="/dashboard/procurement/cost-comparisons">
            <Button variant="outline" size="sm" className="text-xs font-semibold border-amber-500/40 text-amber-600 dark:text-amber-400">
              Review Queries
            </Button>
          </Link>
        </div>
      )}

      {/* ── Key Metrics Grid ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* 1. Approved POs */}
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Approved POs
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {metrics?.approvedPOCount ?? "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {metrics?.submittedPOCount ?? 0} submitted for review
            </p>
          </CardContent>
        </Card>

        {/* 2. Ready for CC Material Requests */}
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              MRs Ready for CC
            </CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {metrics?.mrsReadyForCCCount ?? "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Approved site requests to source quotes for
            </p>
          </CardContent>
        </Card>

        {/* 3. Cost Comparisons Active */}
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active CC Pipeline
            </CardTitle>
            <FileBarChart2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {(metrics?.draftCCCount ?? 0) + (metrics?.submittedCCCount ?? 0)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {metrics?.submittedCCCount ?? 0} with manager for signoff
            </p>
          </CardContent>
        </Card>

        {/* 4. Active Vendor Master */}
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Approved Vendors
            </CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {metrics?.activeVendorCount ?? "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Suppliers in active catalog
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Procurement Pipeline Navigator ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cost Comparisons Module Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <FileBarChart2 className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    Cost Comparisons (CC)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Multi-vendor side-by-side rate negotiations & tax audits
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] text-muted-foreground block">Draft</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {metrics?.draftCCCount ?? 0}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] text-muted-foreground block">Submitted</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {metrics?.submittedCCCount ?? 0}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] text-muted-foreground block">Queried</span>
                <span className="text-base font-bold font-mono text-amber-500">
                  {metrics?.queriedCCCount ?? 0}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <Link href="/dashboard/procurement/cost-comparisons" className="w-full">
                <Button variant="outline" size="sm" className="w-full text-xs font-semibold gap-1.5 justify-between">
                  <span>View All Cost Comparisons</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Orders Module Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    Purchase Orders (PO)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Binding legal orders with line item snapshots & T&C
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] text-muted-foreground block">Draft</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {metrics?.draftPOCount ?? 0}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] text-muted-foreground block">Under Review</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {metrics?.submittedPOCount ?? 0}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] text-muted-foreground block">Approved</span>
                <span className="text-base font-bold font-mono text-emerald-500">
                  {metrics?.approvedPOCount ?? 0}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <Link href="/dashboard/procurement/purchase-orders" className="w-full">
                <Button variant="outline" size="sm" className="w-full text-xs font-semibold gap-1.5 justify-between">
                  <span>View All Purchase Orders</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Activity Feed ── */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
              Recent Procurement Audit Log
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {metrics?.recentActivity && metrics.recentActivity.length > 0 ? (
              metrics.recentActivity.map((log: any) => (
                <div key={log._id} className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-muted/20 transition-colors">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <span className="font-mono text-primary">{log.referenceId || log.documentType}</span>
                      <span>&bull;</span>
                      <span>{log.action?.replace(/_/g, " ")}</span>
                    </div>
                    {log.note && (
                      <p className="text-[11px] text-muted-foreground italic">
                        &ldquo;{log.note}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground space-y-0.5">
                    <div className="font-medium text-foreground">{log.actorName}</div>
                    <div>
                      {new Date(log.timestamp).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No recent procurement activity recorded.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
