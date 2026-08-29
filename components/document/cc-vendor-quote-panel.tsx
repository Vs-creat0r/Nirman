"use client";

import * as React from "react";
import { Trash2, Building2, Truck, Percent, CreditCard, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Id } from "@/convex/_generated/dataModel";

export interface CCQuoteItem {
  itemName: string;
  quantity: number;
  unit: string;
  rate: number | undefined;
  amount: number;
  projectItemId?: Id<"project_items">;
}

export interface CCVendorQuoteData {
  vendorId: string;
  items: CCQuoteItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  freight: number;
  total: number;
  deliveryDays?: number;
  paymentTerms?: string;
  notes?: string;
}

interface CCVendorQuotePanelProps {
  index: number;
  quote: CCVendorQuoteData;
  vendors: Array<{
    _id: string;
    name: string;
    phone?: string;
    gstNo?: string;
    category?: string;
  }>;
  usedVendorIds: string[];
  onChange: (updated: CCVendorQuoteData) => void;
  onRemove: () => void;
  canRemove: boolean;
  isLowest?: boolean;
}

export function CCVendorQuotePanel({
  index,
  quote,
  vendors,
  usedVendorIds,
  onChange,
  onRemove,
  canRemove,
  isLowest = false,
}: CCVendorQuotePanelProps) {
  const selectedVendor = vendors.find((v) => v._id === quote.vendorId);

  // Recalculate totals helper
  const updateCalculations = (
    items: CCQuoteItem[],
    taxRate: number,
    freight: number,
    otherFields: Partial<CCVendorQuoteData> = {}
  ) => {
    const updatedItems = items.map((it) => ({
      ...it,
      amount: Math.round(Number(it.quantity || 0) * Number(it.rate || 0) * 100) / 100,
    }));

    const subtotal = Math.round(
      updatedItems.reduce((acc, cur) => acc + (cur.amount || 0), 0) * 100
    ) / 100;
    const cleanTaxRate = Math.max(0, Math.min(100, Number(taxRate) || 0));
    const taxAmount = Math.round(subtotal * (cleanTaxRate / 100) * 100) / 100;
    const cleanFreight = Math.max(0, Number(freight) || 0);
    const total = Math.round((subtotal + taxAmount + cleanFreight) * 100) / 100;

    onChange({
      ...quote,
      ...otherFields,
      items: updatedItems,
      subtotal,
      taxRate: cleanTaxRate,
      taxAmount,
      freight: cleanFreight,
      total,
    });
  };

  const handleRateChange = (itemIdx: number, rawRate: string) => {
    const rate = rawRate === "" ? undefined : Math.max(0, parseFloat(rawRate) || 0);
    const newItems = [...quote.items];
    newItems[itemIdx] = {
      ...newItems[itemIdx],
      rate: rate !== undefined && isNaN(rate) ? undefined : rate,
      amount: rate !== undefined ? Math.round(newItems[itemIdx].quantity * rate * 100) / 100 : 0,
    };
    updateCalculations(newItems, quote.taxRate, quote.freight);
  };

  return (
    <Card className={`overflow-hidden border transition-all ${isLowest ? "border-emerald-500/50 bg-emerald-500/[0.02]" : "border-border"}`}>
      {/* Panel Header */}
      <CardHeader className="py-3 px-4 bg-muted/40 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center font-mono">
              V{index + 1}
            </span>
            <span className="text-xs font-bold text-foreground">
              Vendor Quotation #{index + 1}
            </span>
            {isLowest && (
              <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                ★ Lowest Total
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-foreground">
              ₹{quote.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <button
              type="button"
              onClick={onRemove}
              disabled={!canRemove}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors cursor-pointer"
              title={!canRemove ? "Minimum 2 vendor quotes required" : "Remove this quotation"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Vendor Selection */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            Select Vendor <span className="text-destructive">*</span>
          </Label>
          <select
            value={quote.vendorId}
            onChange={(e) => onChange({ ...quote, vendorId: e.target.value })}
            className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">-- Choose Vendor from Master --</option>
            {vendors.map((v) => {
              const isUsedElsewhere = usedVendorIds.includes(v._id) && v._id !== quote.vendorId;
              return (
                <option key={v._id} value={v._id} disabled={isUsedElsewhere}>
                  {v.name} {v.category ? `(${v.category})` : ""} {isUsedElsewhere ? "— (Already selected)" : ""}
                </option>
              );
            })}
          </select>
          {selectedVendor && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
              {selectedVendor.phone && <span>Ph: {selectedVendor.phone}</span>}
              {selectedVendor.gstNo && <span>GSTIN: {selectedVendor.gstNo}</span>}
            </div>
          )}
        </div>

        {/* Quoted Line Items Table */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Quoted Item Rates</span>
            <span className="text-[11px] text-muted-foreground font-normal">
              {quote.items.length} items
            </span>
          </div>

          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-2 px-3 w-8 text-center">#</th>
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3 w-16 text-right">Qty</th>
                  <th className="py-2 px-3 w-14">Unit</th>
                  <th className="py-2 px-3 w-28 text-right">Rate (₹) *</th>
                  <th className="py-2 px-3 w-28 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quote.items.map((item, itIdx) => (
                  <tr key={itIdx} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono text-[11px]">
                      {itIdx + 1}
                    </td>
                    <td className="py-2 px-3 font-semibold text-foreground">
                      {item.itemName}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium">
                      {item.quantity}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {item.unit}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Enter rate"
                        value={item.rate === undefined || item.rate === null || (item.rate === 0 && (item.amount === 0)) ? "" : item.rate}
                        onChange={(e) => handleRateChange(itIdx, e.target.value)}
                        className="h-7 text-xs text-right font-mono"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                      {item.rate === undefined || (item.rate === 0 && item.amount === 0)
                        ? <span className="text-muted-foreground font-normal">—</span>
                        : `₹${item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Commercial Terms & Taxes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
          {/* GST Tax Rate */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
              <Percent className="h-3 w-3 text-muted-foreground" />
              GST Rate (%)
            </Label>
            <select
              value={quote.taxRate}
              onChange={(e) =>
                updateCalculations(quote.items, Number(e.target.value), quote.freight)
              }
              className="flex h-8 w-full rounded-md border border-border bg-input px-2 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="0">0% (Nil)</option>
              <option value="5">5% GST</option>
              <option value="12">12% GST</option>
              <option value="18">18% GST (Standard)</option>
              <option value="28">28% GST</option>
            </select>
          </div>

          {/* Freight Charges */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
              <Truck className="h-3 w-3 text-muted-foreground" />
              Freight (₹)
            </Label>
            <Input
              type="number"
              min="0"
              placeholder="0.00"
              value={quote.freight === undefined || isNaN(quote.freight) ? "" : quote.freight}
              onChange={(e) =>
                updateCalculations(
                  quote.items,
                  quote.taxRate,
                  e.target.value === "" ? 0 : Math.max(0, parseFloat(e.target.value) || 0)
                )
              }
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Delivery Timeline */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              Delivery (Days)
            </Label>
            <Input
              type="number"
              min="1"
              placeholder="e.g. 3"
              value={quote.deliveryDays || ""}
              onChange={(e) =>
                onChange({
                  ...quote,
                  deliveryDays: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>

        {/* Payment Terms & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
              <CreditCard className="h-3 w-3 text-muted-foreground" />
              Payment Terms
            </Label>
            <select
              value={quote.paymentTerms || "30_days"}
              onChange={(e) => onChange({ ...quote, paymentTerms: e.target.value })}
              className="flex h-8 w-full rounded-md border border-border bg-input px-2 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="advance">100% Advance</option>
              <option value="on_delivery">On Delivery</option>
              <option value="7_days">7 Days Credit</option>
              <option value="15_days">15 Days Credit</option>
              <option value="30_days">30 Days Credit (Standard)</option>
              <option value="45_days">45 Days Credit</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              Vendor Remarks / Terms
            </Label>
            <Input
              type="text"
              placeholder="Validity, unloading scope, etc."
              value={quote.notes || ""}
              onChange={(e) => onChange({ ...quote, notes: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Totals Summary Card */}
        <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1 text-xs font-mono">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal:</span>
            <span>₹{quote.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>GST ({quote.taxRate}%):</span>
            <span>+₹{quote.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          {quote.freight > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Freight:</span>
              <span>+₹{quote.freight.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between text-foreground font-bold text-sm pt-1 border-t border-border">
            <span>Total Quotation:</span>
            <span className={isLowest ? "text-emerald-600 dark:text-emerald-400" : ""}>
              ₹{quote.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
