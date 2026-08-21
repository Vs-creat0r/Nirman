"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { StatusBadge } from "@/components/document/status-badge";
import { DocumentLineageBar } from "@/components/document/document-lineage-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Calendar,
  Building2,
  Send,
  AlertTriangle,
  FileText,
  History,
  CheckCircle2,
  Clock,
  Truck,
  CreditCard,
} from "lucide-react";

export default function ProcurementPODetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useSession();
  const id = params?.id as Id<"purchase_order">;

  const po = useQuery(
    api.purchase_orders.getPO,
    id && token ? { id, token } : "skip"
  );
  const submitPOMutation = useMutation(api.purchase_orders.submitPO);

  const [isActionLoading, setIsActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
        <h2 className="text-base font-bold text-foreground">
          Purchase Order Not Found
        </h2>
        <p className="text-xs text-muted-foreground">
          The requested purchase order could not be found or you do not have permission to view it.
        </p>
        <Link href="/dashboard/procurement/purchase-orders">
          <Button variant="outline" size="sm" className="text-xs">
            Back to Purchase Orders
          </Button>
        </Link>
      </div>
    );
  }

  const isDraft = po.status === "draft";
  const isQueried = po.status === "queried";
  const isApproved = po.status === "approved";

  const handleSubmitDraft = async () => {
    setError(null);
    setIsActionLoading(true);
    try {
      await submitPOMutation({ id, token: token || undefined });
    } catch (err: any) {
      setError(err.message || "Failed to submit purchase order.");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Nav Back Link & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/procurement/purchase-orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Purchase Orders
        </Link>

        <div className="flex items-center gap-2">
          {/* Action Button for Draft status */}
          {isDraft && (
            <Button
              size="sm"
              onClick={handleSubmitDraft}
              disabled={isActionLoading}
              className="gap-1.5 text-xs font-semibold"
            >
              <Send className="h-3.5 w-3.5" />
              {isActionLoading ? "Submitting…" : "Submit for Manager Approval"}
            </Button>
          )}

          {/* If Approved, show ready for Delivery Challan */}
          {isApproved && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/30 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              PO Approved &bull; Ready for Delivery Challan
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {error}
        </div>
      )}

      {/* ── Document Lineage / Traceability Stepper ── */}
      <DocumentLineageBar
        currentType="po"
        mr={po.materialRequest ? { id: po.materialRequest._id, refNo: po.materialRequest.refNo, status: po.materialRequest.status } : undefined}
        cc={po.costComparison ? { id: po.costComparison._id, refNo: po.costComparison.refNo, status: po.costComparison.status } : undefined}
        po={{ id: po._id, refNo: po.refNo, status: po.status }}
        userRole="procurement"
      />

      {/* Queried Notice Alert Box */}
      {isQueried && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-amber-500">
              Queried by Manager
            </h3>
            <p className="text-xs text-foreground">
              {po.reviewNote || "Reviewer requested changes on this purchase order."}
            </p>
          </div>
        </div>
      )}

      {/* Main PO Document Card */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-base font-bold text-foreground">
                  {po.refNo}
                </span>
                <StatusBadge status={po.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Project: <strong>{po.projectName}</strong> &bull; Delivery Site: <strong>{po.siteName}</strong>
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {new Date(po._creationTime).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div>
                Total: <strong className="font-mono text-foreground text-sm">₹{po.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Vendor Details Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border text-xs">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                Issued to Vendor
              </span>
              <div className="text-sm font-bold text-foreground">
                {po.vendor?.name || "Vendor"}
              </div>
              {po.vendor?.phone && (
                <div className="text-muted-foreground">Phone: {po.vendor.phone}</div>
              )}
              {po.vendor?.email && (
                <div className="text-muted-foreground">Email: {po.vendor.email}</div>
              )}
              {po.vendor?.gstNo && (
                <div className="text-muted-foreground font-mono">GSTIN: {po.vendor.gstNo}</div>
              )}
            </div>

            <div className="space-y-1 sm:border-l sm:border-border sm:pl-4">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                Commercial Terms & Logistics
              </span>
              <div>
                Payment Terms:{" "}
                <strong className="capitalize text-foreground">
                  {po.paymentTerms?.replace("_", " ")}
                </strong>
              </div>
              <div>
                Expected Delivery:{" "}
                <strong className="text-foreground">
                  {po.expectedDelivery || "Standard delivery timeline"}
                </strong>
              </div>
              <div>
                Source Cost Comparison:{" "}
                <strong className="font-mono text-primary">
                  {po.costComparison?.refNo || "CC Record"}
                </strong>
              </div>
              <div>
                Issued By: <strong className="text-foreground">{po.creatorName}</strong>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Ordered Line Items
            </h3>
            <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 w-20 text-right">Quantity</th>
                    <th className="py-2.5 px-3 w-16">Unit</th>
                    <th className="py-2.5 px-3 w-28 text-right">Unit Rate (₹)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {po.lineItems.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {item.itemName}
                        {item.hsnSacCode && (
                          <span className="text-[10px] font-mono text-muted-foreground ml-2">
                            HSN: {item.hsnSacCode}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        ₹{item.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Totals Breakdown */}
          <div className="flex justify-end">
            <div className="w-full sm:w-80 p-4 rounded-lg bg-muted/30 border border-border space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Items Subtotal:</span>
                <span>₹{po.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST ({po.taxRate}%):</span>
                <span>+₹{po.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              {po.freight !== undefined && po.freight > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Freight Charges:</span>
                  <span>+₹{po.freight.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-bold text-foreground pt-2 border-t border-border">
                <span>Grand Total:</span>
                <span className="text-base text-primary">
                  ₹{po.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Audit Log Timeline */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Audit Trail & Authorization History
              </h3>
            </div>

            <div className="space-y-2.5">
              {po.logs && po.logs.length > 0 ? (
                po.logs.map((log: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-md bg-muted/20 border border-border text-xs"
                  >
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          {log.actorName}{" "}
                          <span className="text-[10px] text-muted-foreground font-normal capitalize">
                            ({log.actorRole?.replace("_", " ")})
                          </span>
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(log.timestamp).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          &bull;{" "}
                          {new Date(log.timestamp).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Action: <span className="font-medium text-foreground">{log.action?.replace(/_/g, " ")}</span>
                        {log.toStatus && (
                          <> &rarr; Status: <span className="font-semibold text-foreground capitalize">{log.toStatus.replace(/_/g, " ")}</span></>
                        )}
                      </div>
                      {log.note && (
                        <p className="text-[11px] text-foreground/80 mt-1 italic pl-2 border-l-2 border-primary/40">
                          &ldquo;{log.note}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No log entries recorded yet.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
