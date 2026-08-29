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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  CreditCard,
  Layers,
  ChevronDown,
  ChevronUp,
  Truck,
  MapPin,
  Phone,
  User,
  Send,
  Building2,
  ShieldCheck,
} from "lucide-react";

const PAYMENT_TERMS_OPTIONS = [
  { value: "advance", label: "100% Advance" },
  { value: "on_delivery", label: "Payment on Delivery" },
  { value: "7_days", label: "Net 7 Days" },
  { value: "15_days", label: "Net 15 Days" },
  { value: "30_days", label: "Net 30 Days (Standard)" },
  { value: "45_days", label: "Net 45 Days" },
] as const;

type PaymentTermType = (typeof PAYMENT_TERMS_OPTIONS)[number]["value"];

const INDIAN_STATES = [
  { code: "27", name: "27 - Maharashtra" },
  { code: "24", name: "24 - Gujarat" },
  { code: "29", name: "29 - Karnataka" },
  { code: "07", name: "07 - Delhi" },
  { code: "33", name: "33 - Tamil Nadu" },
  { code: "36", name: "36 - Telangana" },
  { code: "19", name: "19 - West Bengal" },
  { code: "09", name: "09 - Uttar Pradesh" },
  { code: "08", name: "08 - Rajasthan" },
  { code: "23", name: "23 - Madhya Pradesh" },
  { code: "06", name: "06 - Haryana" },
  { code: "03", name: "03 - Punjab" },
  { code: "10", name: "10 - Bihar" },
  { code: "32", name: "32 - Kerala" },
  { code: "21", name: "21 - Odisha" },
  { code: "37", name: "37 - Andhra Pradesh" },
  { code: "22", name: "22 - Chhattisgarh" },
  { code: "20", name: "20 - Jharkhand" },
  { code: "30", name: "30 - Goa" },
  { code: "05", name: "05 - Uttarakhand" },
  { code: "02", name: "02 - Himachal Pradesh" },
  { code: "01", name: "01 - Jammu & Kashmir" },
  { code: "18", name: "18 - Assam" },
] as const;

interface GeneratePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  costComparisonId: Id<"cost_comparison">;
  costComparisonRefNo?: string;
  projectName?: string;
  siteName?: string;
  siteAddress?: string;
  vendorName?: string;
  vendorGstNo?: string;
  vendorPhone?: string;
  totalAmount?: number;
  subtotal?: number;
  taxRate?: number;
  freight?: number;
  paymentTerms?: string;
  deliveryDays?: number;
  items?: Array<{
    itemName: string;
    quantity: number;
    unit: string;
    rate: number;
    amount?: number;
    hsnSacCode?: string;
  }>;
}

