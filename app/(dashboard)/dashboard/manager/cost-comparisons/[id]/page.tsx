"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentView } from "@/components/document";
import { CCApproveModal } from "@/components/document/cc-approve-modal";
import { Button } from "@/components/ui/button";

export default function ManagerCCDetailPage() {
  const params = useParams();
  const { token } = useSession();
  const id = params?.id as Id<"cost_comparison">;

  const cc = useQuery(api.cost_comparisons.getCC, id && token ? { id, token } : "skip");
  const approveCC = useMutation(api.cost_comparisons.approveCC);
  const rejectCC = useMutation(api.cost_comparisons.rejectCC);
  const queryCC = useMutation(api.cost_comparisons.queryCC);

  const [isApproveModalOpen, setIsApproveModalOpen] = React.useState(false);
  const [selectedVendorForApproval, setSelectedVendorForApproval] = React.useState<string>("");
  const [isActionLoading, setIsActionLoading] = React.useState(false);

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
        <p className="text-xs text-muted-foreground">The requested document could not be found.</p>
        <Link href="/dashboard/manager/cost-comparisons">
          <Button variant="outline" size="sm" className="text-xs">Back to Approvals</Button>
        </Link>
      </div>
    );
  }

  const handleAction = async (actionName: string, note?: string) => {
    if (actionName === "approve") {
      setIsApproveModalOpen(true);
    } else if (actionName === "reject") {
      if (!note) throw new Error("Rejection reason note is required.");
      await rejectCC({ id, note, token: token || undefined });
    } else if (actionName === "query") {
      if (!note) throw new Error("Query clarification note is required.");
      await queryCC({ id, note, token: token || undefined });
    }
  };

  const handleApproveConfirm = async (selectedVendorId: string, selectionJustification?: string, note?: string) => {
    setIsActionLoading(true);
    try {
      await approveCC({
        id,
        selectedVendorId: selectedVendorId as Id<"vendors">,
        selectionJustification,
        note,
        token: token || undefined,
      });
      setIsApproveModalOpen(false);
    } finally {
      setIsActionLoading(false);
    }
  };

  const vendorQuotes = (cc.vendorQuotes || []).map((q: any) => ({
    vendorId: q.vendorId,
    vendorName: q.vendorName,
    total: q.total,
  }));

  return (
    <>
      <DocumentView
        docType="cost_comparison"
        doc={cc as any}
        userRole="project_manager"
        backHref="/dashboard/manager/cost-comparisons"
        backLabel="Back to Approval Queue"
        onAction={handleAction}
        onSelectVendor={(vId) => { setSelectedVendorForApproval(vId); setIsApproveModalOpen(true); }}
        isSelecting={cc.status === "submitted"}
        linkedDocs={{
          mr: cc.materialRequest
            ? { id: cc.materialRequestId, refNo: cc.materialRequest.refNo || "MR", status: "review_cc" }
            : undefined,
          cc: { id: cc._id, refNo: cc.refNo, status: cc.status },
        }}
      />
      <CCApproveModal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        ccRefNo={cc.refNo}
        vendorQuotes={vendorQuotes}
        initialSelectedVendorId={selectedVendorForApproval || cc.selectedVendorId}
        onConfirm={handleApproveConfirm}
        isLoading={isActionLoading}
      />
    </>
  );
}
