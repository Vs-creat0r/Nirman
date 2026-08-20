"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import { FileText, Truck, Plus, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentTable } from "@/components/shared/document-table";

export default function SupervisorDashboard() {
  const { user } = useRole();
  const { token } = useSession();

  const materialRequests = useQuery(
    api.material_requests.listMRs,
    token ? { token } : "skip"
  );

  const pendingCount = materialRequests?.filter((r) => r.status === "pending").length ?? 0;
  const queriedCount = materialRequests?.filter((r) => r.status === "queried").length ?? 0;
  const readyForCcCount = materialRequests?.filter((r) => r.status === "ready_for_cc").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              Supervisor Portal
            </h1>
            <Badge variant="success">Site Supervisor</Badge>
          </div>
          <p className="text-xs text-muted-foreground select-none mt-1">
            Welcome back, {user?.name || "Supervisor"}. Monitor material requests and track on-site deliveries.
          </p>
        </div>

        <Link href="/dashboard/supervisor/material-requests/new">
          <Button size="sm" className="gap-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" />
            New Material Request
          </Button>
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Pending Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {materialRequests ? pendingCount : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Awaiting manager review</p>
          </CardContent>
        </Card>

        <Card className={queriedCount > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Action Required
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 ${queriedCount > 0 ? "text-amber-500 animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {materialRequests ? queriedCount : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Requests queried by manager</p>
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
              {materialRequests ? readyForCcCount : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Proceeded to procurement</p>
          </CardContent>
        </Card>
      </div>

      {/* Material Requests Table */}
      <DocumentTable
        title="Recent Material Requests"
        description="Track the status of all requests created by you."
        data={materialRequests}
        isLoading={materialRequests === undefined}
        baseHref="/dashboard/supervisor/material-requests"
        newHref="/dashboard/supervisor/material-requests/new"
        newButtonLabel="New Request"
        emptyTitle="No material requests yet"
        emptyDescription="You haven't created any material requests. Click below to raise your first request."
      />
    </div>
  );
}
