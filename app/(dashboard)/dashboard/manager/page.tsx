"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import { FileCheck, Sparkles, ArrowRight, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentTable } from "@/components/shared/document-table";

export default function ManagerDashboard() {
  const { user } = useRole();
  const { token } = useSession();

  const allRequests = useQuery(
    api.material_requests.listMRs,
    token ? { token } : "skip"
  );
  const allCCs = useQuery(
    api.cost_comparisons.listCCs,
    token ? { token } : "skip"
  );
  const allPOs = useQuery(
    api.purchase_orders.listPOs,
    token ? { token } : "skip"
  );

  const pendingRequests = allRequests?.filter((r) => r.status === "pending");
  const pendingCCs = allCCs?.filter((cc) => cc.status === "submitted");
  const pendingPOs = allPOs?.filter((po) => po.status === "submitted");

  // Cumulative: all requests that were approved and advanced through the pipeline
  const EVER_APPROVED = new Set([
    "ready_for_cc",
    "cc_in_progress",
    "review_cc",
    "ready_for_po",
    "review_po",
    "delivery_processing",
    "delivered",
  ]);
  const approvedRequests = allRequests?.filter((r) => EVER_APPROVED.has(r.status));

  const totalPendingActionCount =
    (pendingRequests?.length || 0) +
    (pendingCCs?.length || 0) +
    (pendingPOs?.length || 0);

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col gap-1.5 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
            Manager Portal
          </h1>
          <Badge variant="processing">Project Manager</Badge>
        </div>
        <p className="text-xs text-muted-foreground select-none">
          Welcome back, {user?.name || "Manager"}. Review material requests, manage approvals, and oversee site supply pipelines.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className={pendingRequests && pendingRequests.length > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Pending MRs
            </CardTitle>
            <Clock className={`h-4 w-4 ${pendingRequests && pendingRequests.length > 0 ? "text-amber-500 animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {pendingRequests ? pendingRequests.length : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Material requests awaiting review
            </p>
          </CardContent>
        </Card>

        <Card className={pendingCCs && pendingCCs.length > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Pending CCs
            </CardTitle>
            <Clock className={`h-4 w-4 ${pendingCCs && pendingCCs.length > 0 ? "text-amber-500 animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {pendingCCs ? pendingCCs.length : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Cost comparisons awaiting review
            </p>
          </CardContent>
        </Card>

        <Card className={pendingPOs && pendingPOs.length > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Pending POs
            </CardTitle>
            <Clock className={`h-4 w-4 ${pendingPOs && pendingPOs.length > 0 ? "text-amber-500 animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {pendingPOs ? pendingPOs.length : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Purchase orders awaiting release
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Approved Requests
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {approvedRequests ? approvedRequests.length : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Cumulative approved across pipeline
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Action Required: Pending Approvals
            </h2>
            <p className="text-xs text-muted-foreground">
              Review and approve or query material requests from site supervisors.
            </p>
          </div>
          <Link href="/dashboard/manager/material-requests">
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              View All Queue
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <DocumentTable
          data={pendingRequests}
          isLoading={allRequests === undefined}
          baseHref="/dashboard/manager/material-requests"
          emptyTitle="All caught up!"
          emptyDescription="There are no pending material requests requiring your review right now."
        />
      </div>
    </div>
  );
}
