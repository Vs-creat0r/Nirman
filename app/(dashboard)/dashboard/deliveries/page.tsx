"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import { Id } from "@/convex/_generated/dataModel";
import { StatusBadge } from "@/components/document/status-badge";
import { DispatchDeliveryModal } from "@/components/document/dispatch-delivery-modal";
import { ConfirmDeliveryModal } from "@/components/document/confirm-delivery-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Truck, Plus, Search, CheckCircle2, Clock, Phone, Building2,
  Package, Calendar, AlertTriangle, FileText, Eye, X, ExternalLink
} from "lucide-react";
import {
  DELIVERY_CHALLAN_OPEN_STATES,
  DELIVERY_CHALLAN_CLOSED_STATES,
} from "@/lib/lifecycle/delivery_challan";

function DCActionsCell({
  dc,
  token,
  onReceive,
}: {
  dc: any;
  token?: string | null;
  onReceive: () => void;
}) {
  const actionsData = useQuery(
    api.lifecycle.availableActions,
    dc?._id && token ? { table: "delivery_challan", documentId: dc._id, token } : "skip"
  );
  const canDeliver = actionsData?.actions.find((a) => a.name === "deliver");

  if (!canDeliver || !canDeliver.enabled) return null;

  return (
    <Button
      size="sm"
      onClick={onReceive}
      className="h-7 px-2.5 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {canDeliver.label}
    </Button>
  );
}

