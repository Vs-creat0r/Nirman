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
import { DocumentFinancialSummary } from "@/components/document/document-financial-summary";
import { CCComparisonView, type EnrichedVendorQuote } from "@/components/document/cc-comparison-view";
import { DocumentActionModal,
  getActionVariant,
  type ActiveModalAction,
} from "@/components/document/document-action-modal";
import { DocumentPdfDownload } from "@/components/document/document-pdf-download";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { RFQ_STATUS_BADGES } from "@/lib/lifecycle/rfq";
import type { FieldDef, OptionsMap } from "@/lib/form-engine-types";

export type DocumentType =
  | "material_request"
  | "cost_comparison"
  | "purchase_order"
  | "rfq"
  | "delivery_challan"
  | "grn";

const BADGE_REGISTRY = {
  material_request: MATERIAL_REQUEST_STATUS_BADGES,
  cost_comparison: COST_COMPARISON_STATUS_BADGES,
  purchase_order: PURCHASE_ORDER_STATUS_BADGES,
  rfq: RFQ_STATUS_BADGES,
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
  selectedVendorId?: string;
  vendorQuotes?: EnrichedVendorQuote[] | unknown[];
  notes?: string;
  procurementNotes?: string;
  paymentTerms?: string;
  expectedDelivery?: string;
  validUntil?: string;
  placeOfSupplyStateCode?: string;
  freight?: number;
  taxRate?: number;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  estimatedTotal?: number;
  termsAndConditions?: string;
  reviewerName?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
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
  backLabel?: string;
  editHref?: string;
  onAction?: (actionName: string, note?: string) => Promise<void>;
  onSelectVendor?: (vendorId: string) => void;
  isSelecting?: boolean;
  userRole?: string;
  optionsMap?: OptionsMap;
  renderCustomField?: (field: FieldDef, doc: DocumentViewDoc) => React.ReactNode;
  headerExtras?: React.ReactNode;
  children?: React.ReactNode;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  submit: <Send className="h-3.5 w-3.5" />,
  resubmit: <Send className="h-3.5 w-3.5" />,
  send: <Send className="h-3.5 w-3.5" />,
  issue: <Send className="h-3.5 w-3.5" />,
  approve: <CheckCircle2 className="h-3.5 w-3.5" />,
  accept: <CheckCircle2 className="h-3.5 w-3.5" />,
  reject: <XCircle className="h-3.5 w-3.5" />,
  query: <HelpCircle className="h-3.5 w-3.5" />,
  cancel: <AlertTriangle className="h-3.5 w-3.5" />,
  short_close: <AlertTriangle className="h-3.5 w-3.5" />,
  close: <CheckCircle2 className="h-3.5 w-3.5" />,
  archive: <XCircle className="h-3.5 w-3.5" />,
};

function getActionIcon(name: string): React.ReactNode {
  return ACTION_ICONS[name] ?? <CheckCircle2 className="h-3.5 w-3.5" />;
}

/**
 * Universal Document Detail View Shell (DocumentView).
 */
export function DocumentView({
  docType,
  doc,
  fields,
  linkedDocs,
  backHref,
  backLabel = "Back",
  editHref,
  onAction,
  onSelectVendor,
  isSelecting = false,
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

  const [activeModalAction, setActiveModalAction] = React.useState<ActiveModalAction | null>(null);
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

  const handleModalConfirm = async (actionName: string, note?: string) => {
    if (!onAction) return;
    setIsExecutingAction(true);
    setActionError(null);
    try {
      await onAction(actionName, note);
      setActiveModalAction(null);
    } catch (err: unknown) {
      setActionError((err as Error).message || "Action failed.");
    } finally {
      setIsExecutingAction(false);
    }
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
          <DocumentPdfDownload docType={docType} docId={doc._id} refNo={doc.refNo} />
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
          currentType={
            docType === "material_request"
              ? "mr"
              : docType === "cost_comparison"
              ? "cc"
              : docType === "purchase_order"
              ? "po"
              : docType === "grn"
              ? "grn"
              : "dc"
          }
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
                  {doc.projectName}
                  {doc.siteName ? ` • ${doc.siteName}` : ""}
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
                <div>
                  Priority: <span className="font-bold capitalize text-foreground">{doc.priority}</span>
                </div>
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
                <span className="font-semibold text-foreground font-mono">
                  State {doc.placeOfSupplyStateCode}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground block text-[11px]">Total Line Items</span>
              <span className="font-semibold text-foreground font-mono">{lineItems.length}</span>
            </div>
          </div>

          {/* Vendor Quotes Comparison for Cost Comparisons */}
          {Array.isArray(doc.vendorQuotes) && doc.vendorQuotes.length > 0 && (
            <CCComparisonView
              quotes={doc.vendorQuotes as EnrichedVendorQuote[]}
              selectedVendorId={doc.selectedVendorId as string | undefined}
              onSelectVendor={onSelectVendor}
              isSelecting={isSelecting}
            />
          )}

          {fields &&
            fields.map((field) =>
              renderCustomField ? <div key={field.field}>{renderCustomField(field, doc)}</div> : null
            )}

          <DocumentItemsTable items={lineItems} />

          {/* Financial Totals & Terms */}
          <DocumentFinancialSummary doc={doc} />

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

      <DocumentActionModal
        activeAction={activeModalAction}
        refNo={doc.refNo}
        onClose={() => setActiveModalAction(null)}
        onConfirm={handleModalConfirm}
        isExecuting={isExecutingAction}
        actionError={actionError}
      />
    </div>
  );
}
