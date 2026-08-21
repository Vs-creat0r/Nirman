"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertTriangle, Building2 } from "lucide-react";

export interface CCQuoteOption {
  vendorId: string;
  vendorName: string;
  total: number;
}

interface CCApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  ccRefNo: string;
  vendorQuotes: CCQuoteOption[];
  initialSelectedVendorId?: string;
  onConfirm: (
    selectedVendorId: string,
    selectionJustification?: string,
    note?: string
  ) => Promise<void>;
  isLoading?: boolean;
}

export function CCApproveModal({
  isOpen,
  onClose,
  ccRefNo,
  vendorQuotes,
  initialSelectedVendorId,
  onConfirm,
  isLoading = false,
}: CCApproveModalProps) {
  // Find lowest total
  const minTotal =
    vendorQuotes.length > 0 ? Math.min(...vendorQuotes.map((q) => q.total)) : 0;
  const defaultLowestVendor = vendorQuotes.find((q) => q.total === minTotal)?.vendorId || "";

  const [selectedVendorId, setSelectedVendorId] = React.useState<string>(
    initialSelectedVendorId || defaultLowestVendor
  );
  const [justification, setJustification] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedVendorId(initialSelectedVendorId || defaultLowestVendor);
      setJustification("");
      setNote("");
      setError(null);
    }
  }, [isOpen, initialSelectedVendorId, defaultLowestVendor]);

  const selectedQuote = vendorQuotes.find((q) => q.vendorId === selectedVendorId);
  const isSelectedLowest = selectedQuote ? selectedQuote.total === minTotal : true;

  const handleConfirm = async () => {
    if (!selectedVendorId) {
      setError("Please select the winning vendor.");
      return;
    }

    if (!isSelectedLowest && !justification.trim()) {
      setError("A justification is required when selecting a quote that is not the lowest total.");
      return;
    }

    try {
      setError(null);
      await onConfirm(
        selectedVendorId,
        justification.trim() || undefined,
        note.trim() || undefined
      );
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to approve cost comparison.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Cost Comparison & Select Vendor</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Authorize {ccRefNo} and lock in the winning vendor quote to proceed to Purchase Order generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Vendor selection */}
          <div className="space-y-1.5">
            <Label htmlFor="selected-vendor" className="font-semibold text-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Winning Vendor <span className="text-destructive font-bold">*</span>
            </Label>
            <select
              id="selected-vendor"
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
            >
              <option value="">-- Choose Winning Vendor --</option>
              {vendorQuotes.map((q) => (
                <option key={q.vendorId} value={q.vendorId}>
                  {q.vendorName} — ₹{q.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  {q.total === minTotal ? " (Lowest Quote ★)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing feedback notice */}
          {selectedQuote && (
            <div>
              {isSelectedLowest ? (
                <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-[11px] font-semibold">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  Lowest quoted price selected (₹{selectedQuote.total.toLocaleString("en-IN")})
                </div>
              ) : (
                <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-1 text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    Higher-priced quote selected
                  </div>
                  <p className="text-muted-foreground">
                    Selected quote (₹{selectedQuote.total.toLocaleString("en-IN")}) is ₹
                    {(selectedQuote.total - minTotal).toLocaleString("en-IN")} higher than the lowest quote. A justification is required.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Justification input (required if not lowest) */}
          {!isSelectedLowest && (
            <div className="space-y-1.5">
              <Label htmlFor="selection-justification" className="font-semibold text-foreground">
                Selection Justification <span className="text-destructive font-bold">*</span>
              </Label>
              <textarea
                id="selection-justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain why this vendor was chosen (e.g. faster delivery, higher material grade, established reliability)…"
                rows={2}
                maxLength={500}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              />
            </div>
          )}

          {/* Approval Note (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="approval-note" className="font-semibold text-foreground">
              Approval Note (Optional)
            </Label>
            <textarea
              id="approval-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any internal instructions or approval comments…"
              rows={2}
              maxLength={500}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-semibold">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading}
            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLoading ? "Approving…" : "Approve & Lock Vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
