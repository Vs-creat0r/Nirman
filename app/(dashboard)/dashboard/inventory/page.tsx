"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Boxes,
  ClipboardCheck,
  AlertTriangle,
  PackageMinus,
  ArrowRightLeft,
  Scale,
  Search,
  History,
  Building2,
  AlertCircle,
} from "lucide-react";
import { IssueStockModal } from "@/components/inventory/issue-stock-modal";
import { TransferStockModal } from "@/components/inventory/transfer-stock-modal";
import { AdjustStockModal } from "@/components/inventory/adjust-stock-modal";
import { ItemLedgerModal } from "@/components/inventory/item-ledger-modal";

interface InventoryItem {
  _id: Id<"inventory">;
  itemName: string;
  category?: string;
  quantity: number;
  unit: string;
  siteId?: Id<"sites">;
  reorderLevel?: number;
  lastUpdated?: string;
}

export default function InventoryPage() {
  const { token } = useSession();
  const currentUser = useQuery(api.users.getMyUser, token ? { token } : "skip");
  const sites = useQuery(api.sites.listSites, token ? { token } : "skip");

  // Filters & State
  const [selectedSiteId, setSelectedSiteId] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "low" | "negative">("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Modals state
  const [isIssueOpen, setIsIssueOpen] = React.useState(false);
  const [isTransferOpen, setIsTransferOpen] = React.useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = React.useState(false);
  const [activeLedger, setActiveLedger] = React.useState<{ siteId: Id<"sites">; itemName: string } | null>(null);
  const [quickIssue, setQuickIssue] = React.useState<{ siteId: Id<"sites">; itemName: string } | null>(null);

  // Queries
  const inventory = useQuery(
    api.movements.getSiteInventory,
    token ? { siteId: selectedSiteId ? (selectedSiteId as Id<"sites">) : undefined, token } : "skip"
  );
  const movements = useQuery(
    api.movements.listStockMovements,
    token ? { siteId: selectedSiteId ? (selectedSiteId as Id<"sites">) : undefined, limit: 100, token } : "skip"
  );

  const categories = React.useMemo(() => {
    if (!inventory) return [];
    return Array.from(new Set(inventory.map((i) => i.category).filter(Boolean) as string[])).sort();
  }, [inventory]);

  const filtered = React.useMemo(() => {
    if (!inventory) return [];
    return inventory.filter((i: InventoryItem) => {
      if (selectedCategory !== "all" && i.category !== selectedCategory) return false;
      const reorder = i.reorderLevel ?? 10;
      if (statusFilter === "negative" && i.quantity >= 0) return false;
      if (statusFilter === "low" && (i.quantity > reorder || i.quantity < 0)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!i.itemName.toLowerCase().includes(q) && !i.category?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [inventory, selectedCategory, statusFilter, searchQuery]);

  const lowStockCount = inventory?.filter((i) => i.quantity >= 0 && i.quantity <= (i.reorderLevel ?? 10)).length ?? 0;
  const negativeStockCount = inventory?.filter((i) => i.quantity < 0).length ?? 0;
  const canManageStock = ["admin", "project_manager", "site_supervisor"].includes(currentUser?.role || "");
  const canTransferOrAdjust = ["admin", "project_manager"].includes(currentUser?.role || "");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              Site & Warehouse Inventory
            </h1>
            <Badge variant="success" className="text-[10px]">
              Live Stock Ledger
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground select-none mt-1">
            Real-time physical stock on hand, automated reorder thresholds, and immutable ledger movements.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManageStock && (
            <Button size="sm" onClick={() => { setQuickIssue(null); setIsIssueOpen(true); }} className="text-xs gap-1.5 font-medium shadow-xs">
              <PackageMinus className="h-3.5 w-3.5" /> Issue Stock
            </Button>
          )}
          {canTransferOrAdjust && (
            <>
              <Button size="sm" variant="outline" onClick={() => setIsTransferOpen(true)} className="text-xs gap-1.5 font-medium">
                <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsAdjustOpen(true)} className="text-xs gap-1.5 font-medium">
                <Scale className="h-3.5 w-3.5" /> Audit Count
              </Button>
            </>
          )}
          <Link href="/dashboard/grn">
            <Button size="sm" variant="ghost" className="text-xs gap-1 font-medium text-muted-foreground">
              <ClipboardCheck className="h-3.5 w-3.5" /> GRN Intake
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">On-Hand SKUs</CardTitle>
            <Boxes className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">{inventory ? inventory.length : "—"}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Active inventory items across sites</p>
          </CardContent>
        </Card>

        <Card className={lowStockCount > 0 ? "border-primary/30 bg-primary/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Below Reorder</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${lowStockCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono flex items-center gap-2">
              {inventory ? lowStockCount : "—"}
              {lowStockCount > 0 && <Badge variant="pending" className="text-[10px]">Reorder Needed</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Items at or below safety threshold</p>
          </CardContent>
        </Card>

        <Card className={negativeStockCount > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Negative Stock</CardTitle>
            <AlertCircle className={`h-4 w-4 ${negativeStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono flex items-center gap-2">
              {inventory ? negativeStockCount : "—"}
              {negativeStockCount > 0 && <Badge variant="danger" className="text-[10px]">Deficit Alert</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Consumption exceeding intake</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ledger Movements</CardTitle>
            <History className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">{movements ? movements.length : "—"}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Recent receipts, issues & transfers</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
          <div className="w-full sm:w-48">
            <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)} className="w-full h-8.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">All Assigned Sites</option>
              {sites?.map((s) => (<option key={s._id} value={s._id}>{s.name} ({s.code})</option>))}
            </select>
          </div>
          {categories.length > 0 && (
            <div className="w-full sm:w-40">
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full h-8.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="all">All Categories</option>
                {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 text-xs">
            {(["all", "low", "negative"] as const).map((st) => (
              <button key={st} type="button" onClick={() => setStatusFilter(st)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${statusFilter === st ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>
                {st === "all" ? "All Stock" : st === "low" ? "Low Stock" : "Negative"}
              </button>
            ))}
          </div>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search material SKU..." className="h-8.5 text-xs pl-8 bg-background" />
        </div>
      </div>

      {/* Stock Table */}
      <div className="border border-border rounded-xl bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Current Physical Stock on Hand</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Derived automatically from single-writer movement ledger</p>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">{filtered.length} items shown</span>
        </div>

        {inventory === undefined ? (
          <div className="p-8 space-y-3">
            <div className="h-9 bg-muted/60 animate-pulse rounded-lg" />
            <div className="h-9 bg-muted/40 animate-pulse rounded-lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-1">
            <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="font-semibold text-foreground">No inventory records found</p>
            <p className="text-muted-foreground">Receive materials via Goods Receipt Notes (GRN) to populate stock.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Material Item & Category</th>
                  <th className="py-3 px-4">Site</th>
                  <th className="py-3 px-4 text-right">On-Hand Quantity</th>
                  <th className="py-3 px-4 text-right">Reorder Level</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item: InventoryItem) => {
                  const siteName = sites?.find((s) => s._id === item.siteId)?.name || item.siteId || "—";
                  const reorder = item.reorderLevel ?? 10;
                  const isNegative = item.quantity < 0;
                  const isLow = !isNegative && item.quantity <= reorder;

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-muted/15 transition-colors cursor-pointer"
                      onClick={() => {
                        if (item.siteId) setActiveLedger({ siteId: item.siteId as Id<"sites">, itemName: item.itemName });
                      }}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{item.itemName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{item.category || "General Materials"}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {siteName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span className={`text-sm ${isNegative ? "text-destructive" : isLow ? "text-primary" : "text-foreground"}`}>
                          {item.quantity}
                        </span>{" "}
                        <span className="text-[10px] text-muted-foreground uppercase font-normal">{item.unit}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground whitespace-nowrap">
                        {reorder} <span className="text-[10px] uppercase font-normal">{item.unit}</span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isNegative ? (
                          <Badge variant="danger" className="text-[10px]">Deficit ({item.quantity})</Badge>
                        ) : isLow ? (
                          <Badge variant="pending" className="text-[10px]">Low Stock</Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">In Stock</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (item.siteId) setActiveLedger({ siteId: item.siteId as Id<"sites">, itemName: item.itemName });
                            }}
                            className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <History className="h-3 w-3" /> Ledger
                          </Button>
                          {canManageStock && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (item.siteId) {
                                  setQuickIssue({ siteId: item.siteId as Id<"sites">, itemName: item.itemName });
                                  setIsIssueOpen(true);
                                }
                              }}
                              className="h-7 px-2 text-[11px] gap-1"
                            >
                              <PackageMinus className="h-3 w-3" /> Issue
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IssueStockModal isOpen={isIssueOpen} onClose={() => { setIsIssueOpen(false); setQuickIssue(null); }} defaultSiteId={quickIssue?.siteId} defaultItemName={quickIssue?.itemName} />
      <TransferStockModal isOpen={isTransferOpen} onClose={() => setIsTransferOpen(false)} defaultSourceSiteId={selectedSiteId ? (selectedSiteId as Id<"sites">) : undefined} />
      <AdjustStockModal isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} defaultSiteId={selectedSiteId ? (selectedSiteId as Id<"sites">) : undefined} />
      <ItemLedgerModal isOpen={!!activeLedger} onClose={() => setActiveLedger(null)} siteId={activeLedger?.siteId ?? null} itemName={activeLedger?.itemName ?? null} />
    </div>
  );
}
