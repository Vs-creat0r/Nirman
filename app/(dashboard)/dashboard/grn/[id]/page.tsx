"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentView } from "@/components/document/document-view";
import { PhotoGrid } from "@/components/document/field-renderers/photo-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Camera, CheckCircle2 } from "lucide-react";

export default function GrnDetailPage() {
  const params = useParams();
  const id = params.id as Id<"grn">;
  const { token } = useSession();

  const grn = useQuery(api.grn.getGRN, token && id ? { id, token } : "skip");

  if (grn === undefined) {
    return <div className="p-8"><div className="h-64 bg-muted/40 animate-pulse rounded-xl" /></div>;
  }
  if (!grn) {
    return (
      <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="font-bold text-foreground">GRN Record Not Found</p>
        <Link href="/dashboard/grn"><Button size="sm" variant="outline" className="text-xs">← Back to GRN Directory</Button></Link>
      </div>
    );
  }

  const lineItems = (grn.receivedItems || []).map((it) => ({
    itemName: it.itemName,
    quantity: it.receivedQty,
    unit: it.unit,
    description: `Expected: ${it.expectedQty} ${it.unit}${it.receivedQty < it.expectedQty ? ` (Shortfall: ${it.expectedQty - it.receivedQty})` : " (Fully Received)"}`,
  }));

  const photos = (grn.photoUrls || []).map((p, idx) => ({
    id: p.storageId,
    url: p.url || "",
    label: `Unloading Proof #${idx + 1}`,
  }));

  return (
    <div className="space-y-4">
      <DocumentView
        docType="grn"
        doc={{
          ...grn,
          status: "delivered",
          vendorName: grn.vendor?.name,
          siteName: grn.site?.name,
          creatorName: grn.confirmedByUser?.name,
          items: lineItems,
          lineItems,
        }}
        linkedDocs={{
          po: grn.po ? { id: grn.po._id, refNo: grn.po.refNo, status: grn.po.status } : undefined,
          dc: grn.dc ? { id: grn.dc._id, refNo: grn.dc.refNo, status: grn.dc.status } : undefined,
          mr: grn.mr ? { id: grn.mr._id, refNo: grn.mr.refNo, status: grn.mr.status } : undefined,
          cc: grn.cc ? { id: grn.cc._id, refNo: grn.cc.refNo, status: grn.cc.status } : undefined,
        }}
        backHref="/dashboard/grn"
      >
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" /> Delivery Proof Photos ({photos.length})
            </h3>
            {grn.hasDiscrepancy ? (
              <Badge variant="danger" className="text-[10px] gap-1">
                <AlertTriangle className="h-3 w-3" /> Quantity Discrepancy Flagged
              </Badge>
            ) : (
              <Badge variant="success" className="text-[10px] gap-1 bg-[--success]/10 text-[--success] border-[--success]/20">
                <CheckCircle2 className="h-3 w-3" /> Full Delivery Verified
              </Badge>
            )}

          </div>

          <PhotoGrid photos={photos} />
        </div>
      </DocumentView>
    </div>
  );
}
