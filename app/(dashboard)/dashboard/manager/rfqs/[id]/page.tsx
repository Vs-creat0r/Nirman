"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentView } from "@/components/document/document-view";
import { QuoteList, type QuoteItem } from "@/components/document/field-renderers/quote-list";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ManagerRfqDetailPage() {
  const params = useParams();
  const id = params.id as Id<"rfq">;
  const { token } = useSession();

  const rfq = useQuery(api.rfqs.getRfq, token && id ? { id, token } : "skip");
  const quotes = useQuery(api.rfq_quotes.getQuotesByRfq, token && id ? { rfqId: id, token } : "skip");

  if (rfq === undefined || quotes === undefined) {
    return <div className="p-8"><div className="h-64 bg-muted/40 animate-pulse rounded-xl" /></div>;
  }
  if (!rfq) {
    return (
      <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="font-bold text-foreground">RFQ Not Found</p>
        <Link href="/dashboard/manager"><Button size="sm" variant="outline" className="text-xs">← Back to Dashboard</Button></Link>
      </div>
    );
  }

  const lineItems = (rfq.requestedItems || []).map((it) => ({
    itemName: it.itemName,
    quantity: it.quantity,
    unit: it.unit,
    description: it.description,
  }));

  return (
    <div className="space-y-4">
      <DocumentView
        docType="rfq"
        doc={{ ...rfq, items: lineItems, lineItems }}
        linkedDocs={rfq.sourceMrId ? { mr: { id: rfq.sourceMrId, refNo: rfq.sourceMrRefNo || "MR", status: "routed_to_rfq" } } : undefined}
        backHref="/dashboard/manager"
      >
        <div className="space-y-3 pt-4 border-t border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Submitted Vendor Quotations</h3>
          <QuoteList quotes={(quotes || []) as QuoteItem[]} />
        </div>
      </DocumentView>
    </div>
  );
}
