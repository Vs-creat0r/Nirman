"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { DocumentLineageBar } from "@/components/document/document-lineage-bar";
import { StatusBadge } from "@/components/document/status-badge";
import { DocumentItemsTable } from "@/components/document/document-items-table";
import { DocumentAuditTrail } from "@/components/document/document-audit-trail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Calendar,
  Pencil,
  Send,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import { MATERIAL_REQUEST_STATUS_BADGES } from "@/lib/lifecycle/material_request";
import { COST_COMPARISON_STATUS_BADGES } from "@/lib/lifecycle/cost_comparison";
import { PURCHASE_ORDER_STATUS_BADGES } from "@/lib/lifecycle/purchase_order";
import type { FieldDef, OptionsMap } from "@/lib/form-engine-types";

export type DocumentType = "material_request" | "cost_comparison" | "purchase_order";

const BADGE_REGISTRY = {
  material_request: MATERIAL_REQUEST_STATUS_BADGES,
  cost_comparison: COST_COMPARISON_STATUS_BADGES,
  purchase_order: PURCHASE_ORDER_STATUS_BADGES,
} as const;

export interface LineItem {
  itemName: string;
  description?: string;
  hsnSacCode?: string;
  quantity: number;
  unit: string;
  rate?: number;
  taxPct?: number;
  amount?: number;
  projectItemId?: string;
  isUnquotedAddition?: boolean;
  additionReason?: string;
}

export interface AuditLogEntry {
  actorName: string;
  actorRole: string;
  action: string;
  toStatus?: string;
  note?: string;
  timestamp: string | number;
}

export interface DocumentViewDoc {
  _id: string;
  _creationTime: number;
  refNo: string;
  status: string;
  projectName?: string;
  siteName?: string;
  creatorName?: string;
  createdBy?: string;
  priority?: string;
  requiredBy?: string;
  vendorName?: string;
  vendorId?: string;
  notes?: string;
  procurementNotes?: string;
  paymentTerms?: string;
  expectedDelivery?: string;
  validUntil?: string;
  placeOfSupplyStateCode?: string;
  freight?: number;
  taxRate?: number;
  totalAmount?: number;
  estimatedTotal?: number;
  items?: LineItem[];
  lineItems?: LineItem[];
  logs?: AuditLogEntry[];
  attachments?: { name: string; url: string; size?: string }[];
  [key: string]: unknown;
}

