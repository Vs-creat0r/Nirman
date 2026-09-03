"use client";

import * as React from "react";
import type { LineItem } from "./document-view";

export function DocumentItemsTable({ items }: { items: LineItem[] }) {
  if (!items || items.length === 0) return null;

  const hasHsn = items.some((i) => i.hsnSacCode);
  const hasRate = items.some((i) => typeof i.rate === "number");
  const hasAmount = items.some((i) => typeof i.amount === "number");

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
        Document Line Items
      </h3>
      <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              <th className="py-2.5 px-3">Item Name</th>
              {hasHsn && <th className="py-2.5 px-3 w-28">HSN/SAC</th>}
              <th className="py-2.5 px-3">Description</th>
              <th className="py-2.5 px-3 w-24 text-right">Quantity</th>
              <th className="py-2.5 px-3 w-24">Unit</th>
              {hasRate && <th className="py-2.5 px-3 w-24 text-right">Rate (₹)</th>}
              {hasAmount && <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3 text-center text-muted-foreground font-mono text-[11px]">
                  {idx + 1}
                </td>
                <td className="py-2.5 px-3 font-semibold text-foreground">
                  {item.itemName}
                </td>
                {hasHsn && (
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">
                    {item.hsnSacCode || "—"}
                  </td>
                )}
                <td className="py-2.5 px-3 text-muted-foreground">
                  {item.description || "—"}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                  {item.quantity}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">{item.unit}</td>
                {hasRate && (
                  <td className="py-2.5 px-3 text-right font-mono text-foreground">
                    {typeof item.rate === "number" ? item.rate.toLocaleString("en-IN") : "—"}
                  </td>
                )}
                {hasAmount && (
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                    {typeof item.amount === "number"
                      ? item.amount.toLocaleString("en-IN")
                      : typeof item.rate === "number"
                      ? (item.rate * item.quantity).toLocaleString("en-IN")
                      : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
