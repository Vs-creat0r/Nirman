"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import type { DocumentViewDoc } from "./document-view";

export function DocumentFinancialSummary({ doc }: { doc: DocumentViewDoc }) {
  if (typeof doc.totalAmount !== "number") return null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-1.5 text-xs">
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
            Commercial Terms
          </span>
          {doc.paymentTerms && (
            <div>
              Payment Terms:{" "}
              <strong className="capitalize text-foreground">
                {String(doc.paymentTerms).replace("_", " ")}
              </strong>
            </div>
          )}
          {doc.creatorName && (
            <div>
              Issued By: <strong className="text-foreground">{doc.creatorName}</strong>
            </div>
          )}
          {doc.reviewerName && (
            <div>
              Authorized By:{" "}
              <strong className="text-[--success]">{String(doc.reviewerName)}</strong>
              {doc.reviewedAt && (
                <span className="text-muted-foreground text-[11px] ml-1">
                  on {new Date(String(doc.reviewedAt)).toLocaleDateString("en-IN")}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-3.5 rounded-lg bg-muted/30 border border-border space-y-1.5 font-mono text-xs">
          {typeof doc.subtotal === "number" && (
            <div className="flex justify-between text-muted-foreground">
              <span>Items Subtotal:</span>
              <span>₹{doc.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {typeof doc.taxAmount === "number" && (
            <div className="flex justify-between text-muted-foreground">
              <span>GST ({doc.taxRate || 18}%):</span>
              <span>+₹{doc.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {typeof doc.freight === "number" && doc.freight > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Freight Charges:</span>
              <span>+₹{doc.freight.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm font-bold text-foreground pt-2 border-t border-border">
            <span>Grand Total:</span>
            <span className="text-base text-primary">
              ₹{doc.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {doc.termsAndConditions && (
        <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-2">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" />
            Terms & Conditions
          </h3>
          <pre className="text-xs text-muted-foreground font-sans whitespace-pre-wrap leading-relaxed bg-surface/50 p-2.5 rounded border border-border/60">
            {String(doc.termsAndConditions)}
          </pre>
        </div>
      )}
    </>
  );
}
