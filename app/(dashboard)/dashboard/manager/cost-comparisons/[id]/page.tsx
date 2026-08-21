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
import { CCApproveModal } from "@/components/document/cc-approve-modal";
import { ActionModal, type ActionType } from "@/components/document/action-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  History,
  Building2,
  FileText,
} from "lucide-react";

export default function ManagerCCDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useSession();
  const id = params?.id as Id<"cost_comparison">;

  const cc = useQuery(
    api.cost_comparisons.getCC,
    id && token ? { id, token } : "skip"
  );

  const approveCCMutation = useMutation(api.cost_comparisons.approveCC);
  const rejectCCMutation = useMutation(api.cost_comparisons.rejectCC);
  const queryCCMutation = useMutation(api.cost_comparisons.queryCC);

  const [isApproveModalOpen, setIsApproveModalOpen] = React.useState(false);
  const [selectedVendorForApproval, setSelectedVendorForApproval] = React.useState<string>("");
  const [activeModalAction, setActiveModalAction] = React.useState<ActionType | null>(null);
  const [isActionLoading, setIsActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  if (cc === undefined) {
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
          The requested document could not be found or you do not have permission to view it.
        </p>
        <Link href="/dashboard/manager/cost-comparisons">
          <Button variant="outline" size="sm" className="text-xs">
            Back to Approvals
          </Button>
        </Link>
      </div>
    );
  }

  const isSubmitted = cc.status === "submitted";

  const handleVendorCardSelect = (vendorId: string) => {
    if (!isSubmitted) return;
    setSelectedVendorForApproval(vendorId);
    setIsApproveModalOpen(true);
  };

  const handleApproveConfirm = async (
    selectedVendorId: string,
    selectionJustification?: string,
    note?: string
  ) => {
    setActionError(null);
    setIsActionLoading(true);

    try {
      await approveCCMutation({
        id,
        selectedVendorId: selectedVendorId as Id<"vendors">,
        selectionJustification,
        note,
        token: token || undefined,
      });
      setIsApproveModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || "Failed to approve cost comparison.");
      throw err;
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleActionConfirm = async (note?: string) => {
    setActionError(null);
    setIsActionLoading(true);

    try {
      if (activeModalAction === "reject") {
        if (!note) throw new Error("Rejection reason note is required.");
        await rejectCCMutation({ id, note, token: token || undefined });
      } else if (activeModalAction === "query") {
        if (!note) throw new Error("Query clarification note is required.");
        await queryCCMutation({ id, note, token: token || undefined });
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to execute action.");
      throw err;
    } finally {
      setIsActionLoading(false);
    }
  };

  const quoteOptions = (cc.vendorQuotes || []).map((q: any) => ({
    vendorId: q.vendorId,
    vendorName: q.vendorName,
    total: q.total,
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/dashboard/manager/cost-comparisons"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Approval Queue
        </Link>

        {/* Action Buttons for Submitted status */}
        {isSubmitted && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveModalAction("query")}
              className="gap-1.5 text-xs font-semibold text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 border-amber-500/30"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Query
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveModalAction("reject")}
              className="gap-1.5 text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedVendorForApproval(cc.selectedVendorId || "");
                setIsApproveModalOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve & Select Vendor
            </Button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {actionError}
        </div>
      )}

      {/* ── Document Lineage / Traceability Stepper ── */}
      <DocumentLineageBar
        currentType="cc"
        mr={cc.materialRequest ? { id: cc.materialRequest._id, refNo: cc.materialRequest.refNo, status: cc.materialRequest.status } : undefined}
        cc={{ id: cc._id, refNo: cc.refNo, status: cc.status }}
        userRole="project_manager"
      />

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
                    href={`/dashboard/manager/material-requests/${cc.materialRequest._id}`}
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
                Prepared By (Procurement)
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
                  <span className="text-amber-500 font-medium">Pending Manager Selection</span>
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

          {/* ── Interactive Vendor Quotes Comparison Grid ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{isSubmitted ? "Click 'Select this Vendor' on any quote card to choose it for approval:" : "Comparison Breakdown:"}</span>
            </div>
            <CCComparisonView
              quotes={cc.vendorQuotes as any}
              selectedVendorId={cc.selectedVendorId}
              onSelectVendor={handleVendorCardSelect}
              isSelecting={isSubmitted}
            />
          </div>

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

      {/* ── Approval Modal with Vendor Selection ── */}
      {isApproveModalOpen && (
        <CCApproveModal
          isOpen={true}
          onClose={() => setIsApproveModalOpen(false)}
          ccRefNo={cc.refNo}
          vendorQuotes={quoteOptions}
          initialSelectedVendorId={selectedVendorForApproval || cc.selectedVendorId}
          onConfirm={handleApproveConfirm}
          isLoading={isActionLoading}
        />
      )}

      {/* ── Action Modal for Reject / Query ── */}
      {activeModalAction && (
        <ActionModal
          isOpen={true}
          onClose={() => setActiveModalAction(null)}
          actionType={activeModalAction}
          documentTitle={`Cost Comparison ${cc.refNo}`}
          onConfirm={handleActionConfirm}
          isLoading={isActionLoading}
        />
      )}
    </div>
  );
}
