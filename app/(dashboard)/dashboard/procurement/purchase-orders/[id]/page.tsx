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
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  User,
  Edit2,
  Ban,
} from "lucide-react";
import { EditPOModal } from "@/components/document/edit-po-modal";
import { DispatchDeliveryModal } from "@/components/document/dispatch-delivery-modal";

export default function ProcurementPODetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useSession();
  const id = params?.id as Id<"purchase_order">;

  const user = useQuery(api.users.getMyUser, token ? { token } : "skip");
  const po = useQuery(
    api.purchase_orders.getPO,
    id && token ? { id, token } : "skip"
  );
  const submitPOMutation = useMutation(api.purchase_orders.submitPO);
  const cancelPOMutation = useMutation(api.purchase_orders.cancelPO);

  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [isCancelling, setIsCancelling] = React.useState(false);
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
  const isSubmitted = po.status === "submitted";
  const isQueried = po.status === "queried";
  const isApproved = po.status === "approved";
  const isRejected = po.status === "rejected";
  const isCancelled = po.status === "cancelled";
  const isClosed = po.status === "closed";

  const isManagerOrAdmin =
    user?.role === "project_manager" || user?.role === "admin";

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

  const handleCancelPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;

    setIsCancelling(true);
    setError(null);

    try {
      await cancelPOMutation({
        id,
        reason: cancelReason.trim(),
        token: token || undefined,
      });
      setIsCancelModalOpen(false);
      setCancelReason("");
    } catch (err: any) {
      setError(err.message || "Failed to cancel Purchase Order.");
    } finally {
      setIsCancelling(false);
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
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditModalOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit Draft
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitDraft}
                disabled={isActionLoading}
                className="gap-1.5 text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5" />
                {isActionLoading ? "Submitting…" : "Submit for Manager Approval"}
              </Button>
            </>
          )}

          {/* Action Button for Queried status */}
          {isQueried && (
            <Button
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="gap-1.5 text-xs font-semibold bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit & Resubmit PO
            </Button>
          )}

          {/* If Approved, show Dispatch DC Action */}
          {isApproved && (
            <>
              <Button
                size="sm"
                onClick={() => setIsDispatchModalOpen(true)}
                className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Truck className="h-3.5 w-3.5" />
                Dispatch Items / Create DC &rarr;
              </Button>

              {isManagerOrAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="gap-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Cancel PO
                </Button>
              )}
            </>
          )}

          {/* If Submitted and manager/admin, show Cancel option */}
          {isSubmitted && isManagerOrAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCancelModalOpen(true)}
              className="gap-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancel PO
            </Button>
          )}

          {isCancelled && (
            <span className="text-xs font-bold text-destructive bg-destructive/10 px-3 py-1.5 rounded-md border border-destructive/20 flex items-center gap-1.5">
              <Ban className="h-3.5 w-3.5" />
              Purchase Order Cancelled
            </span>
          )}

          {isClosed && (
            <span className="text-xs font-bold text-success bg-success/10 px-3 py-1.5 rounded-md border border-success/20 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Purchase Order Fulfilled & Closed
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
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-warning">
                Queried by Manager
              </h3>
              <p className="text-xs text-foreground">
                {po.reviewNote && po.reviewNote.trim().toUpperCase() !== "NA"
                  ? po.reviewNote
                  : "Reviewer requested changes on this purchase order."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            className="text-xs font-semibold gap-1.5 bg-warning hover:bg-warning/90 text-warning-foreground shrink-0"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit & Resubmit
          </Button>
        </div>
      )}

      {/* Cancellation Notice if Cancelled */}
      {isCancelled && po.cancellationReason && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3">
          <Ban className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-destructive">
              Purchase Order Cancelled
            </h3>
            <p className="text-xs text-foreground">
              Reason: &ldquo;{po.cancellationReason}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Main PO Document Card */}
      <Card>
        <CardHeader className="border-b border-border pb-4 bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-lg font-bold text-foreground">
                  {po.refNo}
                </span>
                <StatusBadge status={po.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Formal Commercial Purchase Order &bull; Source CC: <span className="font-mono font-semibold text-primary">{po.costComparison?.refNo || "CC"}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  Issue Date:{" "}
                  <strong className="text-foreground">
                    {new Date(po._creationTime).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                </span>
              </div>

              {po.validUntil && (
                <div className="flex items-center gap-1.5 text-muted-foreground bg-warning/10 px-2.5 py-1 rounded-md border border-warning/20">
                  <Clock className="h-3.5 w-3.5 text-warning" />
                  <span>
                    Valid Until:{" "}
                    <strong className="text-foreground">
                      {new Date(po.validUntil).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                </div>
              )}

              <div className="font-mono text-sm">
                Total: <strong className="text-primary text-base font-bold">₹{po.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* 2-Column: Buyer Company vs Vendor Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Buyer Details */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-primary font-bold uppercase tracking-wider text-[11px] border-b border-border/60 pb-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Buyer (Ordering Entity)
              </div>
              <div className="text-sm font-bold text-foreground">
                {po.buyerCompany?.companyName || "Nirman Construction & Infra"}
              </div>
              <div className="text-muted-foreground">
                GSTIN: <span className="font-mono font-semibold text-foreground">{po.buyerCompany?.companyGstNo || "27AABCN1234F1Z5"}</span>
              </div>
              <div className="text-muted-foreground">
                Billing Address: <span className="text-foreground">{po.buyerCompany?.companyBillingAddress || "Head Office Commercial Hub, Mumbai"}</span>
              </div>
            </div>

            {/* Vendor Details */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-primary font-bold uppercase tracking-wider text-[11px] border-b border-border/60 pb-1.5">
                <User className="h-3.5 w-3.5" />
                Vendor (Selected Supplier)
              </div>
              <div className="text-sm font-bold text-foreground">
                {po.vendor?.name || "Selected Vendor"}
              </div>
              <div className="text-muted-foreground">
                GSTIN: <span className="font-mono font-semibold text-foreground">{po.vendor?.gstNo || "Unregistered / Overseas"}</span>
              </div>
              <div className="text-muted-foreground">
                Contact: <span className="text-foreground">{po.vendor?.phone || "No Phone"} {po.vendor?.email ? `• ${po.vendor.email}` : ""}</span>
              </div>
            </div>
          </div>

          {/* Delivery & Shipping Details Box */}
          <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Ship-To Site Delivery Location
                </span>
                <div className="font-semibold text-foreground">
                  {po.siteName} &bull; <span className="text-muted-foreground font-normal">{po.projectName}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {po.siteAddress || "Site Premises location"}
                </p>
              </div>

              <div className="flex items-center gap-6 text-xs sm:border-l sm:border-border sm:pl-4">
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase">Expected Delivery</span>
                  <strong className="text-foreground">
                    {po.expectedDelivery
                      ? new Date(po.expectedDelivery).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "Standard timeline"}
                  </strong>
                </div>
                {po.placeOfSupplyStateCode && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Place of Supply</span>
                    <strong className="text-foreground font-mono">State {po.placeOfSupplyStateCode}</strong>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase">Currency</span>
                  <strong className="text-foreground font-mono">INR (₹)</strong>
                </div>
              </div>
            </div>

            {/* Logistics Specifics: Contact, Unloading & Freight */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-border/60 text-[11px]">
              <div>
                <span className="text-muted-foreground block">Site Receiving Contact:</span>
                <span className="font-semibold text-foreground">
                  {po.siteContactPerson || "Site Supervisor / In-Charge"}
                  {po.siteContactPhone ? ` (${po.siteContactPhone})` : ""}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Unloading Scope:</span>
                <span className="font-semibold text-foreground capitalize">
                  {po.unloadingScope ? po.unloadingScope.replace("_", " ") : "Buyer Scope (Site Team)"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Freight Terms:</span>
                <span className="font-semibold text-foreground capitalize">
                  {po.freightTerms ? po.freightTerms.replace(/_/g, " ") : "Included in Rate (FOR Site)"}
                </span>
              </div>
            </div>

            {/* Procurement Officer Remarks */}
            {po.procurementNotes && (
              <div className="pt-2 border-t border-border/40 text-[11px]">
                <span className="text-muted-foreground font-semibold block">Procurement Officer Remarks:</span>
                <p className="text-foreground italic mt-0.5">
                  &ldquo;{po.procurementNotes}&rdquo;
                </p>
              </div>
            )}
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
                    <th className="py-2.5 px-3 w-28">HSN/SAC Code</th>
                    <th className="py-2.5 px-3 w-20 text-right">Quantity</th>
                    <th className="py-2.5 px-3 w-16">Unit</th>
                    <th className="py-2.5 px-3 w-28 text-right">Unit Rate (₹)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {po.lineItems.map((item, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{item.itemName}</span>
                          {item.isUnquotedAddition && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning/10 text-warning border border-warning/20">
                              Scope Addition
                            </span>
                          )}
                        </div>
                        {item.additionReason && (
                          <p className="text-[10px] text-muted-foreground italic mt-0.5">
                            Reason: {item.additionReason}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">
                        {item.hsnSacCode || "—"}
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

          {/* Financial Totals & Commercial Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-2 text-xs">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                Commercial Payment Terms
              </span>
              <div className="space-y-1">
                <div>
                  Payment Terms:{" "}
                  <strong className="capitalize text-foreground">
                    {po.paymentTerms?.replace("_", " ")}
                  </strong>
                </div>
                <div>
                  Issued By: <strong className="text-foreground">{po.creatorName}</strong>
                </div>
                {po.reviewerName && (
                  <div>
                    Authorized By: <strong className="text-success">{po.reviewerName}</strong>
                    {po.reviewedAt && (
                      <span className="text-muted-foreground text-[11px] ml-1">
                        on {new Date(po.reviewedAt).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-1.5 font-mono text-xs">
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

          {/* Terms & Conditions Box */}
          {po.termsAndConditions && (
            <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-2">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Terms & Conditions
              </h3>
              <pre className="text-xs text-muted-foreground font-sans whitespace-pre-wrap leading-relaxed bg-surface/50 p-3 rounded border border-border/60">
                {po.termsAndConditions}
              </pre>
            </div>
          )}

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
                po.logs.map((log, idx: number) => (
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

      {/* Edit & Resubmit Modal for Draft & Queried POs */}
      {(isDraft || isQueried) && (
        <EditPOModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          po={po}
        />
      )}

      {/* Dispatch Delivery Modal for Approved POs */}
      {isApproved && (
        <DispatchDeliveryModal
          isOpen={isDispatchModalOpen}
          onClose={() => setIsDispatchModalOpen(false)}
          purchaseOrderId={po._id}
        />
      )}

      {/* Cancel PO Dialog */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="max-w-md p-6 space-y-4">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Cancel Purchase Order ({po.refNo})
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Cancelling releases committed BOQ budget. Mandatory audit reason required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCancelPO} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cancellation Reason Note *</Label>
              <textarea
                rows={3}
                required
                placeholder="State why this purchase order is being cancelled / short-closed..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-sans leading-relaxed text-[11px]"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-border flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCancelModalOpen(false)}
                className="text-xs"
              >
                Keep PO Active
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isCancelling || !cancelReason.trim()}
                className="text-xs font-semibold gap-1.5"
              >
                <Ban className="h-3.5 w-3.5" />
                {isCancelling ? "Cancelling…" : "Confirm Cancel PO"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