export interface DocumentViewProps {
  docType: DocumentType;
  doc: DocumentViewDoc;
  fields?: FieldDef[];
  linkedDocs?: {
    mr?: { id: string; refNo: string; status: string; role?: string };
    cc?: { id: string; refNo: string; status: string; role?: string };
    po?: { id: string; refNo: string; status: string; role?: string };
    dc?: { id: string; refNo: string; status: string; role?: string };
    grn?: { id: string; refNo: string; status: string; role?: string };
  };
  backHref: string;
  backLabel: string;
  editHref?: string;
  onAction?: (actionName: string, note?: string) => Promise<void>;
  userRole?: string;
  optionsMap?: OptionsMap;
  renderCustomField?: (field: FieldDef, doc: DocumentViewDoc) => React.ReactNode;
  headerExtras?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Universal Document Detail View Shell (DocumentView).
 * Read-view sibling component to DocumentForm for detail pages.
 */
export function DocumentView({
  docType,
  doc,
  fields,
  linkedDocs,
  backHref,
  backLabel,
  editHref,
  onAction,
  userRole = "procurement",
  renderCustomField,
  headerExtras,
  children,
}: DocumentViewProps) {
  const { token } = useSession();

  const availableActionsData = useQuery(
    api.lifecycle.availableActions,
    doc._id
      ? { table: docType, documentId: doc._id, token: token || undefined }
      : "skip"
  );

  const [activeModalAction, setActiveModalAction] = React.useState<{
    name: string;
    label: string;
    requiresNote: boolean;
  } | null>(null);
  const [modalNote, setModalNote] = React.useState("");
  const [isExecutingAction, setIsExecutingAction] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const lineItems = doc.items || doc.lineItems || [];

  const handleActionClick = async (action: {
    name: string;
    label: string;
    enabled: boolean;
    requiresNote: boolean;
  }) => {
    if (!action.enabled) return;
    setActionError(null);

    const needsModal =
      action.requiresNote ||
      action.name === "reject" ||
      action.name === "query" ||
      action.name === "cancel" ||
      action.name === "short_close";

    if (needsModal) {
      setModalNote("");
      setActiveModalAction({
        name: action.name,
        label: action.label,
        requiresNote: action.requiresNote,
      });
      return;
    }

    if (onAction) {
      setIsExecutingAction(true);
      try {
        await onAction(action.name);
      } catch (err: unknown) {
        setActionError((err as Error).message || `Failed to execute ${action.label}.`);
      } finally {
        setIsExecutingAction(false);
      }
    }
  };

  const handleModalConfirm = async () => {
    if (!activeModalAction || !onAction) return;
    if (activeModalAction.requiresNote && !modalNote.trim()) {
      setActionError("Please provide a note or reason for this action.");
      return;
    }

    setIsExecutingAction(true);
    setActionError(null);
    try {
      await onAction(activeModalAction.name, modalNote.trim() || undefined);
      setActiveModalAction(null);
      setModalNote("");
    } catch (err: unknown) {
      setActionError((err as Error).message || `Failed to execute ${activeModalAction.label}.`);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const getActionVariant = (name: string) => {
    if (name === "approve" || name === "accept") return "primary" as const;
    if (name === "reject" || name === "cancel") return "destructive" as const;
    if (name === "query") return "outline" as const;
    return "primary" as const;
  };

  const getActionIcon = (name: string) => {
    if (name === "submit" || name === "resubmit" || name === "send") return <Send className="h-3.5 w-3.5" />;
    if (name === "approve") return <CheckCircle2 className="h-3.5 w-3.5" />;
    if (name === "reject") return <XCircle className="h-3.5 w-3.5" />;
    if (name === "query") return <HelpCircle className="h-3.5 w-3.5" />;
    if (name === "cancel" || name === "short_close") return <AlertTriangle className="h-3.5 w-3.5" />;
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  };

  const actions = availableActionsData?.actions || [];
  const hasEditAction = actions.some((a) => a.name === "submit" || a.name === "resubmit");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {headerExtras}
          {editHref && hasEditAction && (
            <Link href={editHref}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs font-semibold">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </Link>
          )}

          {actions.map((action) => {
            const variant = getActionVariant(action.name);
            const isQueryAction = action.name === "query";
            const isApproveAction = action.name === "approve";

            let customClass = "gap-1.5 text-xs font-semibold";
            if (isQueryAction) {
              customClass += " text-[--warning] hover:text-[--warning] hover:bg-[--warning]/10 border-[--warning]/30";
            } else if (isApproveAction) {
              customClass += " bg-[--success] text-white hover:bg-[--success]/90";
            }

            return (
              <Button
                key={action.name}
                size="sm"
                variant={variant}
                onClick={() => handleActionClick(action)}
                disabled={!action.enabled || isExecutingAction}
                title={action.reason || undefined}
                className={customClass}
              >
                {getActionIcon(action.name)}
                {isExecutingAction ? "Processing…" : action.label}
              </Button>
            );
          })}
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-lg bg-[--destructive]/10 border border-[--destructive]/20 text-[--destructive] text-xs font-semibold">
          {actionError}
        </div>
      )}

      {linkedDocs && (
        <DocumentLineageBar
          currentType={docType === "material_request" ? "mr" : docType === "cost_comparison" ? "cc" : "po"}
          mr={linkedDocs.mr}
          cc={linkedDocs.cc}
          po={linkedDocs.po}
          dc={linkedDocs.dc}
          grn={linkedDocs.grn}
          userRole={userRole}
        />
      )}

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-base font-bold text-foreground">{doc.refNo}</span>
                <StatusBadge status={doc.status} />
              </div>
              {(doc.projectName || doc.siteName) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {doc.projectName}{doc.siteName ? ` • ${doc.siteName}` : ""}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {new Date(doc._creationTime).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              {doc.priority && (
                <div>Priority: <span className="font-bold capitalize text-foreground">{doc.priority}</span></div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 rounded-md bg-muted/30 border border-border text-xs">
            {doc.creatorName && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Raised By</span>
                <span className="font-semibold text-foreground">{doc.creatorName}</span>
              </div>
            )}
            {doc.requiredBy && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Required By</span>
                <span className="font-semibold text-foreground">{doc.requiredBy}</span>
              </div>
            )}
            {doc.vendorName && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Vendor</span>
                <span className="font-semibold text-foreground">{doc.vendorName}</span>
              </div>
            )}
            {doc.paymentTerms && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Payment Terms</span>
                <span className="font-semibold text-foreground">{doc.paymentTerms}</span>
              </div>
            )}
            {doc.expectedDelivery && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Expected Delivery</span>
                <span className="font-semibold text-foreground">{doc.expectedDelivery}</span>
              </div>
            )}
            {doc.placeOfSupplyStateCode && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Place of Supply</span>
                <span className="font-semibold text-foreground font-mono">State {doc.placeOfSupplyStateCode}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground block text-[11px]">Total Line Items</span>
              <span className="font-semibold text-foreground font-mono">{lineItems.length}</span>
            </div>
          </div>

          {fields &&
            fields.map((field) => (
              renderCustomField ? <div key={field.field}>{renderCustomField(field, doc)}</div> : null
            ))}

          <DocumentItemsTable items={lineItems} />

          {(doc.notes || doc.procurementNotes) && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-foreground">Document Notes & Instructions</h3>
              <p className="text-xs text-muted-foreground p-3 rounded-md bg-muted/30 border border-border whitespace-pre-wrap">
                {doc.notes || doc.procurementNotes}
              </p>
            </div>
          )}

          {children}

          <DocumentAuditTrail logs={doc.logs} />
        </CardContent>
      </Card>

      {activeModalAction && (
        <Dialog open={!!activeModalAction} onOpenChange={(open) => !open && setActiveModalAction(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{activeModalAction.label}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Confirm execution of {activeModalAction.label.toLowerCase()} on {doc.refNo}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="modal-action-note">
                  {activeModalAction.requiresNote ? "Reason / Clarification Note" : "Note (Optional)"}{" "}
                  {activeModalAction.requiresNote && <span className="text-[--destructive] font-bold">*</span>}
                </Label>
                <textarea
                  id="modal-action-note"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder={activeModalAction.requiresNote ? "Explain reason or clarification instructions (required)…" : "Add an optional note…"}
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                />
              </div>

              {actionError && (
                <div className="p-2 rounded bg-[--destructive]/10 border border-[--destructive]/20 text-[--destructive] text-[11px] font-semibold">
                  {actionError}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveModalAction(null)}
                disabled={isExecutingAction}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={getActionVariant(activeModalAction.name)}
                size="sm"
                onClick={handleModalConfirm}
                disabled={isExecutingAction}
                className="text-xs font-semibold"
              >
                {isExecutingAction ? "Submitting…" : activeModalAction.label}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
