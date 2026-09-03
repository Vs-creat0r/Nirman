"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentView } from "@/components/document";
import { GeneratePOModal } from "@/components/document/generate-po-modal";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export default function ProcurementCCDetailPage() {
  const params = useParams();
  const { token } = useSession();
  const id = params?.id as Id<"cost_comparison">;

  const cc = useQuery(
    api.cost_comparisons.getCC,
    id && token ? { id, token } : "skip"
  );

  const submitCC = useMutation(api.cost_comparisons.submitCC);
  const [isGeneratePOModalOpen, setIsGeneratePOModalOpen] = React.useState(false);

  if (cc === undefined) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading Cost Comparison…</span>
      </div>
    );
  }

  if (cc === null) {
    return (
      <div className="p-12 text-center space-y-3">
        <h2 className="text-base font-bold text-foreground">Cost Comparison Not Found</h2>
        <p className="text-xs text-muted-foreground">
          The requested cost comparison could not be found or you do not have permission to view it.
        </p>
        <Link href="/dashboard/procurement/cost-comparisons">
          <Button variant="outline" size="sm" className="text-xs">
            Back to Cost Comparisons
          </Button>
        </Link>
      </div>
    );
  }

  const handleAction = async (actionName: string) => {
    if (actionName === "submit" || actionName === "resubmit") {
      await submitCC({ id, token: token || undefined });
    }
  };

  const winningQuote = (cc.vendorQuotes || []).find(
    (q: any) => q.vendorId === cc.selectedVendorId
  );

  return (
    <>
      <DocumentView
        docType="cost_comparison"
        doc={cc as any}
        userRole="procurement_officer"
        backHref="/dashboard/procurement/cost-comparisons"
        backLabel="Back to Cost Comparisons"
        editHref={`/dashboard/procurement/cost-comparisons/${id}/edit`}
        onAction={handleAction}
        headerExtras={
          cc.status === "approved" && (
            <Button
              size="sm"
              onClick={() => setIsGeneratePOModalOpen(true)}
              className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Generate Purchase Order
            </Button>
          )
        }
        linkedDocs={{
          mr: cc.materialRequest
            ? { id: cc.materialRequestId, refNo: cc.materialRequest.refNo || "MR", status: "review_cc" }
            : undefined,
          cc: { id: cc._id, refNo: cc.refNo, status: cc.status },
        }}
      />

      {isGeneratePOModalOpen && (
        <GeneratePOModal
          isOpen={isGeneratePOModalOpen}
          onClose={() => setIsGeneratePOModalOpen(false)}
          costComparisonId={cc._id}
          costComparisonRefNo={cc.refNo}
          projectName={cc.projectName}
          siteName={cc.siteName}
          siteAddress={cc.siteAddress}
          vendorName={winningQuote?.vendorName || "Selected Vendor"}
          vendorGstNo={winningQuote?.vendorGstNo}
          vendorPhone={winningQuote?.vendorPhone}
          totalAmount={winningQuote?.total}
          subtotal={winningQuote?.subtotal}
          taxRate={winningQuote?.taxRate}
          freight={winningQuote?.freight}
          paymentTerms={winningQuote?.paymentTerms}
          deliveryDays={winningQuote?.deliveryDays}
          items={winningQuote?.items}
        />
      )}
    </>
  );
}
