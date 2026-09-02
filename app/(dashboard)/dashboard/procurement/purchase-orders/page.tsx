"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { StatusBadge } from "@/components/document/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShoppingBag,
  Plus,
  ArrowRight,
  Clock,
  Search,
  CheckCircle2,
  Building2,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { GeneratePOModal } from "@/components/document/generate-po-modal";

import {
  PURCHASE_ORDER_OPEN_STATES,
  PURCHASE_ORDER_CLOSED_STATES,
} from "@/lib/lifecycle/purchase_order";

function PORowAction({ po, token }: { po: any; token?: string | null }) {
  const actionsData = useQuery(
    api.lifecycle.availableActions,
    po?._id && token ? { table: "purchase_order", documentId: po._id, token } : "skip"
  );
  const canSubmit = actionsData?.actions.find((a) => a.name === "submit");
  const canResubmit = actionsData?.actions.find((a) => a.name === "resubmit");

  if (canSubmit) {
    return (
      <Link href={`/dashboard/procurement/purchase-orders/${po._id}`}>
        <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 gap-1 font-medium">
          <Pencil className="h-3 w-3" />
          Edit Draft
        </Button>
      </Link>
    );
  }

  if (canResubmit) {
    return (
      <Link href={`/dashboard/procurement/purchase-orders/${po._id}`}>
        <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 gap-1 font-medium text-amber-600 dark:text-amber-400 border-amber-500/30">
          <Pencil className="h-3 w-3" />
          Edit & Resubmit
        </Button>
      </Link>
    );
  }

  return (
    <Link href={`/dashboard/procurement/purchase-orders/${po._id}`}>
      <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground">
        View
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );
}

export default function ProcurementPurchaseOrdersPage() {
  const router = useRouter();
  const { token } = useSession();

  const pos = useQuery(
    api.purchase_orders.listPOs,
    token ? { token } : "skip"
  );

  const readyCCs = useQuery(
    api.purchase_orders.listApprovedCCsForPO,
    token ? { token } : "skip"
  );

  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeModalCC, setActiveModalCC] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);


  const filteredPOs = (pos || []).filter((po) => {
    if (statusFilter !== "all" && po.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      po.refNo.toLowerCase().includes(q) ||
      po.vendorName.toLowerCase().includes(q) ||
      po.projectName.toLowerCase().includes(q) ||
      po.materialRequestRefNo.toLowerCase().includes(q) ||
      po.costComparisonRefNo.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Purchase Orders (PO)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Formal commercial purchase orders auto-filled from approved vendor cost comparisons. Zero manual re-entry.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {error}
        </div>
      )}

      {/* ── ACTION REQUIRED: Approved CCs awaiting PO generation ── */}
      {readyCCs && readyCCs.length > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/[0.02]">
          <CardHeader className="py-3 px-4 bg-emerald-500/10 border-b border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <CardTitle className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Ready for Purchase Order Generation ({readyCCs.length})
                </CardTitle>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Approved by Project Manager &bull; Winning Vendor Locked
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {readyCCs.map((cc) => (
                <div
                  key={cc._id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {cc.refNo}
                      </span>
                      <StatusBadge status={cc.status} />
                      <span className="text-xs text-muted-foreground">
                        &bull; {cc.projectName} ({cc.siteName})
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                      <span>
                        Winning Vendor: <strong className="text-foreground">{cc.selectedVendorName}</strong>
                      </span>
                      <span>
                        Total: <strong className="font-mono text-emerald-600 dark:text-emerald-400">₹{cc.winningTotal.toLocaleString("en-IN")}</strong>
                      </span>
                      <span>{cc.itemCount} items</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => setActiveModalCC(cc)}
                    className="text-xs font-semibold gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  >
                    Generate Purchase Order
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {/* ── ALL PURCHASE ORDERS TABLE ── */}
      <div className="space-y-4">
        {/* Filters and search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border text-xs overflow-x-auto max-w-full">
            {[
              { label: "All", value: "all" },
              { label: "Draft", value: "draft" },
              { label: "In Review", value: "submitted" },
              { label: "Approved (Active)", value: "approved" },
              { label: "Queried", value: "queried" },
              { label: "Rejected", value: "rejected" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.value
                    ? "bg-surface text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search PO ref, vendor, project…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* POs List Table */}
        <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-3.5">Reference</th>
                <th className="py-3 px-3">Vendor</th>
                <th className="py-3 px-3">Project & Site</th>
                <th className="py-3 px-3 text-center">Items</th>
                <th className="py-3 px-3">Payment Terms</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pos === undefined ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading Purchase Orders…
                  </td>
                </tr>
              ) : filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground space-y-2">
                    <ShoppingBag className="h-8 w-8 mx-auto text-muted-foreground/50" />
                    <p className="font-medium text-foreground">No Purchase Orders found</p>
                    <p className="text-[11px]">
                      {statusFilter !== "all"
                        ? `No Purchase Orders matching status "${statusFilter}".`
                        : "Generate a Purchase Order from an approved Cost Comparison above."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => (
                  <tr key={po._id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-3.5 font-mono font-bold text-foreground">
                      <Link
                        href={`/dashboard/procurement/purchase-orders/${po._id}`}
                        className="hover:underline text-primary"
                      >
                        {po.refNo}
                      </Link>
                    </td>
                    <td className="py-3 px-3 font-semibold text-foreground">
                      {po.vendorName}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      <span className="font-medium text-foreground">{po.projectName}</span> &bull; {po.siteName}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {po.itemCount} items
                      </span>
                    </td>
                    <td className="py-3 px-3 capitalize text-muted-foreground font-mono text-[11px]">
                      {po.paymentTerms?.replace("_", " ")}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                      ₹{po.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end">
                        <PORowAction po={po} token={token} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate PO Modal */}
      {activeModalCC && (
        <GeneratePOModal
          isOpen={!!activeModalCC}
          onClose={() => setActiveModalCC(null)}
          costComparisonId={activeModalCC._id}
          costComparisonRefNo={activeModalCC.refNo}
          projectName={activeModalCC.projectName}
          siteName={activeModalCC.siteName}
          siteAddress={activeModalCC.siteAddress}
          vendorName={activeModalCC.selectedVendorName}
          vendorGstNo={activeModalCC.selectedVendorGstNo}
          vendorPhone={activeModalCC.selectedVendorPhone}
          totalAmount={activeModalCC.winningTotal}
          subtotal={activeModalCC.winningSubtotal}
          taxRate={activeModalCC.winningTaxRate}
          freight={activeModalCC.winningFreight}
          paymentTerms={activeModalCC.winningPaymentTerms}
          deliveryDays={activeModalCC.winningDeliveryDays}
          items={activeModalCC.winningItems}
        />
      )}
    </div>
  );
}

