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
import { CCComparisonView } from "@/components/document/cc-comparison-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Calendar,
  Send,
  AlertTriangle,
  FileText,
  History,
  Building2,
  CheckCircle2,
  Edit,
} from "lucide-react";
import { GeneratePOModal } from "@/components/document/generate-po-modal";

export default function ProcurementCCDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useSession();
  const id = params?.id as Id<"cost_comparison">;

  const cc = useQuery(
    api.cost_comparisons.getCC,
    id && token ? { id, token } : "skip"
  );
  const submitCCMutation = useMutation(api.cost_comparisons.submitCC);

  const [isGeneratePOModalOpen, setIsGeneratePOModalOpen] = React.useState(false);
  const [isActionLoading, setIsActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const availableActionsData = useQuery(
    api.lifecycle.availableActions,
    id && token ? { table: "cost_comparison", documentId: id, token } : "skip"
  );

  const canSubmit = availableActionsData?.actions.find((a) => a.name === "submit");
  const canResubmit = availableActionsData?.actions.find((a) => a.name === "resubmit");

  if (cc === undefined || availableActionsData === undefined) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading Cost Comparison…</span>
      </div>
    );
  }

  if (cc === null) {
    return (
      <div className="p-12 text-center space-y-3">
        <h2 className="text-base font-bold text-foreground">
          Cost Comparison Not Found
        </h2>
        <p className="text-xs text-muted-foreground">
          The requested cost comparison could not be found or you do not have permission to view it.
        </p>
        <Link href="/dashboard/procurement/cost-comparisons">
          <Button variant="outline" size="sm" className="text-xs">
            Back to Cost Comparisons
          </Button>
        </Link>
      </div>
    );
  }

  const isApproved = cc.status === "approved";

  const winningQuote = cc.vendorQuotes.find(
    (q: any) => q.vendorId === cc.selectedVendorId
  );

  const handleSubmitDraft = async () => {
    setError(null);
    setIsActionLoading(true);
    try {
      await submitCCMutation({ id, token: token || undefined });
    } catch (err: any) {
      setError(err.message || "Failed to submit cost comparison.");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Nav Back Link & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/procurement/cost-comparisons"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Cost Comparisons
        </Link>

        <div className="flex items-center gap-2">
          {/* Draft: Edit and Submit actions */}
          {canSubmit && (
            <>
              <Link href={`/dashboard/procurement/cost-comparisons/${id}/edit`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs font-semibold"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit Draft
                </Button>
              </Link>
              <Button
                size="sm"
                onClick={handleSubmitDraft}
                disabled={!canSubmit.enabled || isActionLoading}
                title={canSubmit.reason}
                className="gap-1.5 text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5" />
                {isActionLoading ? "Submitting…" : canSubmit.label}
              </Button>
            </>
          )}

          {/* Action Button for Approved status: Generate PO or View existing PO */}
          {isApproved && (
            cc.linkedPO ? (
              <Link href={`/dashboard/procurement/purchase-orders/${cc.linkedPO._id}`}>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs font-semibold"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View Purchase Order ({cc.linkedPO.refNo}) &rarr;
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                onClick={() => setIsGeneratePOModalOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Generate Purchase Order
              </Button>
            )
          )}

          {/* Action Button for Queried status */}
          {canResubmit && (
            <Link href={`/dashboard/procurement/cost-comparisons/${id}/edit`}>
              <Button
                size="sm"
                disabled={!canResubmit.enabled}
                title={canResubmit.reason}
                className="gap-1.5 text-xs font-semibold bg-warning hover:bg-warning/90 text-warning-foreground"
              >
                <Edit className="h-3.5 w-3.5" />
                {canResubmit.label}
              </Button>
            </Link>
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
        currentType="cc"
        mr={cc.materialRequest ? { id: cc.materialRequest._id, refNo: cc.materialRequest.refNo, status: cc.materialRequest.status } : undefined}
        cc={{ id: cc._id, refNo: cc.refNo, status: cc.status }}
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
              {cc.reviewNote || "Reviewer requested changes or revised vendor quotes."}
            </p>
          </div>
        </div>
      )}

      {/* Main Document Summary Card */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-base font-bold text-foreground">
                  {cc.refNo}
                </span>
                <StatusBadge status={cc.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Project: <strong>{cc.projectName}</strong> &bull; Site: <strong>{cc.siteName}</strong>
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {new Date(cc._creationTime).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div>
                Quotes: <strong className="text-foreground">{cc.vendorQuotes.length} Vendors</strong>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 rounded-md bg-muted/30 border border-border text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Source Material Request
              </span>
              <span className="font-semibold text-foreground font-mono">
                {cc.materialRequest ? (
                  <Link
                    href={`/dashboard/supervisor/material-requests/${cc.materialRequest._id}`}
                    className="hover:underline text-primary"
                  >
                    {cc.materialRequest.refNo} &rarr;
                  </Link>
                ) : (
                  "MR Record"
                )}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Prepared By
              </span>
              <span className="font-semibold text-foreground">
                {cc.creatorName}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Selected Winning Vendor
              </span>
              <span className="font-semibold text-foreground">
                {cc.selectedVendorName ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {cc.selectedVendorName}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">Awaiting Manager Selection</span>
                )}
              </span>
            </div>
          </div>

          {/* Justification note if any */}
          {cc.selectionJustification && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1 text-xs">
              <span className="font-bold text-foreground">Manager Selection Justification:</span>
              <p className="text-muted-foreground">{cc.selectionJustification}</p>
            </div>
          )}

          {/* ── Vendor Quote Comparison Matrix ── */}
          <CCComparisonView
            quotes={cc.vendorQuotes as any}
            selectedVendorId={cc.selectedVendorId}
          />

          {/* Audit Log Timeline */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Audit Trail & History
              </h3>
            </div>

            <div className="space-y-2.5">
              {cc.logs && cc.logs.length > 0 ? (
                cc.logs.map((log: any, idx: number) => (
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

      {/* Generate PO Modal */}
      {isApproved && (
        <GeneratePOModal
          isOpen={isGeneratePOModalOpen}
          onClose={() => setIsGeneratePOModalOpen(false)}
          costComparisonId={cc._id}
          costComparisonRefNo={cc.refNo}
          projectName={cc.projectName}
          siteName={cc.siteName}
          siteAddress={cc.siteAddress}
          vendorName={winningQuote?.vendorName}
          vendorGstNo={cc.selectedVendorGstNo || undefined}
          vendorPhone={cc.selectedVendorPhone || undefined}
          totalAmount={winningQuote?.total}
          subtotal={winningQuote?.subtotal}
          taxRate={winningQuote?.taxRate}
          freight={winningQuote?.freight}
          paymentTerms={winningQuote?.paymentTerms}
          deliveryDays={winningQuote?.deliveryDays}
          items={winningQuote?.items}
        />
      )}
    </div>
  );
}

