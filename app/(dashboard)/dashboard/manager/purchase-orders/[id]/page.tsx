"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentView } from "@/components/document";
import { Button } from "@/components/ui/button";

export default function ManagerPODetailPage() {
  const params = useParams();
  const { token } = useSession();
  const id = params?.id as Id<"purchase_order">;

  const po = useQuery(api.purchase_orders.getPO, id && token ? { id, token } : "skip");
  const approvePO = useMutation(api.purchase_order_approvals.approvePO);
  const rejectPO = useMutation(api.purchase_order_approvals.rejectPO);
  const queryPO = useMutation(api.purchase_order_approvals.queryPO);

  if (po === undefined) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading Purchase Order…</span>
      </div>
    );
  }

  if (po === null) {
    return (
      <div className="p-12 text-center space-y-3">
        <h2 className="text-base font-bold text-foreground">Purchase Order Not Found</h2>
        <p className="text-xs text-muted-foreground">The requested document could not be found.</p>
        <Link href="/dashboard/manager/purchase-orders">
          <Button variant="outline" size="sm" className="text-xs">Back to Approvals</Button>
        </Link>
      </div>
    );
  }

  const handleAction = async (actionName: string, note?: string) => {
    if (actionName === "approve") {
      await approvePO({ id, note, token: token || undefined });
    } else if (actionName === "reject") {
      if (!note) throw new Error("Rejection reason note is required.");
      await rejectPO({ id, note, token: token || undefined });
    } else if (actionName === "query") {
      if (!note) throw new Error("Query clarification note is required.");
      await queryPO({ id, note, token: token || undefined });
    }
  };

  return (
    <DocumentView
      docType="purchase_order"
      doc={po as any}
      userRole="project_manager"
      backHref="/dashboard/manager/purchase-orders"
      backLabel="Back to Approval Queue"
      onAction={handleAction}
      linkedDocs={{
        mr: po.materialRequest && po.materialRequestId
          ? { id: po.materialRequestId, refNo: po.materialRequest.refNo || "MR", status: "pending_po" }
          : undefined,
        cc: po.costComparisonId
          ? { id: po.costComparisonId, refNo: "CC", status: "approved" }
          : undefined,
        po: { id: po._id, refNo: po.refNo, status: po.status },
      }}
    />
  );
}
