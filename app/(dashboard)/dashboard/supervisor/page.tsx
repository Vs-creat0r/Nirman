"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import { FileText, Truck, Plus, Clock, CheckCircle2, AlertTriangle, ArrowRight, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentTable } from "@/components/shared/document-table";
import { StatusBadge } from "@/components/document/status-badge";

export default function SupervisorDashboard() {
  const { user } = useRole();
  const { token } = useSession();

  const materialRequests = useQuery(
    api.material_requests.listMRs,
    token ? { token } : "skip"
  );

  const deliveries = useQuery(
    api.delivery_challans.listDCs,
    token ? { token } : "skip"
  );

  const pendingCount = materialRequests?.filter((r) => r.status === "pending").length ?? 0;
  const queriedCount = materialRequests?.filter((r) => r.status === "queried").length ?? 0;
  const inTransitDeliveries = deliveries?.filter((d) => d.status === "delivery_processing") ?? [];
  const inTransitCount = inTransitDeliveries.length;

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
        <Card className={inTransitCount > 0 ? "border-indigo-500/40 bg-indigo-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Out for Delivery
            </CardTitle>
            <Truck className={`h-4 w-4 ${inTransitCount > 0 ? "text-indigo-500 animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {deliveries ? inTransitCount : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Shipments in transit to your site
            </p>
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
      </div>

      {/* Out for Delivery Alert Section if there are active shipments */}
      {inTransitCount > 0 && (
        <div className="p-4 border border-indigo-500/30 rounded-xl bg-indigo-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-indigo-500" /> Incoming Shipments ({inTransitCount})
              </h3>
            </div>
            <Link
              href="/dashboard/deliveries"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              View Deliveries <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inTransitDeliveries.slice(0, 2).map((dc) => (
              <div
                key={dc._id}
                className="p-3 bg-card border border-border rounded-lg flex items-center justify-between gap-3 text-xs shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{dc.refNo}</span>
                    <StatusBadge status={dc.status} />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    From: <strong className="text-foreground">{dc.vendorName}</strong> ({dc.itemCount} items)
                  </p>
                  <p className="text-muted-foreground text-[11px] flex items-center gap-1.5">
                    Vehicle: <strong className="font-mono text-foreground">{dc.vehicleNo}</strong> · Driver: {dc.driverName}
                    {dc.driverPhone && (
                      <a href={`tel:${dc.driverPhone}`} className="text-primary hover:underline font-mono ml-1">
                        ({dc.driverPhone})
                      </a>
                    )}
                  </p>
                </div>

                <Link href="/dashboard/deliveries">
                  <Button size="sm" variant="outline" className="text-xs shrink-0">
                    Track & Receive
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

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