export default function DeliveriesPage() {
  const { role, user } = useRole();
  const { token } = useSession();

  const [activeTab, setActiveTab] = React.useState<"all" | "in_transit" | "delivered">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);
  const [selectedDCForDetails, setSelectedDCForDetails] = React.useState<any | null>(null);
  const [selectedDCForReceive, setSelectedDCForReceive] = React.useState<any | null>(null);

  const deliveries = useQuery(
    api.delivery_challans.listDCs,
    token ? { token } : "skip"
  );

  const canDispatch = role === "procurement_officer" || role === "project_manager" || role === "admin";
  const isSupervisor = role === "site_supervisor";

  // Filtered deliveries
  const filteredDeliveries = React.useMemo(() => {
    if (!deliveries) return [];
    return (deliveries as any[]).filter((dc: any) => {
      // Tab filter
      if (activeTab === "in_transit" && !DELIVERY_CHALLAN_OPEN_STATES.includes(dc.status)) return false;
      if (activeTab === "delivered" && !DELIVERY_CHALLAN_CLOSED_STATES.includes(dc.status)) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = dc.refNo?.toLowerCase().includes(q);
        const matchPo = dc.poRefNo?.toLowerCase().includes(q);
        const matchVehicle = dc.vehicleNo?.toLowerCase().includes(q);
        const matchDriver = dc.driverName?.toLowerCase().includes(q);
        const matchVendor = dc.vendorName?.toLowerCase().includes(q);
        const matchSite = dc.siteName?.toLowerCase().includes(q);
        if (!matchRef && !matchPo && !matchVehicle && !matchDriver && !matchVendor && !matchSite) {
          return false;
        }
      }

      return true;
    });
  }, [deliveries, activeTab, searchQuery]);

  // Counts
  const inTransitCount = deliveries?.filter((d) => (DELIVERY_CHALLAN_OPEN_STATES as readonly string[]).includes(d.status)).length ?? 0;
  const deliveredCount = deliveries?.filter((d) => (DELIVERY_CHALLAN_CLOSED_STATES as readonly string[]).includes(d.status)).length ?? 0;
  const totalCount = deliveries?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              Deliveries & Dispatch
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
              Challan Tracking
            </span>
          </div>
          <p className="text-xs text-muted-foreground select-none mt-1">
            Track site dispatches, driver logistics, and delivery receipts in real-time.
          </p>
        </div>

        {canDispatch && (
          <Button
            onClick={() => setIsDispatchModalOpen(true)}
            size="sm"
            className="gap-1.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Dispatch New Delivery
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={inTransitCount > 0 ? "border-indigo-500/30 bg-indigo-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Out for Delivery / In Transit
            </CardTitle>
            <Truck className={`h-4 w-4 ${inTransitCount > 0 ? "text-indigo-500 animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {deliveries ? inTransitCount : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Shipments currently on the road to site
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Received & Delivered
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {deliveries ? deliveredCount : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Shipments successfully unloaded & confirmed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Total Dispatches
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {deliveries ? totalCount : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Historical delivery challans generated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface border border-border">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "all"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setActiveTab("in_transit")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "in_transit"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            In Transit ({inTransitCount})
          </button>
          <button
            onClick={() => setActiveTab("delivered")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "delivered"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Delivered ({deliveredCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search ref, vehicle, driver, site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* Deliveries Table / Cards */}
      {deliveries === undefined ? (
        <div className="p-8 border border-border rounded-xl bg-card space-y-3">
          <div className="h-6 w-1/3 bg-muted animate-pulse rounded" />
          <div className="h-10 w-full bg-muted/60 animate-pulse rounded" />
          <div className="h-10 w-full bg-muted/40 animate-pulse rounded" />
          <div className="h-10 w-full bg-muted/20 animate-pulse rounded" />
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-surface/30 space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Truck className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No deliveries found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? "No delivery challans match your search criteria."
              : activeTab === "in_transit"
              ? "No shipments are currently out for delivery."
              : "No delivery records have been created yet."}
          </p>
          {canDispatch && !searchQuery && (
            <Button
              onClick={() => setIsDispatchModalOpen(true)}
              size="sm"
              variant="outline"
              className="text-xs mt-2"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Dispatch First Delivery
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 border-b border-border text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Challan Ref</th>
                  <th className="px-4 py-3">Linked PO</th>
                  <th className="px-4 py-3">Destination Site</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Vehicle & Driver</th>
                  <th className="px-4 py-3">Expected Arrival</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDeliveries.map((dc) => (
                  <tr key={dc._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-foreground">
                        {dc.refNo}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {new Date(dc._creationTime).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {dc.poRefNo}
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{dc.siteName}</span>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {dc.vendorName}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono">{dc.vehicleNo}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <span>{dc.driverName}</span>
                        {dc.driverPhone && (
                          <a
                            href={`tel:${dc.driverPhone}`}
                            className="inline-flex items-center gap-0.5 text-primary hover:underline ml-1 font-mono"
                          >
                            <Phone className="h-2.5 w-2.5" />
                            {dc.driverPhone}
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground font-mono">
                      {dc.expectedArrival}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusBadge status={dc.status} />
                        {dc.isPartial && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Partial Batch
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <DCActionsCell
                          dc={dc}
                          token={token}
                          onReceive={() => setSelectedDCForReceive(dc)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedDCForDetails(dc)}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {isDispatchModalOpen && (
        <DispatchDeliveryModal
          isOpen={isDispatchModalOpen}
          onClose={() => setIsDispatchModalOpen(false)}
        />
      )}

      {/* Details Sheet / Modal */}
      {selectedDCForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground font-mono">
                    {selectedDCForDetails.refNo}
                  </h2>
                  <StatusBadge status={selectedDCForDetails.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Delivery Challan for {selectedDCForDetails.poRefNo}
                </p>
              </div>
              <button
                onClick={() => setSelectedDCForDetails(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Top metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-border bg-surface/50">
                <div>
                  <span className="text-muted-foreground">Vehicle:</span>
                  <p className="font-mono font-bold text-foreground">
                    {selectedDCForDetails.vehicleNo}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Driver:</span>
                  <p className="font-medium text-foreground">
                    {selectedDCForDetails.driverName}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contact:</span>
                  <p className="font-mono text-foreground">
                    {selectedDCForDetails.driverPhone || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expected:</span>
                  <p className="font-mono text-foreground">
                    {selectedDCForDetails.expectedArrival}
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  Dispatched Line Items ({selectedDCForDetails.dispatchedItems?.length || 0})
                </h3>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground font-semibold">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Ordered</th>
                        <th className="px-3 py-2 text-right">Dispatched</th>
                        <th className="px-3 py-2">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedDCForDetails.dispatchedItems?.map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium text-foreground">
                            {item.itemName}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                            {item.orderedQty}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                            {item.dispatchedQty}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedDCForDetails.notes && (
                <div className="p-3 rounded-lg border border-border bg-surface/30">
                  <span className="font-medium text-foreground block mb-1">Remarks / Notes:</span>
                  <p className="text-muted-foreground italic">{selectedDCForDetails.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
              <div>
                {selectedDCForDetails.status === "delivery_processing" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const dcToReceive = selectedDCForDetails;
                      setSelectedDCForDetails(null);
                      setSelectedDCForReceive(dcToReceive);
                    }}
                    className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirm Receipt & Generate GRN
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDCForDetails(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delivery Modal */}
      {selectedDCForReceive && (
        <ConfirmDeliveryModal
          isOpen={!!selectedDCForReceive}
          onClose={() => setSelectedDCForReceive(null)}
          deliveryChallan={selectedDCForReceive}
        />
      )}
    </div>
  );
}
