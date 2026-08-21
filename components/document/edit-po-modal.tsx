"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  Trash2,
  Plus,
} from "lucide-react";

interface EditPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: any;
}

export function EditPOModal({ isOpen, onClose, po }: EditPOModalProps) {
  const { token } = useSession();
  const resubmitPOMutation = useMutation(api.purchase_orders.resubmitPO);

  const [lineItems, setLineItems] = React.useState<
    Array<{
      itemName: string;
      quantity: number;
      unit: string;
      rate: number;
      hsnSacCode?: string;
    }>
  >([]);
  const [taxRate, setTaxRate] = React.useState(18);
  const [freight, setFreight] = React.useState(0);
  const [paymentTerms, setPaymentTerms] = React.useState<
    "advance" | "on_delivery" | "7_days" | "15_days" | "30_days" | "45_days"
  >("30_days");
  const [expectedDelivery, setExpectedDelivery] = React.useState("");
  const [validUntil, setValidUntil] = React.useState("");
  const [termsAndConditions, setTermsAndConditions] = React.useState("");

  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize form state when po opens
  React.useEffect(() => {
    if (po) {
      setLineItems(
        po.lineItems.map((item: any) => ({
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          hsnSacCode: item.hsnSacCode || "",
        }))
      );
      setTaxRate(po.taxRate ?? 18);
      setFreight(po.freight ?? 0);
      setPaymentTerms(po.paymentTerms ?? "30_days");
      setExpectedDelivery(po.expectedDelivery || "");
      setValidUntil(po.validUntil || "");
      setTermsAndConditions(po.termsAndConditions || "");
    }
  }, [po]);

  // Real-time calculations
  const subtotal = React.useMemo(() => {
    return (
      Math.round(
        lineItems.reduce(
          (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
          0
        ) * 100
      ) / 100
    );
  }, [lineItems]);

  const taxAmount = React.useMemo(() => {
    return Math.round(subtotal * (taxRate / 100) * 100) / 100;
  }, [subtotal, taxRate]);

  const totalAmount = React.useMemo(() => {
    return Math.round((subtotal + taxAmount + (Number(freight) || 0)) * 100) / 100;
  }, [subtotal, taxAmount, freight]);

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      setError("Purchase Order must have at least one line item.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await resubmitPOMutation({
        id: po._id as Id<"purchase_order">,
        lineItems: lineItems.map((i) => ({
          itemName: i.itemName,
          quantity: Number(i.quantity) || 0,
          unit: i.unit,
          rate: Number(i.rate) || 0,
          hsnSacCode: i.hsnSacCode?.trim() || undefined,
        })),
        taxRate: Number(taxRate) || 18,
        freight: Number(freight) > 0 ? Number(freight) : undefined,
        paymentTerms,
        expectedDelivery: expectedDelivery || undefined,
        validUntil: validUntil || undefined,
        termsAndConditions: termsAndConditions.trim() || undefined,
        token: token || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to resubmit Purchase Order.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-500" />
              Edit & Resubmit Purchase Order
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Reference: <span className="font-mono font-semibold">{po.refNo}</span> &bull; Vendor: <span className="font-semibold">{po.vendor?.name}</span>
            </p>
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

        <form onSubmit={handleResubmit} className="space-y-4">
          {/* Line Items Editor */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Ordered Line Items</Label>
            <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-2 px-2.5 w-8 text-center">#</th>
                    <th className="py-2 px-2.5">Item Name</th>
                    <th className="py-2 px-2.5 w-24">HSN Code</th>
                    <th className="py-2 px-2.5 w-20 text-right">Qty</th>
                    <th className="py-2 px-2.5 w-16">Unit</th>
                    <th className="py-2 px-2.5 w-24 text-right">Rate (₹)</th>
                    <th className="py-2 px-2.5 w-24 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lineItems.map((item, idx) => {
                    const itemAmount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
                    return (
                      <tr key={idx}>
                        <td className="py-1.5 px-2.5 text-center text-muted-foreground font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2">
                          <Input
                            required
                            value={item.itemName}
                            onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input
                            value={item.hsnSacCode || ""}
                            onChange={(e) => handleItemChange(idx, "hsnSacCode", e.target.value)}
                            placeholder="HSN"
                            className="h-7 text-xs font-mono"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input
                            type="number"
                            min="0.001"
                            step="any"
                            required
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            className="h-7 text-xs text-right font-mono"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input
                            required
                            value={item.unit}
                            onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={item.rate}
                            onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                            className="h-7 text-xs text-right font-mono"
                          />
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-foreground">
                          ₹{itemAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commercial & Financial Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Payment Terms</Label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value as any)}
                className="flex h-8 w-full rounded-md border border-border bg-input px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="advance">Advance</option>
                <option value="on_delivery">On Delivery</option>
                <option value="7_days">7 Days</option>
                <option value="15_days">15 Days</option>
                <option value="30_days">30 Days</option>
                <option value="45_days">45 Days</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">GST Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Freight (₹)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={freight}
                onChange={(e) => setFreight(Number(e.target.value))}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Validity and Expected Delivery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">PO Validity Date</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Expected Delivery Date</Label>
              <Input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Terms & Conditions</Label>
            <textarea
              rows={3}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              className="flex w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-sans text-[11px]"
            />
          </div>

          {/* Total Summary */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">
              Subtotal: ₹{subtotal.toLocaleString("en-IN")} + GST: ₹{taxAmount.toLocaleString("en-IN")} + Freight: ₹{freight.toLocaleString("en-IN")}
            </span>
            <span className="text-sm font-bold text-foreground">
              Total: <strong className="text-primary text-base">₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSaving ? "Resubmitting PO…" : "Resubmit for Manager Approval"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
