"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  Boxes,
  Truck,
  ClipboardCheck,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function InventoryPage() {
  const { token } = useSession();

  const grns = useQuery(api.grn.listGRNs, token ? { token } : "skip");
  const projectItems = useQuery(api.project_items.listProjectItems, token ? { token } : "skip");

  const totalReceivedItems = React.useMemo(() => {
    if (!grns) return 0;
    return grns.reduce((acc: number, g: any) => acc + (g.itemCount || 0), 0);
  }, [grns]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              Site & Warehouse Inventory
            </h1>
            <Badge variant="processing">Sprint 2 Feature</Badge>
          </div>
          <p className="text-xs text-muted-foreground select-none mt-1">
            Real-time stock ledger & automated material reorder thresholds across active sites.
          </p>
        </div>

        <Link href="/dashboard/grn">
          <Button size="sm" variant="outline" className="text-xs gap-1.5 font-medium">
            <ClipboardCheck className="h-3.5 w-3.5" />
            View GRN Goods Receipts
          </Button>
        </Link>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-1 text-xs">
          <h3 className="font-semibold text-foreground">
            Inventory Management Module (Roadmap)
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            Per the Nirman Sprint Plan, live physical inventory is populated via verified Goods Receipt Notes (GRN).
            Below is the current procurement intake summary received on site.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Total Receipts Checked In
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {grns ? grns.length : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {totalReceivedItems} total line item batches received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Master BOQ Catalog Items
            </CardTitle>
            <Boxes className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {projectItems ? projectItems.length : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Active project specification items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Warehouse Tracking
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold tracking-tight text-foreground">
              Automated Intake Active
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Fed continuously by GRN confirmations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent On-Site Deliveries Intake */}
      <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden space-y-0">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Recent On-Site Material Receipts
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Verified goods received across project sites
            </p>
          </div>
          <Link
            href="/dashboard/grn"
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {grns === undefined ? (
          <div className="p-6 space-y-2">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-8 bg-muted/60 animate-pulse rounded" />
          </div>
        ) : grns.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No received materials recorded yet. Deliveries confirmed with photo proof will show up here.
          </div>
        ) : (
          <div className="divide-y divide-border text-xs">
            {grns.slice(0, 5).map((grn: any) => (
              <div key={grn._id} className="p-3.5 flex items-center justify-between hover:bg-muted/20">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{grn.refNo}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-medium text-foreground">{grn.vendorName}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Delivered to: <strong className="text-foreground">{grn.siteName}</strong> · PO: {grn.poRefNo} ({grn.itemCount} items)
                  </p>
                </div>
                <div className="text-right font-mono text-[11px] text-muted-foreground">
                  {new Date(grn.deliveredAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
