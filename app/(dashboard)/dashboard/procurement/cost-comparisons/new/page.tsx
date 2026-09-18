"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { CCVendorQuotePanel, CCVendorQuoteData } from "@/components/document/cc-vendor-quote-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Send, Save, Sparkles, Info, Calendar, FileText, AlertTriangle } from "lucide-react";

interface MaterialRequestItem {
  itemName: string;
  description?: string;
  hsnSacCode?: string;
  quantity: number;
  unit: string;
  projectItemId?: Id<"project_items">;
}

function NewCostComparisonForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useSession();

  const urlMrId = searchParams.get("mrId") as Id<"material_request"> | null;
  const urlRfqId = searchParams.get("fromRfq") as Id<"rfq"> | null;
  const [selectedMrId, setSelectedMrId] = React.useState<Id<"material_request"> | "">(urlMrId || "");

  // Queries
  const readyMRs = useQuery(api.cost_comparisons.listApprovedMRsForCC, token ? { token } : "skip");
  const currentRfq = useQuery(api.rfqs.getRfq, urlRfqId && token ? { id: urlRfqId, token } : "skip");
  const currentMR = useQuery(
    api.material_requests.getMR,
    selectedMrId && token ? { id: selectedMrId as Id<"material_request">, token } : "skip"
  );
  const vendors = useQuery(api.vendors.listVendors, token ? { token } : "skip");

  // Mutations / Actions
  const createCCMutation = useMutation(api.cost_comparisons.createCC);
  const proposeAction = useAction(api.agent.propose.proposeCostComparison);

  // Form State
  const [quotes, setQuotes] = React.useState<CCVendorQuoteData[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDrafting, setIsDrafting] = React.useState(false);
  const [agentContext, setAgentContext] = React.useState<{
    proposalId?: string;
    provider?: string;
    model?: string;
    promptVersion?: string;
  } | null>(null);
  const [aiPlanSummary, setAiPlanSummary] = React.useState<string | null>(null);
  const [aiIncompleteReason, setAiIncompleteReason] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (currentRfq?.sourceMrId && !selectedMrId) {
      setSelectedMrId(currentRfq.sourceMrId);
    }
  }, [currentRfq, selectedMrId]);

  React.useEffect(() => {
    if (currentMR?.items && currentMR.items.length > 0 && !agentContext) {
      const initialItems = (currentMR.items as MaterialRequestItem[]).map((it) => ({
        itemName: it.itemName,
        description: it.description || undefined,
        hsnSacCode: it.hsnSacCode || undefined,
        quantity: Number(it.quantity) || 0,
        unit: it.unit || "bags",
        rate: undefined as unknown as number,
        amount: 0,
        projectItemId: it.projectItemId || undefined,
      }));

      setQuotes((prev) => {
        if (prev.length >= 2) {
          return prev.map((q) => {
            const updatedItems = initialItems.map((newItem) => {
              const existingItem = q.items.find((it) => it.itemName === newItem.itemName);
              const rate = existingItem?.rate ?? undefined;
              return {
                ...newItem,
                description: existingItem?.description ?? newItem.description,
                hsnSacCode: existingItem?.hsnSacCode ?? newItem.hsnSacCode,
                rate: rate as number,
                amount: rate !== undefined ? Math.round(newItem.quantity * rate * 100) / 100 : 0,
              };
            });
            const subtotal = Math.round(updatedItems.reduce((acc, cur) => acc + (cur.amount || 0), 0) * 100) / 100;
            const taxAmount = Math.round(subtotal * (q.taxRate / 100) * 100) / 100;
            const freight = Number(q.freight) || 0;
            return { ...q, items: updatedItems, subtotal, taxAmount, total: Math.round((subtotal + taxAmount + freight) * 100) / 100 };
          });
        }
        const makeEmptyQuote = (): CCVendorQuoteData => ({
          vendorId: "",
          items: initialItems.map((it) => ({ ...it })),
          subtotal: 0,
          taxRate: 18,
          taxAmount: 0,
          freight: 0,
          total: 0,
          paymentTerms: "30_days",
        });
        return [makeEmptyQuote(), makeEmptyQuote()];
      });
    }
  }, [currentMR?._id, agentContext]);

  const handleGenerateAIProposal = async () => {
    if (!selectedMrId) return;
    setError(null);
    setAiIncompleteReason(null);
    setIsDrafting(true);

    try {
      const result = await proposeAction({
        materialRequestId: selectedMrId as Id<"material_request">,
        token: token || undefined,
      });

      if (result.status === "incomplete") {
        setAiIncompleteReason(result.reason || result.planSummary || "Unable to draft proposal.");
      } else if (result.status === "proposed" && result.proposal) {
        setAiPlanSummary(result.planSummary);
        setAgentContext({
          proposalId: `prop_${Date.now()}`,
          provider: "gemini",
          model: "gemini-2.5-flash",
          promptVersion: "s6-v1",
        });

        const newQuotes: CCVendorQuoteData[] = result.proposal.vendorQuotes.map((q) => {
          const items = q.items.map((it) => {
            const qty = Number(it.quantity) || 1;
            const rate = Number(it.rate) || 0;
            return {
              itemName: it.itemName,
              description: it.description,
              hsnSacCode: it.hsnSacCode,
              quantity: qty,
              unit: it.unit,
              rate: it.rate,
              amount: Math.round(qty * rate * 100) / 100,
              projectItemId: it.projectItemId ? (it.projectItemId as Id<"project_items">) : undefined,
            };
          });
          const subtotal = Math.round(items.reduce((acc, cur) => acc + (cur.amount || 0), 0) * 100) / 100;
          const taxRate = Number(q.taxRate) || 18;
          const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
          const freight = Number(q.freight) || 0;
          return {
            vendorId: q.vendorId,
            items,
            subtotal,
            taxRate,
            taxAmount,
            freight,
            total: Math.round((subtotal + taxAmount + freight) * 100) / 100,
            deliveryDays: q.deliveryDays,
            paymentTerms: q.paymentTerms || "30_days",
            notes: q.notes,
          };
        });

        if (newQuotes.length >= 2) setQuotes(newQuotes);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate AI proposal.";
      setAiIncompleteReason(msg);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleAddVendorQuote = () => {
    if (!currentMR?.items) return;
    const initialItems = (currentMR.items as MaterialRequestItem[]).map((it) => ({
      itemName: it.itemName,
      quantity: Number(it.quantity) || 1,
      unit: it.unit || "bags",
      rate: undefined as unknown as number,
      amount: 0,
    }));
    setQuotes((prev) => [
      ...prev,
      { vendorId: "", items: initialItems, subtotal: 0, taxRate: 18, taxAmount: 0, freight: 0, total: 0, paymentTerms: "30_days" },
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
      if (!selectedMrId) throw new Error("Please select a Material Request.");
      if (quotes.length < 2) throw new Error("A minimum of 2 vendor quotes is required.");
      for (let i = 0; i < quotes.length; i++) {
        if (!quotes[i].vendorId) throw new Error(`Please select a vendor for Quote #${i + 1}.`);
      }

      const vendorIds = quotes.map((q) => q.vendorId);
      if (new Set(vendorIds).size !== vendorIds.length) {
        throw new Error("All participating vendor quotes must be from distinct vendors.");
      }

      for (let i = 0; i < quotes.length; i++) {
        for (const item of quotes[i].items) {
          const r = item.rate ?? -1;
          if (r < 0 || isNaN(r)) throw new Error(`Please enter a valid rate for "${item.itemName}" in Quote #${i + 1}.`);
        }
      }

      const payload = {
        materialRequestId: selectedMrId as Id<"material_request">,
        rfqId: urlRfqId || undefined,
        vendorQuotes: quotes.map((q) => ({
          vendorId: q.vendorId as Id<"vendors">,
          items: q.items.map((it) => ({
            itemName: it.itemName,
            description: it.description || undefined,
            hsnSacCode: it.hsnSacCode || undefined,
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
        agentContext: agentContext || undefined,
        submitImmediately,
        token: token || undefined,
      };

      const result = await createCCMutation(payload);
      router.push(`/dashboard/procurement/cost-comparisons/${result.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create cost comparison.";
      setError(msg);
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
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <Link
            href="/dashboard/procurement/cost-comparisons"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Cost Comparisons
          </Link>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Create Cost Comparison</h1>
          <p className="text-xs text-muted-foreground">
            Compare vendor quotes against approved Material Request BOQ requirements.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-md bg-[--danger]/10 border border-[--danger]/20 text-[--danger] text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1 */}
      <Card className="border-border bg-surface rounded-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Step 1: Select Approved Material Request</span>
            {selectedMrId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDrafting}
                onClick={handleGenerateAIProposal}
                className="gap-1.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isDrafting ? "Drafting Quotes…" : "Draft Quotes with AI"}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mr-select" className="text-xs font-medium text-foreground">
              Approved Material Request <span className="text-[--danger]">*</span>
            </Label>
            <select
              id="mr-select"
              value={selectedMrId}
              onChange={(e) => {
                setSelectedMrId(e.target.value as Id<"material_request">);
                setAgentContext(null);
                setAiPlanSummary(null);
                setAiIncompleteReason(null);
              }}
              disabled={!!urlMrId || !!urlRfqId}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              <option value="">-- Choose an approved MR ready for CC --</option>
              {readyMRs?.map((mr) => (
                <option key={mr._id} value={mr._id}>
                  {mr.refNo} — {mr.items.length} item(s) (Priority: {mr.priority || "medium"})
                </option>
              ))}
            </select>
          </div>

          {currentMR && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-md bg-muted/40 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Material Request</span>
                <span className="font-semibold text-foreground font-mono flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {currentMR.refNo}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Required By</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {currentMR.requiredBy ? new Date(currentMR.requiredBy).toLocaleDateString() : "Not specified"}
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

          {aiIncompleteReason && (
            <div className="p-3 rounded-md bg-[--warning]/10 border border-[--warning]/20 text-[--warning] text-xs flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">AI Assistant Notice:</span>
                <span>{aiIncompleteReason} Manual quote entry remains fully available below.</span>
              </div>
            </div>
          )}

          {aiPlanSummary && agentContext && (
            <div className="p-3.5 rounded-md bg-primary/5 border border-primary/20 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span>AI Proposal Draft Loaded</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  Review &amp; Edit Before Confirm
                </span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Vendor rates and quantities have been pre-filled based on past purchase history and active suppliers. You can freely edit quotation values below before confirming.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 */}
      {selectedMrId && currentMR && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Step 2: Enter Vendor Quotations</h2>
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

          <Card className="border-border bg-surface rounded-md">
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
                  {agentContext ? "Confirm & Create Draft" : "Save as Draft"}
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
