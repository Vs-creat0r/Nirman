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
  Plus,
  FileText,
  Activity,
  IndianRupee,
  TrendingDown,
  Clock,
  Layers,
  ArrowUpRight,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GeneratePOModal } from "@/components/document/generate-po-modal";

export default function ProcurementDashboard() {
  const { token } = useSession();
  const { user } = useRole();

  const metrics = useQuery(
    api.dashboard.getProcurementDashboardMetrics,
    token ? { token } : "skip"
  );

  // Generate PO Modal State for Actionable Inbox
  const [selectedCCForPO, setSelectedCCForPO] = React.useState<any | null>(null);

  // Active Tab for Actionable Queues
  const [activeQueueTab, setActiveQueueTab] = React.useState<
    "ready_mr" | "ready_po" | "queried" | "audit"
  >("ready_mr");

  const totalActionsNeeded =
    (metrics?.mrsReadyForCCCount || 0) +
    (metrics?.ccsAwaitingPOCount || 0) +
    (metrics?.queriedCCCount || 0) +
    (metrics?.queriedPOCount || 0);

  return (
    <div className="space-y-6">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Procurement Command Center
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              Procurement Desk
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Welcome back, <span className="font-semibold text-foreground">{user?.name || "Procurement Officer"}</span>. Monitor supply tenders, negotiate quotes, issue authorized POs, and manage supplier intelligence.
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

      {/* ── 2. Top Executive KPI Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* 1. Approved PO Value */}
        <Card className="border-border bg-gradient-to-br from-surface to-muted/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Authorized PO Value
            </CardTitle>
            <div className="p-1.5 rounded-md bg-[--success]/10 text-[--success]">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              ₹{(metrics?.totalApprovedPOValue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="font-semibold text-[--success] font-mono">{metrics?.approvedPOCount || 0}</span> active orders issued
            </p>
          </CardContent>
        </Card>

        {/* 2. Pending Approval PO Value */}
        <Card className="border-border bg-gradient-to-br from-surface to-muted/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Orders Under Review
            </CardTitle>
            <div className="p-1.5 rounded-md bg-[--info]/10 text-[--info]">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              ₹{(metrics?.totalPendingPOValue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="font-semibold text-[--info] font-mono">{metrics?.submittedPOCount || 0}</span> with Manager for signoff
            </p>
          </CardContent>
        </Card>

        {/* 3. Bidding Cost Savings */}
        <Card className="border-border bg-gradient-to-br from-surface to-muted/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Bidding Savings
            </CardTitle>
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
              ₹{(metrics?.estimatedSavings || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Saved via multi-vendor quotes
            </p>
          </CardContent>
        </Card>

        {/* 4. Active Supplier Base */}
        <Card className="border-border bg-gradient-to-br from-surface to-muted/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Approved Vendors
            </CardTitle>
            <div className="p-1.5 rounded-md bg-[--warning]/10 text-[--warning]">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {metrics?.activeVendorCount ?? "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Qualified suppliers in catalog
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Visual Lifecycle Tracker (Interactive Funnel Pipeline) ── */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="pb-3 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                Procurement Pipeline & Action Tracker
              </CardTitle>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Real-time document lifecycle velocity
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Stage 1: Ingestion */}
            <div className="p-3 rounded-lg border border-border bg-surface flex flex-col justify-between space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">1. MR Ingestion</span>
                <span className="p-1 rounded bg-[--info]/10 text-[--info]">
                  <FileText className="h-3.5 w-3.5" />
                </span>
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {metrics?.mrsReadyForCCCount || 0}
                </div>
                <div className="text-[10px] text-muted-foreground">Site requests ready for tender</div>
              </div>
              <Link href="/dashboard/procurement/cost-comparisons/new" className="text-[10px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 pt-1">
                Source Quotes <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>

            {/* Stage 2: Cost Comparison */}
            <div className="p-3 rounded-lg border border-border bg-surface flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">2. Quote Analysis</span>
                <span className="p-1 rounded bg-purple-500/10 text-purple-500">
                  <FileBarChart2 className="h-3.5 w-3.5" />
                </span>
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {(metrics?.draftCCCount || 0) + (metrics?.submittedCCCount || 0)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {metrics?.draftCCCount || 0} draft &bull; {metrics?.submittedCCCount || 0} in review
                </div>
              </div>
              <Link href="/dashboard/procurement/cost-comparisons" className="text-[10px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 pt-1">
                View CCs <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>

            {/* Stage 3: Clarifications */}
            <div className={`p-3 rounded-lg border flex flex-col justify-between space-y-2 ${
              (metrics?.queriedCCCount || 0) + (metrics?.queriedPOCount || 0) > 0
                ? "border-[--warning]/40 bg-[--warning]/5"
                : "border-border bg-surface"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[--warning]">3. Queried Items</span>
                <span className="p-1 rounded bg-[--warning]/10 text-[--warning]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-[--warning]">
                  {(metrics?.queriedCCCount || 0) + (metrics?.queriedPOCount || 0)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {metrics?.queriedCCCount || 0} CC &bull; {metrics?.queriedPOCount || 0} PO queries
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveQueueTab("queried")}
                className="text-[10px] font-semibold text-[--warning] hover:underline inline-flex items-center gap-0.5 pt-1 text-left cursor-pointer"
              >
                Resolve Queries <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </div>

            {/* Stage 4: PO Generation */}
            <div className={`p-3 rounded-lg border flex flex-col justify-between space-y-2 ${
              (metrics?.ccsAwaitingPOCount || 0) > 0
                ? "border-[--success]/40 bg-[--success]/5"
                : "border-border bg-surface"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[--success]">4. PO Creation</span>
                <span className="p-1 rounded bg-[--success]/10 text-[--success]">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-[--success]">
                  {metrics?.ccsAwaitingPOCount || 0}
                </div>
                <div className="text-[10px] text-muted-foreground">Approved CCs ready for PO</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveQueueTab("ready_po")}
                className="text-[10px] font-semibold text-[--success] hover:underline inline-flex items-center gap-0.5 pt-1 text-left cursor-pointer"
              >
                Generate POs <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </div>

            {/* Stage 5: Authorized POs */}
            <div className="p-3 rounded-lg border border-border bg-surface flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">5. Active POs</span>
                <span className="p-1 rounded bg-[--success]/10 text-[--success]">
                  <ShoppingBag className="h-3.5 w-3.5" />
                </span>
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {metrics?.approvedPOCount || 0}
                </div>
                <div className="text-[10px] text-muted-foreground">Binding orders dispatched</div>
              </div>
              <Link href="/dashboard/procurement/purchase-orders" className="text-[10px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 pt-1">
                View All POs <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Actionable Queues & Workspaces Tabs ── */}
      <div className="space-y-4">
        {/* Tab Selection Navigation */}
        <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveQueueTab("ready_mr")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeQueueTab === "ready_mr"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>MRs Awaiting Quotations</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeQueueTab === "ready_mr" ? "bg-white/20 text-white" : "bg-muted text-foreground"
            }`}>
              {metrics?.mrsReadyForCCCount || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveQueueTab("ready_po")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeQueueTab === "ready_po"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Approved CCs Ready for PO</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeQueueTab === "ready_po" ? "bg-white/20 text-white" : "bg-muted text-foreground"
            }`}>
              {metrics?.ccsAwaitingPOCount || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveQueueTab("queried")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeQueueTab === "queried"
                ? "bg-[--warning] text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Queried Items</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeQueueTab === "queried" ? "bg-white/20 text-white" : "bg-[--warning]/20 text-[--warning]"
            }`}>
              {(metrics?.queriedCCCount || 0) + (metrics?.queriedPOCount || 0)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveQueueTab("audit")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeQueueTab === "audit"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Live Audit Stream</span>
          </button>
        </div>

        {/* Tab 1 Content: Material Requests Ready for CC */}
        {activeQueueTab === "ready_mr" && (
          <Card>
            <CardHeader className="border-b border-border pb-3 bg-muted/10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold text-foreground">
                    Site Material Requests Awaiting Price Quotations
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Site requests authorized by project manager that need multi-vendor rate quotes.
                  </CardDescription>
                </div>
                <Link href="/dashboard/procurement/cost-comparisons/new">
                  <Button size="sm" variant="outline" className="text-xs gap-1 h-7">
                    <Plus className="h-3 w-3" />
                    New CC
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {!metrics?.mrsReadyForCC || metrics.mrsReadyForCC.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    <CheckCircle2 className="h-6 w-6 text-[--success] mx-auto mb-1.5" />
                    <p className="font-semibold text-foreground">All site requests are processed</p>
                    <p className="text-[11px]">No pending MRs waiting for cost comparison tenders.</p>
                  </div>
                ) : (
                  metrics.mrsReadyForCC.map((mr: any) => (
                    <div key={mr._id} className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-muted/20 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">{mr.refNo}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[--info]/10 text-[--info] border border-[--info]/20">
                            Ready for CC
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>Project: <strong className="text-foreground">{mr.projectName}</strong></span>
                          <span>&bull;</span>
                          <span>Site: <strong className="text-foreground">{mr.siteName}</strong></span>
                          <span>&bull;</span>
                          <span>Items: <strong className="font-mono text-foreground">{mr.itemCount}</strong></span>
                        </div>
                      </div>
                      <Link href={`/dashboard/procurement/cost-comparisons/new?mrId=${mr._id}`}>
                        <Button size="sm" className="text-xs font-semibold gap-1 h-8">
                          <span>Create CC</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 2 Content: CCs Awaiting PO Generation */}
        {activeQueueTab === "ready_po" && (
          <Card>
            <CardHeader className="border-b border-border pb-3 bg-muted/10">
              <div>
                <CardTitle className="text-xs font-bold text-foreground">
                  Approved Quotes Ready for Purchase Order Issuance
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Manager has signed off on the winning vendor quote. 1-click generation auto-fills the entire order.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {!metrics?.ccsAwaitingPO || metrics.ccsAwaitingPO.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    <CheckCircle2 className="h-6 w-6 text-[--success] mx-auto mb-1.5" />
                    <p className="font-semibold text-foreground">All approved CCs have been converted to POs</p>
                    <p className="text-[11px]">No pending approved quotes waiting for order generation.</p>
                  </div>
                ) : (
                  metrics.ccsAwaitingPO.map((cc: any) => (
                    <div key={cc._id} className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-muted/20 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">{cc.refNo}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[--success]/10 text-[--success] border border-[--success]/20">
                            Approved Quote
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>Selected Vendor: <strong className="text-foreground">{cc.winningVendorName}</strong></span>
                          <span>&bull;</span>
                          <span>Amount: <strong className="font-mono text-primary font-bold">₹{cc.winningAmount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setSelectedCCForPO(cc)}
                        className="text-xs font-semibold gap-1 h-8 bg-[--success] hover:bg-[--success]/90 text-white"
                      >
                        <span>Generate PO</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 3 Content: Queried Items */}
        {activeQueueTab === "queried" && (
          <Card>
            <CardHeader className="border-b border-border pb-3 bg-muted/10">
              <div>
                <CardTitle className="text-xs font-bold text-[--warning] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Documents Queried by Project Manager
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Review manager comments and resubmit updated quotes or commercial terms.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {(!metrics?.queriedCCs || metrics.queriedCCs.length === 0) &&
                (!metrics?.queriedPOs || metrics.queriedPOs.length === 0) ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    <CheckCircle2 className="h-6 w-6 text-[--success] mx-auto mb-1.5" />
                    <p className="font-semibold text-foreground">No queried documents</p>
                    <p className="text-[11px]">All submitted cost comparisons and purchase orders are clear.</p>
                  </div>
                ) : (
                  <>
                    {metrics?.queriedCCs?.map((cc: any) => (
                      <div key={cc._id} className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-muted/20 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">{cc.refNo}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[--warning]/10 text-[--warning] border border-[--warning]/30">
                              Cost Comparison Queried
                            </span>
                          </div>
                          {cc.reviewNote && (
                            <p className="text-[11px] text-foreground/80 italic pl-2 border-l-2 border-[--warning]/50">
                              &ldquo;{cc.reviewNote}&rdquo;
                            </p>
                          )}
                        </div>
                        <Link href={`/dashboard/procurement/cost-comparisons/${cc._id}`}>
                          <Button size="sm" variant="outline" className="text-xs font-semibold gap-1 h-8 border-[--warning]/30 text-[--warning]">
                            Resolve CC Query
                          </Button>
                        </Link>
                      </div>
                    ))}

                    {metrics?.queriedPOs?.map((po: any) => (
                      <div key={po._id} className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-muted/20 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">{po.refNo}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[--warning]/10 text-[--warning] border border-[--warning]/30">
                              Purchase Order Queried
                            </span>
                          </div>
                          {po.reviewNote && (
                            <p className="text-[11px] text-foreground/80 italic pl-2 border-l-2 border-[--warning]/50">
                              &ldquo;{po.reviewNote}&rdquo;
                            </p>
                          )}
                        </div>
                        <Link href={`/dashboard/procurement/purchase-orders/${po._id}`}>
                          <Button size="sm" variant="outline" className="text-xs font-semibold gap-1 h-8 border-[--warning]/30 text-[--warning]">
                            Resolve PO Query
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 4 Content: Live Audit Stream */}
        {activeQueueTab === "audit" && (
          <Card>
            <CardHeader className="border-b border-border pb-3 bg-muted/10">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Real-Time Procurement Audit Trail
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
                          <span className="font-mono text-primary font-bold">{log.referenceId || log.documentType}</span>
                          <span>&bull;</span>
                          <span className="capitalize">{log.action?.replace(/_/g, " ")}</span>
                        </div>
                        {log.note && (
                          <p className="text-[11px] text-muted-foreground italic">
                            &ldquo;{log.note}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground space-y-0.5 shrink-0">
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
                    No procurement audit events recorded yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Generate PO Modal for 1-Click Action from Inbox */}
      {selectedCCForPO && (
        <GeneratePOModal
          isOpen={true}
          onClose={() => setSelectedCCForPO(null)}
          costComparisonId={selectedCCForPO._id}
          costComparisonRefNo={selectedCCForPO.refNo}
          vendorName={selectedCCForPO.winningVendorName}
          totalAmount={selectedCCForPO.winningAmount}
        />
      )}
    </div>
  );
}

