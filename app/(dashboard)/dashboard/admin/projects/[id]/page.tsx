"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  ArrowLeft,
  Layers,
  FileSpreadsheet,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  TrendingDown,
  Search,
} from "lucide-react";
import { EditProjectItemModal } from "@/components/projects/edit-project-item-modal";
import { BoqCsvImportModal } from "@/components/projects/boq-csv-import-modal";

interface ReconciledItem {
  _id: Id<"project_items">;
  itemName: string;
  category?: string;
  subcategory?: string;
  unit: string;
  boqQty: number;
  committedQty: number;
  procuredQty: number;
  consumedQty: number;
  remainingQty: number;
  estimatedRate?: number;
  description?: string;
  isOverProcured: boolean;
  isOverCommitted: boolean;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as Id<"projects">;
  const { token } = useSession();

  const data = useQuery(
    api.project_items.getProjectBOQDetails,
    token && projectId ? { projectId, token } : "skip"
  );

  const deleteMutation = useMutation(api.project_items.deleteProjectItem);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<ReconciledItem | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const categories = React.useMemo(() => {
    if (!data?.items) return [];
    return Array.from(new Set(data.items.map((i) => i.category).filter(Boolean) as string[])).sort();
  }, [data?.items]);

  const filteredItems = React.useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item: ReconciledItem) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!item.itemName.toLowerCase().includes(q) && !item.category?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data?.items, selectedCategory, searchQuery]);

  const handleDelete = async (item: ReconciledItem) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to delete BOQ item "${item.itemName}"?`)) return;

    try {
      setDeleteError(null);
      await deleteMutation({ id: item._id, token });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete BOQ item.";
      setDeleteError(msg);
    }
  };

  if (data === undefined) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-10 bg-muted/60 animate-pulse rounded-lg w-1/3" />
        <div className="h-64 bg-muted/30 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (data === null || !data.project) {
    return (
      <div className="p-12 text-center text-xs text-muted-foreground space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="font-semibold text-foreground">Project Not Found or Access Denied</p>
        <Link href="/dashboard/admin/projects">
          <Button size="sm" variant="outline" className="text-xs">
            ← Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  const { project, sites, items, stats } = data;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/admin/projects"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects Directory
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              {project.name}
            </h1>
            <Badge variant="processing" className="text-[10px] font-mono">
              {project.code}
            </Badge>
            <Badge variant={project.status === "active" ? "success" : "draft"} className="text-[10px]">
              {project.status === "active" ? "Active Project" : project.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Client: <strong className="text-foreground">{project.client || "Direct"}</strong> · Timeline:{" "}
            <strong className="text-foreground">{project.startDate ? `${project.startDate} → ${project.endDate || "Ongoing"}` : "Active Timeline"}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCsvModalOpen(true)}
            className="text-xs gap-1.5 font-medium"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Import CSV BOQ
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingItem(null);
              setIsEditModalOpen(true);
            }}
            className="text-xs gap-1.5 font-medium shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add BOQ Item
          </Button>
        </div>
      </div>

      {deleteError && (
        <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total BOQ Line Items
            </CardTitle>
            <Layers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {stats.totalBOQItems}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Active lines defined in project scope
            </p>
          </CardContent>
        </Card>

        <Card className={stats.totalOverProcured > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Over-Procured Alerts
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.totalOverProcured > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono flex items-center gap-2">
              {stats.totalOverProcured}
              {stats.totalOverProcured > 0 && <Badge variant="danger" className="text-[10px]">Exceeds BOQ</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Items with GRN intake exceeding budget
            </p>
          </CardContent>
        </Card>

        <Card className={stats.totalOverCommitted > 0 ? "border-primary/30 bg-primary/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Over-Committed Warnings
            </CardTitle>
            <TrendingDown className={`h-4 w-4 ${stats.totalOverCommitted > 0 ? "text-primary" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono flex items-center gap-2">
              {stats.totalOverCommitted}
              {stats.totalOverCommitted > 0 && <Badge variant="pending" className="text-[10px]">PO Surplus</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Committed POs exceeding available balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Assigned Sites
            </CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {sites.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Active physical construction locations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
          {categories.length > 0 && (
            <div className="w-full sm:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-8.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search BOQ line item..."
            className="h-8.5 text-xs pl-8 bg-background"
          />
        </div>
      </div>

      {/* 4-Counter Reconciliation Grid */}
      <div className="border border-border rounded-xl bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              BOQ Reconciled Ledger (4 Side-by-Side Counters)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              BOQ Target vs Active PO Commitments vs GRN Intake vs Movement Consumption
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            {filteredItems.length} lines
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-1">
            <Boxes className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="font-semibold text-foreground">No BOQ line items found</p>
            <p className="text-muted-foreground">
              Add individual items or import a full Bill of Quantities CSV file.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Item & Category</th>
                  <th className="py-3 px-3 text-right">BOQ Target</th>
                  <th className="py-3 px-3 text-right">Committed (POs)</th>
                  <th className="py-3 px-3 text-right">Procured (GRNs)</th>
                  <th className="py-3 px-3 text-right">Consumed (Issued)</th>
                  <th className="py-3 px-3 text-right">Physical In-Stock</th>
                  <th className="py-3 px-3 text-right">Left to Order</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item: ReconciledItem) => {
                  const physicalInStock = item.procuredQty - item.consumedQty;
                  return (
                  <tr key={item._id} className="hover:bg-muted/15 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">{item.itemName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {item.category || "General"} {item.subcategory ? `· ${item.subcategory}` : ""}
                      </div>
                    </td>

                    {/* Counter 1: BOQ */}
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                      {item.boqQty}{" "}
                      <span className="text-[10px] text-muted-foreground uppercase font-normal">{item.unit}</span>
                    </td>

                    {/* Counter 2: Committed */}
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <span className={item.committedQty > 0 ? "text-foreground font-semibold" : "text-muted-foreground"}>
                        {item.committedQty}
                      </span>{" "}
                      <span className="text-[10px] text-muted-foreground uppercase font-normal">{item.unit}</span>
                    </td>

                    {/* Counter 3: Procured */}
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <span className={item.isOverProcured ? "text-destructive font-bold" : "text-foreground font-semibold"}>
                        {item.procuredQty}
                      </span>{" "}
                      <span className="text-[10px] text-muted-foreground uppercase font-normal">{item.unit}</span>
                    </td>

                    {/* Counter 4: Consumed */}
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <span className="text-foreground font-semibold">{item.consumedQty}</span>{" "}
                      <span className="text-[10px] text-muted-foreground uppercase font-normal">{item.unit}</span>
                    </td>

                    {/* Physical In-Stock (Procured - Consumed) */}
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <span className={physicalInStock < 0 ? "text-amber-600 font-semibold" : "text-foreground"}>
                        {physicalInStock}
                      </span>{" "}
                      <span className="text-[10px] text-muted-foreground uppercase font-normal">{item.unit}</span>
                    </td>

                    {/* Left to Order (BOQ Headroom) */}
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                      <span className={item.remainingQty < 0 ? "text-destructive" : "text-foreground"}>
                        {item.remainingQty}
                      </span>{" "}
                      <span className="text-[10px] text-muted-foreground uppercase font-normal">{item.unit}</span>
                    </td>

                    {/* Status Flag */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {item.isOverProcured ? (
                        <Badge variant="danger" className="text-[10px]">Over-Procured</Badge>
                      ) : item.isOverCommitted ? (
                        <Badge variant="pending" className="text-[10px]">Over-Committed</Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px]">Balanced</Badge>
                      )}
                    </td>

                    {/* Row Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingItem(item);
                            setIsEditModalOpen(true);
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(item)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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

      {/* Modals */}
      <EditProjectItemModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
        projectId={projectId}
        initialItem={editingItem}
      />

      <BoqCsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}
