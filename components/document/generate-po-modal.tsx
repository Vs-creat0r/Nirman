"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";

interface GeneratePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  costComparisonId: Id<"cost_comparison">;
  costComparisonRefNo?: string;
  projectName?: string;
  siteName?: string;
  vendorName?: string;
  totalAmount?: number;
}

export function GeneratePOModal({
  isOpen,
  onClose,
  costComparisonId,
  costComparisonRefNo,
  projectName,
  siteName,
  vendorName,
  totalAmount,
}: GeneratePOModalProps) {
  const router = useRouter();
  const { token } = useSession();

  const createPOMutation = useMutation(api.purchase_orders.createPOFromCC);
  const templates = useQuery(api.tc_templates.listTCTemplates, token ? { token } : "skip");

  // Default validity date: 30 days from today
  const defaultValidDate = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  }, []);

  const [validUntil, setValidUntil] = React.useState(defaultValidDate);
  const [expectedDelivery, setExpectedDelivery] = React.useState("");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");
  const [termsAndConditions, setTermsAndConditions] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Auto-populate default T&C template when loaded
  React.useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplateId) {
      const defaultTpl = templates.find((t) => t.isDefault) || templates[0];
      if (defaultTpl) {
        setSelectedTemplateId(defaultTpl._id);
        setTermsAndConditions(defaultTpl.content);
      }
    }
  }, [templates, selectedTemplateId]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setTermsAndConditions("");
      return;
    }
    const tpl = templates?.find((t) => t._id === templateId);
    if (tpl) {
      setTermsAndConditions(tpl.content);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validUntil) {
      setError("Please select a PO validity date.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await createPOMutation({
        costComparisonId,
        validUntil,
        expectedDelivery: expectedDelivery || undefined,
        termsAndConditions: termsAndConditions.trim() || undefined,
        tcTemplateId: selectedTemplateId ? (selectedTemplateId as Id<"tc_templates">) : undefined,
        submitImmediately: false,
        token: token || undefined,
      });

      onClose();
      router.push(`/dashboard/procurement/purchase-orders/${result.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to generate Purchase Order.");
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Generate Purchase Order
              </h2>
              <p className="text-[11px] text-muted-foreground">
                From approved Cost Comparison: <span className="font-mono font-semibold">{costComparisonRefNo || "CC"}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* CC Summary Context Pill */}
        <div className="p-3.5 rounded-lg border border-border bg-muted/20 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Winning Vendor:</span>
            <span className="font-bold text-foreground">{vendorName || "Selected Vendor"}</span>
          </div>
          {totalAmount !== undefined && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Order Value:</span>
              <span className="font-bold text-foreground font-mono">
                ₹{totalAmount.toLocaleString("en-IN")}
              </span>
            </div>
          )}
          {(projectName || siteName) && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Project / Site:</span>
              <span className="font-medium text-foreground">
                {projectName} {siteName ? `• ${siteName}` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Validity Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                PO Validity (Valid Until) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="text-xs h-9"
              />
              <span className="text-[10px] text-muted-foreground block">
                Defaulted to 30 days from today.
              </span>
            </div>

            {/* Expected Delivery Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Expected Delivery Date
              </Label>
              <Input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="text-xs h-9"
              />
              <span className="text-[10px] text-muted-foreground block">
                Optional schedule agreed with vendor.
              </span>
            </div>
          </div>

          {/* Terms & Conditions Template Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Terms & Conditions Template
              </Label>
              {templates && templates.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {templates.length} templates available
                </span>
              )}
            </div>

            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">-- Custom Terms & Conditions (No Template) --</option>
              {templates?.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} {t.isDefault ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Terms & Conditions Textarea */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              PO Terms & Conditions Text
            </Label>
            <textarea
              rows={5}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Specify procurement clauses, quality inspection rules, return policies, and payment terms..."
              className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-sans leading-relaxed text-[11px]"
            />
            <span className="text-[10px] text-muted-foreground block">
              You can make one-off adjustments to the terms above before issuing this PO.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
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
              type="submit"
              size="sm"
              disabled={isLoading}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isLoading ? "Generating PO…" : "Generate Purchase Order"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