export function GeneratePOModal({
  isOpen,
  onClose,
  costComparisonId,
  costComparisonRefNo,
  projectName,
  siteName,
  siteAddress,
  vendorName,
  vendorGstNo,
  vendorPhone,
  totalAmount,
  subtotal,
  taxRate: initialTaxRate,
  freight: initialFreight,
  paymentTerms: initialPaymentTerms,
  deliveryDays,
  items,
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

  // Default expected delivery date based on quoted deliveryDays
  const defaultExpectedDeliveryDate = React.useMemo(() => {
    if (deliveryDays && Number(deliveryDays) > 0) {
      const d = new Date();
      d.setDate(d.getDate() + Number(deliveryDays));
      return d.toISOString().split("T")[0];
    }
    return "";
  }, [deliveryDays]);

  const isRecognizedPaymentTerm = React.useMemo(() => {
    if (!initialPaymentTerms) return true;
    return PAYMENT_TERMS_OPTIONS.some((opt) => opt.value === initialPaymentTerms);
  }, [initialPaymentTerms]);

  // Form states
  const [validUntil, setValidUntil] = React.useState(defaultValidDate);
  const [expectedDelivery, setExpectedDelivery] = React.useState(defaultExpectedDeliveryDate);
  const [paymentTerms, setPaymentTerms] = React.useState<PaymentTermType>(
    isRecognizedPaymentTerm && initialPaymentTerms
      ? (initialPaymentTerms as PaymentTermType)
      : "30_days"
  );
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = React.useState("27"); // Default 27 - Maharashtra
  const [siteContactPerson, setSiteContactPerson] = React.useState("");
  const [siteContactPhone, setSiteContactPhone] = React.useState("");
  const [unloadingScope, setUnloadingScope] = React.useState<"buyer_scope" | "vendor_scope">("buyer_scope");
  const [freightTerms, setFreightTerms] = React.useState<
    "inclusive_in_rate" | "extra_at_actuals" | "fixed_freight" | "to_pay_by_site"
  >(Number(initialFreight) > 0 ? "fixed_freight" : "inclusive_in_rate");
  const [procurementNotes, setProcurementNotes] = React.useState("");

  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");
  const [termsAndConditions, setTermsAndConditions] = React.useState("");
  const [showItemPreview, setShowItemPreview] = React.useState(true); // Open by default for full transparency
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const defaultTpl = React.useMemo(() => {
    if (!templates || templates.length === 0) return null;
    return templates.find((t) => t.isDefault) || templates[0];
  }, [templates]);

  const activeTerms =
    termsAndConditions ||
    (selectedTemplateId
      ? templates?.find((t) => t._id === selectedTemplateId)?.content || ""
      : defaultTpl?.content || "");

  const handleTemplateChange = (templateId: string) => {
    if (
      termsAndConditions.trim() &&
      termsAndConditions !== (templates?.find((t) => t._id === selectedTemplateId)?.content || "")
    ) {
      const confirmOverwrite = window.confirm(
        "You have customized terms and conditions text. Switching templates will overwrite your edits. Do you want to proceed?"
      );
      if (!confirmOverwrite) return;
    }

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

  const handleGenerate = async (submitImmediately: boolean) => {
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
        paymentTerms,
        placeOfSupplyStateCode,
        siteContactPerson: siteContactPerson.trim() || undefined,
        siteContactPhone: siteContactPhone.trim() || undefined,
        unloadingScope,
        freightTerms,
        procurementNotes: procurementNotes.trim() || undefined,
        termsAndConditions: activeTerms.trim() || undefined,
        tcTemplateId: selectedTemplateId
          ? (selectedTemplateId as Id<"tc_templates">)
          : defaultTpl
          ? defaultTpl._id
          : undefined,
        submitImmediately,
        token: token || undefined,
      });

      onClose();
      router.push(`/dashboard/procurement/purchase-orders/${result.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to generate Purchase Order.");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
        {/* Header */}
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Generate Purchase Order
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                From approved Cost Comparison:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {costComparisonRefNo || "CC"}
                </span>{" "}
                &bull; Project: <span className="font-semibold text-foreground">{projectName || "Project"}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── 1. Commercial Context Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Vendor Card */}
          <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px] text-primary">
              <Building2 className="h-3.5 w-3.5" /> Selected Vendor
            </div>
            <div className="font-bold text-sm text-foreground">{vendorName || "Winning Vendor"}</div>
            <div className="text-muted-foreground font-mono text-[11px]">
              GSTIN: <span className="text-foreground font-semibold">{vendorGstNo || "27AABCS1234F1Z5"}</span>
            </div>
            {vendorPhone && (
              <div className="text-muted-foreground text-[11px]">
                Phone: <span className="text-foreground">{vendorPhone}</span>
              </div>
            )}
          </div>

          {/* Delivery Site Card */}
          <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px] text-primary">
              <MapPin className="h-3.5 w-3.5" /> Delivery Site Location
            </div>
            <div className="font-bold text-sm text-foreground">{siteName || "Main Site"}</div>
            <div className="text-muted-foreground text-[11px] leading-tight line-clamp-2">
              {siteAddress || "Site premises location"}
            </div>
          </div>

          {/* Value Summary Card */}
          <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold text-foreground">
                ₹{(subtotal ?? 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span>GST ({initialTaxRate ?? 18}%):</span>
              <span className="font-mono font-semibold text-foreground">
                ₹{Math.round(((subtotal ?? 0) * ((initialTaxRate ?? 18) / 100))).toLocaleString("en-IN")}
              </span>
            </div>
            {Number(initialFreight) > 0 && (
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Freight:</span>
                <span className="font-mono font-semibold text-foreground">
                  ₹{Number(initialFreight).toLocaleString("en-IN")}
                </span>
              </div>
            )}
            <div className="pt-1 border-t border-primary/20 flex items-center justify-between font-bold text-sm text-foreground">
              <span>Order Total:</span>
              <span className="font-mono text-primary">
                ₹{(totalAmount ?? 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. Quoted Line Items Table (Expanded & Visible) ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Approved Quoted Line Items ({items?.length || 0})
            </Label>
            <button
              type="button"
              onClick={() => setShowItemPreview(!showItemPreview)}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
            >
              {showItemPreview ? (
                <>Hide Items <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>View Items <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          </div>

          {showItemPreview && items && items.length > 0 ? (
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border text-[11px]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Item Description</th>
                    <th className="px-3 py-2 font-semibold text-right">Quoted Qty</th>
                    <th className="px-3 py-2 font-semibold">Unit</th>
                    <th className="px-3 py-2 font-semibold text-right">Unit Rate (₹)</th>
                    <th className="px-3 py-2 font-semibold text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground font-mono text-[11px]">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-foreground">{it.itemName}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{it.quantity}</td>
                      <td className="px-3 py-2 text-muted-foreground">{it.unit}</td>
                      <td className="px-3 py-2 text-right font-mono">₹{it.rate.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                        ₹{(it.amount ?? (it.quantity * it.rate)).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {/* ── 3. Logistics & Delivery Execution Controls ── */}
        <div className="p-4 rounded-lg border border-border bg-muted/10 space-y-4">
          <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2">
            <Truck className="h-4 w-4 text-primary" /> Delivery & Site Logistics Specifications
          </div>

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
                min={new Date().toISOString().split("T")[0]}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="text-xs h-9"
              />
              <span className="text-[10px] text-muted-foreground block">
                Standard: 30 days validity for order acceptance.
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
                min={new Date().toISOString().split("T")[0]}
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="text-xs h-9"
              />
              <span className="text-[10px] text-muted-foreground block">
                {deliveryDays
                  ? `Defaulted from quote (${deliveryDays} days lead time).`
                  : "Agreed delivery date for site delivery."}
              </span>
            </div>
          </div>

          {/* Site Contact Person & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Site Receiving Contact Person
              </Label>
              <Input
                type="text"
                placeholder="e.g. Vikram Singh (Site In-Charge)"
                value={siteContactPerson}
                onChange={(e) => setSiteContactPerson(e.target.value)}
                className="text-xs h-9"
              />
              <span className="text-[10px] text-muted-foreground block">
                Site contact for truck driver coordination.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Site Receiving Contact Phone
              </Label>
              <Input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={siteContactPhone}
                onChange={(e) => setSiteContactPhone(e.target.value)}
                className="text-xs h-9"
              />
              <span className="text-[10px] text-muted-foreground block">
                Contact number printed on delivery copy.
              </span>
            </div>
          </div>

          {/* Logistics Terms: Unloading & Freight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Unloading & Stacking Scope</Label>
              <select
                value={unloadingScope}
                onChange={(e) => setUnloadingScope(e.target.value as "buyer_scope" | "vendor_scope")}
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="buyer_scope">Buyer Scope (Site Team / Crane unloads)</option>
                <option value="vendor_scope">Vendor Scope (Vendor unloads at stacking yard)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Freight & Transportation Terms</Label>
              <select
                value={freightTerms}
                onChange={(e) =>
                  setFreightTerms(
                    e.target.value as
                      | "inclusive_in_rate"
                      | "extra_at_actuals"
                      | "fixed_freight"
                      | "to_pay_by_site"
                  )
                }
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="inclusive_in_rate">Included in Quoted Rate (FOR Site)</option>
                <option value="fixed_freight">Fixed Freight (Added in PO Total)</option>
                <option value="extra_at_actuals">Extra at Actuals (Billed on Lorry Receipt)</option>
                <option value="to_pay_by_site">To-Pay (Freight paid directly at site)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── 4. Statutory & Commercial Governance ── */}
        <div className="p-4 rounded-lg border border-border bg-muted/10 space-y-4">
          <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Statutory & Commercial Governance
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Place of Supply */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Place of Supply (GST State) <span className="text-destructive">*</span>
              </Label>
              <select
                value={placeOfSupplyStateCode}
                onChange={(e) => setPlaceOfSupplyStateCode(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-muted-foreground block">
                Governs CGST/SGST vs IGST applicability.
              </span>
            </div>

            {/* Payment Terms Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary" />
                Commercial Payment Terms <span className="text-destructive">*</span>
              </Label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value as PaymentTermType)}
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {PAYMENT_TERMS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-muted-foreground block">
                Inherited from winning vendor quote.
              </span>
            </div>
          </div>

          {/* Terms & Conditions Template Selection */}
          <div className="space-y-1.5 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-warning" />
                Terms & Conditions Template
              </Label>
              {templates && templates.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {templates.length} templates available
                </span>
              )}
            </div>

            <select
              value={selectedTemplateId || (defaultTpl ? defaultTpl._id : "")}
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
            <Label className="text-xs font-semibold">PO Terms & Conditions Text</Label>
            <textarea
              rows={4}
              value={activeTerms}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Specify procurement clauses, quality inspection rules, return policies, and payment terms..."
              className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-sans leading-relaxed text-[11px]"
            />
          </div>

          {/* Internal Remarks to Approving Manager */}
          <div className="space-y-1.5 pt-2 border-t border-border/60">
            <Label className="text-xs font-semibold">
              Procurement Officer Notes / Remarks for Manager (Optional)
            </Label>
            <Input
              type="text"
              placeholder="e.g. Negotiated 2% additional prompt payment discount; delivery aligned with tower casting schedule..."
              value={procurementNotes}
              onChange={(e) => setProcurementNotes(e.target.value)}
              className="text-xs h-9"
            />
          </div>
        </div>

        {/* ── Footer Actions ── */}
        <DialogFooter className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs w-full sm:w-auto"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleGenerate(false)}
              className="text-xs font-semibold gap-1.5"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {isLoading ? "Saving…" : "Save as PO Draft"}
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isLoading}
              onClick={() => handleGenerate(true)}
              className="text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Send className="h-3.5 w-3.5" />
              {isLoading ? "Generating…" : "Generate & Submit for Approval"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
