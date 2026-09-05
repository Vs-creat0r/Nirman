"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Building, FileText, CheckCircle2 } from "lucide-react";

export interface QuoteItem {
  _id: string;
  vendorId: string;
  vendorName: string;
  vendorPhone?: string;
  itemName: string;
  category?: string;
  unit: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  total: number;
  validityDate?: string;
  notes?: string;
  quoteFileId?: string;
  supersededBy?: string;
}

interface QuoteListProps {
  quotes: QuoteItem[];
  onAddQuote?: () => void;
  canAddQuote?: boolean;
}

export function QuoteList({ quotes, onAddQuote, canAddQuote }: QuoteListProps) {
  const [sortAsc, setSortAsc] = React.useState(true);

  const activeQuotes = React.useMemo(() => {
    return quotes.filter((q) => !q.supersededBy);
  }, [quotes]);

  const sortedQuotes = React.useMemo(() => {
    return [...activeQuotes].sort((a, b) => {
      return sortAsc ? a.rate - b.rate : b.rate - a.rate;
    });
  }, [activeQuotes, sortAsc]);

  // Group by vendor for summary
  const vendorQuotes = React.useMemo(() => {
    const map = new Map<string, { vendorName: string; totalSum: number; itemCount: number }>();
    for (const q of activeQuotes) {
      const existing = map.get(q.vendorId) || {
        vendorName: q.vendorName,
        totalSum: 0,
        itemCount: 0,
      };
      existing.totalSum += q.total;
      existing.itemCount += 1;
      map.set(q.vendorId, existing);
    }
    return Array.from(map.entries());
  }, [activeQuotes]);

  if (activeQuotes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2">
        <Building className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-xs font-semibold text-foreground">No Vendor Quotes Recorded Yet</p>
        <p className="text-[11px] text-muted-foreground">
          Record vendor quotations as they arrive to build a side-by-side comparison.
        </p>
        {canAddQuote && onAddQuote && (
          <Button size="sm" onClick={onAddQuote} className="text-xs mt-2">
            + Record Vendor Quote
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vendor Aggregation Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-foreground">Vendor Summary:</span>
          {vendorQuotes.map(([vid, v]) => (
            <Badge key={vid} variant="outline" className="text-[11px] gap-1.5 py-1 px-2.5">
              <Building className="h-3 w-3 text-primary" />
              <span className="font-semibold text-foreground">{v.vendorName}:</span>
              <span className="font-mono text-foreground font-bold">₹{v.totalSum.toLocaleString("en-IN")}</span>
              <span className="text-muted-foreground text-[10px]">({v.itemCount} items)</span>
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortAsc(!sortAsc)}
            className="text-xs gap-1 h-7 text-muted-foreground hover:text-foreground"
          >
            <ArrowUpDown className="h-3 w-3" />
            Sort by Rate ({sortAsc ? "Lowest First" : "Highest First"})
          </Button>
          {canAddQuote && onAddQuote && (
            <Button size="sm" onClick={onAddQuote} className="text-xs h-7">
              + Add Quote
            </Button>
          )}
        </div>
      </div>

      {/* Quote Comparison Table */}
      <div className="rounded-md border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-semibold">Vendor</TableHead>
              <TableHead className="text-xs font-semibold">Item & Category</TableHead>
              <TableHead className="text-xs font-semibold text-right">Quantity</TableHead>
              <TableHead className="text-xs font-semibold text-right">Rate (₹/unit)</TableHead>
              <TableHead className="text-xs font-semibold text-right">GST %</TableHead>
              <TableHead className="text-xs font-semibold text-right">Total (₹)</TableHead>
              <TableHead className="text-xs font-semibold">Validity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {sortedQuotes.map((q) => (
              <TableRow key={q._id} className="hover:bg-muted/20 transition-colors">
                <TableCell className="font-semibold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{q.vendorName}</span>
                  </div>
                  {q.vendorPhone && (
                    <span className="text-[10px] text-muted-foreground font-mono">{q.vendorPhone}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{q.itemName}</div>
                  {q.category && (
                    <span className="text-[10px] text-muted-foreground">{q.category}</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {q.quantity} <span className="text-[10px] text-muted-foreground uppercase">{q.unit}</span>
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-foreground">
                  ₹{q.rate.toLocaleString("en-IN")}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {q.taxRate ?? 18}%
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-foreground">
                  ₹{q.total.toLocaleString("en-IN")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {q.validityDate ? (
                    <span className="font-mono text-[11px]">{q.validityDate}</span>
                  ) : (
                    <span className="text-[10px] italic">Standard</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
