"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentView } from "@/components/document/document-view";
import { QuoteList, type QuoteItem } from "@/components/document/field-renderers/quote-list";
import { AddQuoteModal } from "@/components/document/add-quote-modal";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle } from "lucide-react";

export default function ProcurementRfqDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"rfq">;
  const { token } = useSession();

  const [isAddQuoteOpen, setIsAddQuoteOpen] = React.useState(false);


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
        <Link href="/dashboard/procurement/rfqs"><Button size="sm" variant="outline" className="text-xs">← Back to RFQs</Button></Link>
      </div>
    );
  }

  const lineItems = (rfq.requestedItems || []).map((it) => ({
    itemName: it.itemName,
    quantity: it.quantity,
    unit: it.unit,
    description: it.description,
  }));

  const canAddQuote = rfq.status === "draft" || rfq.status === "open";
  const canCreateCc = rfq.status === "closed" && (quotes?.length || 0) > 0;


  return (
    <div className="space-y-4">
      <DocumentView
        docType="rfq"
        doc={{ ...rfq, items: lineItems, lineItems }}
        linkedDocs={rfq.sourceMrId ? { mr: { id: rfq.sourceMrId, refNo: rfq.sourceMrRefNo || "MR", status: "routed_to_rfq" } } : undefined}
        backHref="/dashboard/procurement/rfqs"
      >
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Vendor Quotations Ledger</h3>
            {canCreateCc && (
              <Button
                size="sm"
                onClick={() => router.push(`/dashboard/procurement/cost-comparisons/new?fromRfq=${rfq._id}`)}
                className="text-xs font-semibold gap-1.5 shadow-xs"
              >
                Create Cost Comparison <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <QuoteList
            quotes={(quotes || []) as QuoteItem[]}
            onAddQuote={() => setIsAddQuoteOpen(true)}
            canAddQuote={canAddQuote}
          />
        </div>
      </DocumentView>

      <AddQuoteModal
        isOpen={isAddQuoteOpen}
        onClose={() => setIsAddQuoteOpen(false)}
        rfqId={id}
        vendors={rfq.vendors as Array<{ _id: string; name: string }>}
        items={rfq.requestedItems || []}
      />
    </div>
  );
}
