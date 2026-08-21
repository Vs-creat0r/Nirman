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
  Clock,
  FileText,
  Send,
  AlertTriangle,
  CheckCircle2,
  User,
  History,
} from "lucide-react";

export default function MaterialRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useSession();
  const id = params?.id as Id<"material_request">;

  const mr = useQuery(
    api.material_requests.getMR,
    id && token ? { id, token } : "skip"
  );
  const submitMRMutation = useMutation(api.material_requests.submitMR);

  const [isActionLoading, setIsActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (mr === undefined) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading Material Request…</span>
      </div>
    );
  }

  if (mr === null) {
    return (
      <div className="p-12 text-center space-y-3">
        <h2 className="text-base font-bold text-foreground">
          Material Request Not Found
        </h2>
        <p className="text-xs text-muted-foreground">
          The requested document could not be found or you do not have permission to view it.
        </p>
        <Link href="/dashboard/supervisor/material-requests">
          <Button variant="outline" size="sm" className="text-xs">
            Back to Requests
          </Button>
        </Link>
      </div>
    );
  }

  const handleSubmitDraft = async () => {
    setError(null);
    setIsActionLoading(true);
    try {
      await submitMRMutation({ id, token: token || undefined });
    } catch (err: any) {
      setError(err.message || "Failed to submit material request.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const isDraft = mr.status === "draft";
  const isQueried = mr.status === "queried";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Nav Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/supervisor/material-requests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Material Requests
        </Link>

        {/* Action Button for Draft status */}
        {isDraft && (
          <Button
            size="sm"
            onClick={handleSubmitDraft}
            disabled={isActionLoading}
            className="gap-1.5 text-xs font-semibold"
          >
            <Send className="h-3.5 w-3.5" />
            {isActionLoading ? "Submitting…" : "Submit for Approval"}
          </Button>
        )}

        {/* Action Button for Queried status */}
        {isQueried && (
          <Link href={`/dashboard/supervisor/material-requests/${id}/edit`}>
            <Button
              size="sm"
              className="gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Edit & Resubmit
            </Button>
          </Link>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {error}
        </div>
      )}

      {/* ── Document Lineage / Traceability Stepper ── */}
      <DocumentLineageBar
        currentType="mr"
        mr={{ id: mr._id, refNo: mr.refNo, status: mr.status }}
        userRole="site_supervisor"
      />


      {/* Main Document Summary Card */}
      <Card>

        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-base font-bold text-foreground">
                  {mr.refNo}
                </span>
                <StatusBadge status={mr.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {mr.projectName} &bull; {mr.siteName}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {new Date(mr._creationTime).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div>
                Priority:{" "}
                <span className="font-bold capitalize text-foreground">
                  {mr.priority}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 rounded-md bg-muted/30 border border-border text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Raised By
              </span>
              <span className="font-semibold text-foreground">
                {mr.creatorName}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Required By
              </span>
              <span className="font-semibold text-foreground">
                {mr.requiredBy || "Not specified"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Total Line Items
              </span>
              <span className="font-semibold text-foreground font-mono">
                {mr.items.length}
              </span>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Requested Material Items
            </h3>
            <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3 w-28">HSN/SAC Code</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 w-24 text-right">Quantity</th>
                    <th className="py-2.5 px-3 w-24">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mr.items.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {item.itemName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">
                        {item.hsnSacCode || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {item.description || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {item.unit}
                      </td>
                    </tr>
                  ))}

                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {mr.notes && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-foreground">
                Supervisor Notes
              </h3>
              <p className="text-xs text-muted-foreground p-3 rounded-md bg-muted/30 border border-border">
                {mr.notes}
              </p>
            </div>
          )}

          {/* Audit Log Timeline */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Audit Trail & History
              </h3>
            </div>

            <div className="space-y-2.5">
              {mr.logs && mr.logs.length > 0 ? (
                mr.logs.map((log: any, idx: number) => (
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
                            ({log.actorRole.replace("_", " ")})
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
                        Action: <span className="font-medium text-foreground">{log.action.replace(/_/g, " ")}</span>
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
