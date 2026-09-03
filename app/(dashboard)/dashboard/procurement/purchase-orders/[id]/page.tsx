"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentView } from "@/components/document";
import { EditPOModal } from "@/components/document/edit-po-modal";
import { DispatchDeliveryModal } from "@/components/document/dispatch-delivery-modal";
import { StatusBadge } from "@/components/document/status-badge";
import { Button } from "@/components/ui/button";
import { Truck, ExternalLink } from "lucide-react";

export default function ProcurementPODetailPage() {
  const params = useParams();
  const { token } = useSession();
  const id = params?.id as Id<"purchase_order">;

  const po = useQuery(api.purchase_orders.getPO, id && token ? { id, token } : "skip");
  const submitPOMutation = useMutation(api.purchase_orders.submitPO);
  const cancelPOMutation = useMutation(api.purchase_order_closure.cancelPO);

  const allDCs = useQuery(api.delivery_challans.listDCs, token ? { token } : "skip");
  const deliveries = allDCs?.filter((d: any) => d.purchaseOrderId === id || d.purchaseOrder?._id === id);

  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);

  if (po === undefined) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading Purchase Order…</span>
      </div>
    );
  }

  if (po === null) {
    return (
      <div className="p-12 text-center space-y-3">
        <h2 className="text-base font-bold text-foreground">Purchase Order Not Found</h2>
        <p className="text-xs text-muted-foreground">The requested purchase order could not be found.</p>
        <Link href="/dashboard/procurement/purchase-orders">
          <Button variant="outline" size="sm" className="text-xs">Back to Purchase Orders</Button>
        </Link>
      </div>
    );
  }

  const handleAction = async (actionName: string, note?: string) => {
    if (actionName === "submit") {
      await submitPOMutation({ id, token: token || undefined });
    } else if (actionName === "resubmit") {
      setIsEditModalOpen(true);
    } else if (actionName === "cancel" || actionName === "short_close" || actionName === "close") {
      if (!note) throw new Error(`${actionName.replace("_", " ")} reason is required.`);
      await cancelPOMutation({ id, reason: note, token: token || undefined });
    }
  };

  return (
    <>
      <DocumentView
        docType="purchase_order"
        doc={po as any}
        userRole="procurement_officer"
        backHref="/dashboard/procurement/purchase-orders"
        backLabel="Back to Purchase Orders"
        editHref={`/dashboard/procurement/purchase-orders/${id}/edit`}
        onAction={handleAction}
        headerExtras={
          po.status === "approved" ? (
            <Button
              size="sm"
              onClick={() => setIsDispatchModalOpen(true)}
              className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Truck className="h-3.5 w-3.5" />
              Dispatch Delivery (DC)
            </Button>
          ) : undefined
        }
        linkedDocs={{
          mr: po.materialRequest && po.materialRequestId
            ? { id: po.materialRequestId, refNo: po.materialRequest.refNo || "MR", status: "pending_po" }
            : undefined,
          cc: po.costComparisonId
            ? { id: po.costComparisonId, refNo: "CC", status: "approved" }
            : undefined,
          po: { id: po._id, refNo: po.refNo, status: po.status },
        }}
      >
        {deliveries && deliveries.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-primary" />
                Linked Delivery Challans ({deliveries.length})
              </h3>
            </div>
            <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3">DC Number</th>
                    <th className="py-2.5 px-3">Vehicle No</th>
                    <th className="py-2.5 px-3">Driver Phone</th>
                    <th className="py-2.5 px-3">Dispatch Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries.map((dc: any) => (
                    <tr key={dc._id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">{dc.challanNo}</td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">{dc.vehicleNo || "—"}</td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">{dc.driverPhone || "—"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {dc.dispatchDate ? new Date(dc.dispatchDate).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={dc.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link href={`/dashboard/deliveries/${dc._id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 px-2">
                            View DC
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DocumentView>

      {isEditModalOpen && (
        <EditPOModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          po={po as any}
        />
      )}

      {isDispatchModalOpen && (
        <DispatchDeliveryModal
          isOpen={isDispatchModalOpen}
          onClose={() => setIsDispatchModalOpen(false)}
          purchaseOrderId={id}
        />
      )}
    </>
  );
}
