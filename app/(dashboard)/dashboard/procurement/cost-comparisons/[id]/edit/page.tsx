"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import {
  CCVendorQuotePanel,
  CCVendorQuoteData,
} from "@/components/document/cc-vendor-quote-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Plus,
  Send,
  AlertTriangle,
  FileText,
  Trash2,
} from "lucide-react";

export default function EditQueriedCostComparisonPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useSession();
  const id = params?.id as Id<"cost_comparison">;

  const cc = useQuery(
    api.cost_comparisons.getCC,
    id && token ? { id, token } : "skip"
  );
  const vendors = useQuery(
    api.vendors.listVendors,
    token ? { token } : "skip"
  );

  const resubmitCCMutation = useMutation(api.cost_comparisons.resubmitCC);
  const deleteCCMutation = useMutation(api.cost_comparisons.deleteCC);

  const [quotes, setQuotes] = React.useState<CCVendorQuoteData[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDiscarding, setIsDiscarding] = React.useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isDraft = cc?.status === "draft";

  const handleDiscardDraft = async () => {
    setError(null);
    setIsDiscarding(true);
    try {
      await deleteCCMutation({ id, token: token || undefined });
      router.push("/dashboard/procurement/cost-comparisons");
    } catch (err: any) {
      setError(err.message || "Failed to discard draft cost comparison.");
      setIsDiscarding(false);
      setShowDiscardConfirm(false);
    }
  };

  // Prepopulate form once CC loads
  React.useEffect(() => {
    if (cc && cc.vendorQuotes && quotes.length === 0) {
      setQuotes(
        cc.vendorQuotes.map((q: any) => ({
          vendorId: q.vendorId,
          items: q.items.map((it: any) => ({
            itemName: it.itemName,
            quantity: Number(it.quantity) || 1,
            unit: it.unit || "bags",
            rate: Number(it.rate) || 0,
            amount: Number(it.amount) || 0,
            projectItemId: it.projectItemId || undefined,
          })),
          subtotal: Number(q.subtotal) || 0,
          taxRate: q.taxRate !== undefined && !isNaN(Number(q.taxRate)) ? Number(q.taxRate) : 18,
          taxAmount: Number(q.taxAmount) || 0,
          freight: Number(q.freight) || 0,
          total: Number(q.total) || 0,
          deliveryDays: q.deliveryDays,
          paymentTerms: q.paymentTerms || "30_days",
          notes: q.notes || "",
        }))
      );
    }
  }, [cc]);

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
      <div className="p-12 text-center text-xs text-muted-foreground">
        Cost Comparison not found.
      </div>
    );
  }

  const handleAddVendorQuote = () => {
    if (quotes.length === 0) return;
    const baseItems = quotes[0].items.map((it) => ({
      itemName: it.itemName,
      quantity: it.quantity,
      unit: it.unit,
      rate: 0,
      amount: 0,
    }));

    setQuotes((prev) => [
      ...prev,
      {
        vendorId: "",
        items: baseItems,
        subtotal: 0,
        taxRate: 18,
        taxAmount: 0,
        freight: 0,
        total: 0,
        paymentTerms: "30_days",
      },
    ]);
  };

  const handleUpdateQuote = (index: number, updated: CCVendorQuoteData) => {
    setQuotes((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const handleRemoveQuote = (index: number) => {
    if (quotes.length <= 2) return;
    setQuotes((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (quotes.length < 2) {
        throw new Error("A minimum of 2 vendor quotes is required.");
      }

      for (let i = 0; i < quotes.length; i++) {
        if (!quotes[i].vendorId) {
          throw new Error(`Please select a vendor for Quote #${i + 1}.`);
        }
        for (const item of quotes[i].items) {
          if ((item.rate ?? -1) <= 0) {
            throw new Error(
              `Please enter a rate greater than 0 for "${item.itemName}" in Quote #${i + 1}.`
            );
          }
        }
      }

      const vendorIds = quotes.map((q) => q.vendorId);
      if (new Set(vendorIds).size !== vendorIds.length) {
        throw new Error("All participating vendor quotes must be from distinct vendors.");
      }

      await resubmitCCMutation({
        id,
        vendorQuotes: quotes.map((q) => ({
          vendorId: q.vendorId as Id<"vendors">,
          items: q.items.map((it) => ({
            itemName: it.itemName,
            quantity: Number(it.quantity),
            unit: it.unit,
            rate: Number(it.rate),
            projectItemId: it.projectItemId || undefined,
          })),
          taxRate: Number(q.taxRate),
          freight: q.freight ? Number(q.freight) : undefined,
          deliveryDays: q.deliveryDays ? Number(q.deliveryDays) : undefined,
          paymentTerms: q.paymentTerms || undefined,
          notes: q.notes?.trim() || undefined,
        })),
        token: token || undefined,
      });

      router.push(`/dashboard/procurement/cost-comparisons/${id}`);
    } catch (err: any) {
      setError(err.message || "Failed to resubmit cost comparison.");
      setIsSubmitting(false);
    }
  };

  const usedVendorIds = quotes.map((q) => q.vendorId).filter(Boolean);
  const minTotal =
    quotes.length > 0 && quotes.some((q) => q.total > 0)
      ? Math.min(...quotes.filter((q) => q.total > 0).map((q) => q.total))
      : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <Link
            href={`/dashboard/procurement/cost-comparisons/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cancel & Back
          </Link>
          <h1 className="text-xl font-bold text-foreground">
            {isDraft ? `Edit Cost Comparison — ${cc.refNo}` : `Edit & Resubmit ${cc.refNo}`}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isDraft
              ? "Review and adjust participating vendor quotations before submitting for approval."
              : "Revise vendor quotations and commercial terms as requested by the Project Manager."}
          </p>
        </div>
      </div>

      {/* Reviewer Query Note */}
      {cc.reviewNote && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-amber-500">
              Manager Feedback / Query Note
            </h3>
            <p className="text-xs text-foreground">
              {cc.reviewNote}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Quote Panels */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">
            Vendor Quotations ({quotes.length})
          </h2>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddVendorQuote}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Another Vendor Quote
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quotes.map((quote, idx) => (
            <CCVendorQuotePanel
              key={idx}
              index={idx}
              quote={quote}
              vendors={vendors || []}
              usedVendorIds={usedVendorIds}
              onChange={(updated) => handleUpdateQuote(idx, updated)}
              onRemove={() => handleRemoveQuote(idx)}
              canRemove={quotes.length > 2}
              isLowest={minTotal > 0 && quote.total === minTotal}
            />
          ))}
        </div>

        {/* Submit / Action Card */}
        <Card className="border-border bg-surface shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-start">
              {isDraft && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting || isDiscarding}
                  onClick={() => setShowDiscardConfirm(true)}
                  className="text-destructive hover:bg-destructive/10 text-xs gap-1.5 px-3"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Discard draft
                </Button>
              )}

              <div className="text-xs space-y-0.5">
                <span className="text-muted-foreground">Revised Lowest Total:</span>
                <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  ₹{minTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Link href={`/dashboard/procurement/cost-comparisons/${id}`}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting || isDiscarding}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </Link>

              <Button
                type="button"
                size="sm"
                disabled={isSubmitting || isDiscarding}
                onClick={handleSubmit}
                className="gap-1.5 text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmitting
                  ? "Submitting…"
                  : isDraft
                  ? "Submit for Manager Review"
                  : "Resubmit for Manager Review"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discard Confirmation Dialog */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">
                Discard {cc.refNo}?
              </h3>
              <p className="text-xs text-muted-foreground">
                This draft and its {quotes.length} vendor quotes will be permanently deleted. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDiscarding}
                onClick={() => setShowDiscardConfirm(false)}
                className="text-xs"
              >
                Keep editing
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isDiscarding}
                onClick={handleDiscardDraft}
                className="text-xs font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
              >
                {isDiscarding ? "Discarding…" : `Discard ${cc.refNo}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
