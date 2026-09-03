"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Plus,
  Send,
  Save,
  AlertTriangle,
  Building2,
  Calendar,
  FileText,
} from "lucide-react";

function NewCostComparisonForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useSession();

  const urlMrId = searchParams.get("mrId") as Id<"material_request"> | null;
  const [selectedMrId, setSelectedMrId] = React.useState<Id<"material_request"> | "">(
    urlMrId || ""
  );


  // Queries
  const readyMRs = useQuery(
    api.cost_comparisons.listApprovedMRsForCC,
    token ? { token } : "skip"
  );
  const currentMR = useQuery(
    api.material_requests.getMR,
    selectedMrId && token ? { id: selectedMrId as Id<"material_request">, token } : "skip"
  );
  const vendors = useQuery(
    api.vendors.listVendors,
    token ? { token } : "skip"
  );

  const createCCMutation = useMutation(api.cost_comparisons.createCC);

  // Multi-vendor quote state
  const [quotes, setQuotes] = React.useState<CCVendorQuoteData[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize or re-populate quotes when MR items load
  React.useEffect(() => {
    if (currentMR && currentMR.items && currentMR.items.length > 0) {
      const initialItems = currentMR.items.map((it: any) => ({
        itemName: it.itemName,
        quantity: Number(it.quantity) || 1,
        unit: it.unit || "bags",
        rate: undefined,
        amount: 0,
      }));

      setQuotes((prev) => {
        // If we already had quotes with selected vendors, preserve vendor metadata
        if (prev.length >= 2) {
          return prev.map((q) => {
            const updatedItems = initialItems.map((newItem) => {
              const existingItem = q.items.find((it) => it.itemName === newItem.itemName);
              const rate = existingItem?.rate ?? undefined;
              return {
                ...newItem,
                rate,
                amount: rate !== undefined ? Math.round(newItem.quantity * rate * 100) / 100 : 0,
              };
            });
            const subtotal = Math.round(
              updatedItems.reduce((acc, cur) => acc + (cur.amount || 0), 0) * 100
            ) / 100;
            const taxAmount = Math.round(subtotal * (q.taxRate / 100) * 100) / 100;
            const freight = Number(q.freight) || 0;
            return {
              ...q,
              items: updatedItems,
              subtotal,
              taxAmount,
              total: Math.round((subtotal + taxAmount + freight) * 100) / 100,
            };
          });
        }

        // Initialize with 2 empty vendor quotes
        return [
          {
            vendorId: "",
            items: initialItems.map((it) => ({ ...it })),
            subtotal: 0,
            taxRate: 18,
            taxAmount: 0,
            freight: 0,
            total: 0,
            paymentTerms: "30_days",
          },
          {
            vendorId: "",
            items: initialItems.map((it) => ({ ...it })),
            subtotal: 0,
            taxRate: 18,
            taxAmount: 0,
            freight: 0,
            total: 0,
            paymentTerms: "30_days",
          },
        ];
      });
    }
  }, [currentMR?._id]);

  const handleAddVendorQuote = () => {
    if (!currentMR || !currentMR.items) return;
    const initialItems = currentMR.items.map((it: any) => ({
      itemName: it.itemName,
      quantity: Number(it.quantity) || 1,
      unit: it.unit || "bags",
      rate: undefined as unknown as number,
      amount: 0,
    }));

    setQuotes((prev) => [
      ...prev,
      {
        vendorId: "",
        items: initialItems,
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

  const handleSubmit = async (submitImmediately: boolean) => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (!selectedMrId) {
        throw new Error("Please select a Material Request to create the Cost Comparison for.");
      }

      if (quotes.length < 2) {
        throw new Error("A minimum of 2 vendor quotes is required.");
      }

      // Check vendor selection
      for (let i = 0; i < quotes.length; i++) {
        if (!quotes[i].vendorId) {
          throw new Error(`Please select a vendor for Quote #${i + 1}.`);
        }
      }

      // Check distinct vendors
      const vendorIds = quotes.map((q) => q.vendorId);
      if (new Set(vendorIds).size !== vendorIds.length) {
        throw new Error("All participating vendor quotes must be from distinct vendors.");
      }

      // Check rates
      for (let i = 0; i < quotes.length; i++) {
        for (const item of quotes[i].items) {
          const r = item.rate ?? -1;
          if (r < 0 || isNaN(r)) {
            throw new Error(
              `Please enter a valid non-negative rate for "${item.itemName}" in Quote #${i + 1}.`
            );
          }
        }
      }

      const payload = {
        materialRequestId: selectedMrId as Id<"material_request">,
        vendorQuotes: quotes.map((q) => ({
          vendorId: q.vendorId as Id<"vendors">,
          items: q.items.map((it) => ({
            itemName: it.itemName,
            quantity: Number(it.quantity),
            unit: it.unit,
            rate: Number(it.rate),
          })),
          taxRate: Number(q.taxRate),
          freight: q.freight ? Number(q.freight) : undefined,
          deliveryDays: q.deliveryDays ? Number(q.deliveryDays) : undefined,
          paymentTerms: q.paymentTerms || undefined,
          notes: q.notes?.trim() || undefined,
        })),
        submitImmediately,
        token: token || undefined,
      };

      const result = await createCCMutation(payload);
      router.push(`/dashboard/procurement/cost-comparisons/${result.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create cost comparison.");
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
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <Link
            href="/dashboard/procurement/cost-comparisons"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Cost Comparisons
          </Link>
          <h1 className="text-xl font-bold text-foreground">
            New Cost Comparison (CC)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare quotes from at least 2 vendors for an approved Material Request.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {error}
        </div>
      )}

      {/* ── STEP 1: Select Material Request ── */}
      <Card>
        <CardHeader className="py-3 px-4 border-b border-border bg-muted/30">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
            Step 1: Source Material Request
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Select Approved Material Request <span className="text-destructive">*</span>
            </Label>
            <select
              value={selectedMrId}
              onChange={(e) => setSelectedMrId(e.target.value as any)}
              className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">-- Choose Approved Material Request --</option>
              {(readyMRs || []).map((mr) => (
                <option key={mr._id} value={mr._id}>
                  {mr.refNo} &bull; {mr.projectName} ({mr.siteName}) &bull; {mr.itemCount} items ({mr.priority} priority)
                </option>
              ))}
            </select>
          </div>

          {/* MR Summary Context */}
          {currentMR && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-muted/40 border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Project & Site</span>
                <span className="font-semibold text-foreground">
                  {currentMR.projectName} &bull; {currentMR.siteName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Required By Date</span>
                <span className="font-semibold text-foreground font-mono">
                  {currentMR.requiredBy || "As soon as possible"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Requested Items</span>
                <span className="font-semibold text-foreground font-mono">
                  {currentMR.items.length} line items
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── STEP 2: Vendor Quotes Panels ── */}
      {selectedMrId && currentMR && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Step 2: Enter Vendor Quotations
              </h2>
              <p className="text-xs text-muted-foreground">
                Enter quotes from at least 2 distinct vendors. Totals are calculated live.
              </p>
            </div>

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

          {/* Quote Panels Grid */}
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

          {/* ── Summary & Actions ── */}
          <Card className="border-border bg-surface">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs space-y-0.5">
                <span className="text-muted-foreground">Comparison Summary:</span>
                <div className="font-semibold text-foreground">
                  {quotes.length} Vendor Quotes &bull; Lowest Quoted Total:{" "}
                  <span className="font-mono text-[--success] font-bold">
                    ₹{minTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save as Draft
                </Button>

                <Button
                  type="button"
                  size="md"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSubmitting ? "Submitting…" : "Submit for Manager Review"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function NewCostComparisonPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading Form…</span>
        </div>
      }
    >
      <NewCostComparisonForm />
    </React.Suspense>
  );
}

