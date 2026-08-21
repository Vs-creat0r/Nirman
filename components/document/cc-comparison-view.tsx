"use client";

import * as React from "react";
import { CheckCircle2, Award, Clock, CreditCard, Truck, Percent, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface EnrichedVendorQuote {
  vendorId: string;
  vendorName: string;
  vendorPhone?: string;
  vendorEmail?: string;
  vendorGstNo?: string;
  vendorCategory?: string;
  items: Array<{
    itemName: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  freight?: number;
  total: number;
  deliveryDays?: number;
  paymentTerms?: string;
  notes?: string;
}

interface CCComparisonViewProps {
  quotes: EnrichedVendorQuote[];
  selectedVendorId?: string;
  onSelectVendor?: (vendorId: string) => void;
  isSelecting?: boolean;
}

export function CCComparisonView({
  quotes,
  selectedVendorId,
  onSelectVendor,
  isSelecting = false,
}: CCComparisonViewProps) {
  if (!quotes || quotes.length === 0) {
    return <div className="p-8 text-center text-xs text-muted-foreground">No vendor quotes found.</div>;
  }

  // Identify lowest total
  const minTotal = Math.min(...quotes.map((q) => q.total));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
          Vendor Quotations ({quotes.length} Participating Vendors)
        </h3>
        <span className="text-[11px] text-muted-foreground">
          Lowest: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹{minTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </span>
      </div>

      {/* Grid of Vendor Quote Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quotes.map((quote, idx) => {
          const isLowest = quote.total === minTotal;
          const isSelected = selectedVendorId === quote.vendorId;

          return (
            <Card
              key={quote.vendorId || idx}
              className={`flex flex-col justify-between overflow-hidden border transition-all ${
                isSelected
                  ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]"
                  : isLowest
                  ? "border-emerald-500/50 bg-emerald-500/[0.02]"
                  : "border-border"
              }`}
            >
              {/* Header */}
              <CardHeader className="p-4 bg-muted/40 border-b border-border space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-foreground">
                        {quote.vendorName}
                      </h4>
                    </div>
                    {quote.vendorCategory && (
                      <span className="text-[10px] text-muted-foreground capitalize block">
                        Category: {quote.vendorCategory}
                      </span>
                    )}
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-col items-end gap-1">
                    {isSelected && (
                      <Badge variant="success" className="gap-1 text-[10px] py-0 px-2 font-bold">
                        <CheckCircle2 className="h-3 w-3" />
                        Selected
                      </Badge>
                    )}
                    {isLowest && !isSelected && (
                      <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        Lowest
                      </span>
                    )}
                  </div>
                </div>

                {/* Vendor Contact Info */}
                <div className="text-[11px] text-muted-foreground space-y-0.5 font-mono">
                  {quote.vendorPhone && <div>Ph: {quote.vendorPhone}</div>}
                  {quote.vendorGstNo && <div>GST: {quote.vendorGstNo}</div>}
                </div>
              </CardHeader>

              {/* Body: Items Table & Terms */}
              <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                {/* Items breakdown */}
                <div className="space-y-2">
                  <div className="rounded-md border border-border bg-surface overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold text-[11px]">
                          <th className="py-1.5 px-2.5">Item</th>
                          <th className="py-1.5 px-2 text-right">Qty</th>
                          <th className="py-1.5 px-2 text-right">Rate</th>
                          <th className="py-1.5 px-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-[11px]">
                        {quote.items.map((it, itIdx) => (
                          <tr key={itIdx} className="hover:bg-muted/20">
                            <td className="py-1.5 px-2.5 font-medium text-foreground">
                              {it.itemName}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                              {it.quantity} {it.unit}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono">
                              ₹{it.rate}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-foreground">
                              ₹{(it.amount || it.quantity * it.rate).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Commercial Terms Summary */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span>{quote.deliveryDays ? `${quote.deliveryDays} days delivery` : "Delivery TBD"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CreditCard className="h-3 w-3 flex-shrink-0" />
                      <span className="capitalize">{quote.paymentTerms ? quote.paymentTerms.replace("_", " ") : "30 days"}</span>
                    </div>
                  </div>

                  {quote.notes && (
                    <p className="text-[11px] text-muted-foreground italic p-2 rounded bg-muted/30 border border-border/50">
                      &ldquo;{quote.notes}&rdquo;
                    </p>
                  )}
                </div>

                {/* Cost Breakdown Total */}
                <div className="pt-3 border-t border-border space-y-1 font-mono text-xs">
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>Subtotal:</span>
                    <span>₹{quote.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>GST ({quote.taxRate}%):</span>
                    <span>+₹{quote.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  {quote.freight !== undefined && quote.freight > 0 && (
                    <div className="flex justify-between text-muted-foreground text-[11px]">
                      <span>Freight:</span>
                      <span>+₹{quote.freight.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-border text-sm font-bold text-foreground">
                    <span>Total Amount:</span>
                    <span className={isLowest ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""}>
                      ₹{quote.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Selection Button if in selection mode */}
                  {isSelecting && onSelectVendor && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => onSelectVendor(quote.vendorId)}
                        className={`w-full py-1.5 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                        }`}
                      >
                        {isSelected ? "✓ Winning Vendor Selected" : "Select this Vendor"}
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
