"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Plus, Building, FileText } from "lucide-react";

interface AddQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfqId: Id<"rfq">;
  vendors: Array<{ _id: string; name: string }>;
  items: Array<{
    itemName: string;
    category?: string;
    quantity: number;
    unit: string;
    projectItemId?: string;
  }>;
  onQuoteAdded?: () => void;
}

export function AddQuoteModal({
  isOpen,
  onClose,
  rfqId,
  vendors,
  items,
  onQuoteAdded,
}: AddQuoteModalProps) {
  const { token } = useSession();
  const addQuoteMutation = useMutation(api.rfq_quotes.addQuote);

  const [selectedVendorId, setSelectedVendorId] = React.useState(vendors[0]?._id ?? "");
  const [selectedItemIndex, setSelectedItemIndex] = React.useState(0);
  const [rate, setRate] = React.useState<number | "">("");
  const [taxRate, setTaxRate] = React.useState<number>(18);
  const [validityDate, setValidityDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (vendors.length > 0 && !selectedVendorId) {
      setSelectedVendorId(vendors[0]._id);
    }
  }, [vendors, selectedVendorId]);

  const currentItem = items[selectedItemIndex] || items[0];

  const subtotal = typeof rate === "number" && currentItem ? rate * currentItem.quantity : 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!selectedVendorId) {
      setError("Please select a vendor.");
      return;
    }
    if (typeof rate !== "number" || rate <= 0) {
      setError("Please enter a valid rate greater than 0.");
      return;
    }
    if (!currentItem) {
      setError("Please select an item.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await addQuoteMutation({
        rfqId,
        vendorId: selectedVendorId as Id<"vendors">,
        projectItemId: currentItem.projectItemId as Id<"project_items"> | undefined,
        itemName: currentItem.itemName,
        category: currentItem.category,
        unit: currentItem.unit,
        quantity: currentItem.quantity,
        rate,
        taxRate,
        validityDate: validityDate || undefined,
        notes: notes.trim() || undefined,
        token,
      });

      // Reset fields
      setRate("");
      setNotes("");
      onQuoteAdded?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record quote.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Record Vendor Quote
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter formal quote received from an invited vendor for this RFQ line item.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {error && (
              <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Vendor Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="quote-vendor" className="text-xs font-semibold">
                Vendor <span className="text-destructive">*</span>
              </Label>
              <select
                id="quote-vendor"
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                required
              >
                {vendors.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Item Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="quote-item" className="text-xs font-semibold">
                Line Item <span className="text-destructive">*</span>
              </Label>
              <select
                id="quote-item"
                value={selectedItemIndex}
                onChange={(e) => setSelectedItemIndex(parseInt(e.target.value, 10))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {items.map((it, idx) => (
                  <option key={idx} value={idx}>
                    {it.itemName} ({it.quantity} {it.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Rate & Tax Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quote-rate" className="text-xs font-semibold">
                  Unit Rate (₹/{currentItem?.unit}) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quote-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 350"
                  value={rate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRate(val === "" ? "" : Math.max(0, parseFloat(val) || 0));
                  }}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e") e.preventDefault();
                  }}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quote-tax" className="text-xs font-semibold">
                  GST Rate (%)
                </Label>
                <select
                  id="quote-tax"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value={0}>0% (Exempt)</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18% (Standard)</option>
                  <option value={28}>28%</option>
                </select>
              </div>
            </div>

            {/* Financial Summary Preview */}
            <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Quantity:</span>
                <span className="font-mono text-foreground font-semibold">
                  {currentItem?.quantity} {currentItem?.unit}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-mono text-foreground font-semibold">
                  ₹{subtotal.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax Amount ({taxRate}%):</span>
                <span className="font-mono text-foreground font-semibold">
                  ₹{taxAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-bold text-foreground">
                <span>Calculated Total:</span>
                <span className="font-mono text-primary">₹{total.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Validity Date */}
            <div className="space-y-1.5">
              <Label htmlFor="quote-validity" className="text-xs font-semibold">
                Quote Validity Date
              </Label>
              <Input
                id="quote-validity"
                type="date"
                value={validityDate}
                onChange={(e) => setValidityDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="quote-notes" className="text-xs font-semibold">
                Commercial Terms & Notes
              </Label>
              <textarea
                id="quote-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms, delivery timeframe, freight terms..."
                rows={2}
                maxLength={500}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-semibold"
            >
              {isSubmitting ? "Recording..." : "Record Quote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
