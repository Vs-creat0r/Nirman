"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import { StatusBadge } from "@/components/document/status-badge";
import { DocumentLineageBar } from "@/components/document/document-lineage-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Camera,
  Truck,
  Building2,
  Package,
  Calendar,
  Eye,
  X,
  ExternalLink,
  FileText,
  User,
  ShieldCheck,
} from "lucide-react";

export default function GRNPage() {
  const { role } = useRole();
  const { token } = useSession();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterMode, setFilterMode] = React.useState<"all" | "exact" | "discrepancy">("all");
  const [selectedGRNId, setSelectedGRNId] = React.useState<any | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = React.useState<string | null>(null);

  const grns = useQuery(
    api.grn.listGRNs,
    token ? { token } : "skip"
  );

  const selectedGRNDetails = useQuery(
    api.grn.getGRN,
    selectedGRNId && token ? { id: selectedGRNId, token } : "skip"
  );

  // Filtered GRNs
  const filteredGRNs = React.useMemo(() => {
    if (!grns) return [];
    return grns.filter((grn) => {
      // Filter mode
      if (filterMode === "exact" && grn.hasDiscrepancy) return false;
      if (filterMode === "discrepancy" && !grn.hasDiscrepancy) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRef = grn.refNo?.toLowerCase().includes(q);
        const matchPo = grn.poRefNo?.toLowerCase().includes(q);
        const matchDc = grn.dcRefNo?.toLowerCase().includes(q);
        const matchVendor = grn.vendorName?.toLowerCase().includes(q);
        const matchSite = grn.siteName?.toLowerCase().includes(q);
        const matchReceiver = grn.confirmedByName?.toLowerCase().includes(q);
        if (!matchRef && !matchPo && !matchDc && !matchVendor && !matchSite && !matchReceiver) {
          return false;
        }
      }

      return true;
    });
  }, [grns, filterMode, searchQuery]);

  // Counts
  const totalGRNs = grns?.length ?? 0;
  const exactCount = grns?.filter((g) => !g.hasDiscrepancy).length ?? 0;
  const discrepancyCount = grns?.filter((g) => g.hasDiscrepancy).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              Goods Receipt Notes (GRN)
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[--success]/10 text-[--success]">
              Verified Receipts
            </span>
          </div>
          <p className="text-xs text-muted-foreground select-none mt-1">
            Official records of materials received on site with photographic unloading proof.
          </p>
        </div>

        <Link href="/dashboard/deliveries">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
            <Truck className="h-3.5 w-3.5" />
            View Deliveries & Dispatch
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Total Receipts (GRN)
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {grns ? totalGRNs : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Confirmed on-site deliveries
            </p>
          </CardContent>
        </Card>

        <Card className={exactCount > 0 ? "border-[--success]/30 bg-[--success]/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Verified Exact Match
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-[--success]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono text-[--success]">
              {grns ? exactCount : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              100% quantity match on delivery
            </p>
          </CardContent>
        </Card>

        <Card className={discrepancyCount > 0 ? "border-[--warning]/30 bg-[--warning]/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Discrepancies Logged
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 ${discrepancyCount > 0 ? "text-[--warning] animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {grns ? discrepancyCount : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Quantity variance recorded on arrival
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface border border-border">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filterMode === "all"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All GRNs ({totalGRNs})
          </button>
          <button
            onClick={() => setFilterMode("exact")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filterMode === "exact"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[--success]" />
            Exact Match ({exactCount})
          </button>
          <button
            onClick={() => setFilterMode("discrepancy")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filterMode === "discrepancy"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[--warning]" />
            With Variance ({discrepancyCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by GRN, PO, site, or vendor…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
      </div>

      {/* Table Content */}
      {grns === undefined ? (
        <div className="space-y-2">
          <div className="h-10 w-full bg-muted/60 animate-pulse rounded" />
          <div className="h-10 w-full bg-muted/40 animate-pulse rounded" />
          <div className="h-10 w-full bg-muted/20 animate-pulse rounded" />
        </div>
      ) : filteredGRNs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-surface/30 space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-[--success]/10 text-[--success] flex items-center justify-center">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No Goods Receipt Notes</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? "No GRN records match your search query."
              : "Goods Receipt Notes are automatically generated when on-site deliveries are confirmed."}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 border-b border-border text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">GRN Reference</th>
                  <th className="px-4 py-3">PO & Challan</th>
                  <th className="px-4 py-3">Destination Site</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Verification Status</th>
                  <th className="px-4 py-3">Unloading Proof</th>
                  <th className="px-4 py-3">Confirmed By</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredGRNs.map((grn: any) => (
                  <tr key={grn._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-foreground">
                        {grn.refNo}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {new Date(grn.deliveredAt).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-mono">
                      <span className="text-foreground">{grn.poRefNo}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        Challan: {grn.dcRefNo}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{grn.siteName}</span>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {grn.vendorName}
                    </td>

                    <td className="px-4 py-3">
                      {grn.hasDiscrepancy ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[--warning]/10 text-[--warning]">
                          <AlertTriangle className="h-3 w-3" /> Variance
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[--success]/10 text-[--success]">
                          <CheckCircle2 className="h-3 w-3" /> Verified Exact
                        </span>
                      )}
                      <span className="block text-[10px] text-muted-foreground mt-0.5">
                        {grn.itemCount} items checked
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {grn.firstPhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={grn.firstPhotoUrl}
                            alt="Proof thumbnail"
                            className="h-8 w-8 rounded object-cover border border-border shrink-0 cursor-pointer hover:opacity-80"
                            onClick={() => setLightboxImageUrl(grn.firstPhotoUrl)}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            <Camera className="h-4 w-4" />
                          </div>
                        )}
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {grn.photoCount} {grn.photoCount === 1 ? "photo" : "photos"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">
                        {grn.confirmedByName}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {new Date(grn.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedGRNId(grn._id)}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Report
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspection Sheet Details Modal */}
      {selectedGRNId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-[--success]/10 text-[--success] flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-foreground font-mono">
                      {selectedGRNDetails?.refNo || "Goods Receipt Note"}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[--success]/15 text-[--success]">
                      DELIVERED
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Physical Goods Inspection & Unloading Certificate
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedGRNId(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            {selectedGRNDetails ? (
              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                {/* Lineage bar */}
                <div className="p-3 bg-surface/50 rounded-lg border border-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                    Procurement Spine Lineage
                  </span>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    {selectedGRNDetails.mr && (
                      <>
                        <span className="px-2 py-1 bg-card rounded border border-border text-foreground">
                          MR: {selectedGRNDetails.mr.refNo}
                        </span>
                        <span className="text-muted-foreground">→</span>
                      </>
                    )}
                    {selectedGRNDetails.po && (
                      <>
                        <span className="px-2 py-1 bg-card rounded border border-border text-foreground">
                          PO: {selectedGRNDetails.po.refNo}
                        </span>
                        <span className="text-muted-foreground">→</span>
                      </>
                    )}
                    {selectedGRNDetails.dc && (
                      <>
                        <span className="px-2 py-1 bg-card rounded border border-border text-foreground">
                          DC: {selectedGRNDetails.dc.refNo}
                        </span>
                        <span className="text-muted-foreground">→</span>
                      </>
                    )}
                    <span className="px-2 py-1 bg-[--success]/10 text-[--success] rounded border border-[--success]/30 font-bold">
                      GRN: {selectedGRNDetails.refNo}
                    </span>
                  </div>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-border bg-surface/30">
                  <div>
                    <span className="text-muted-foreground">Vendor:</span>
                    <p className="font-semibold text-foreground">
                      {selectedGRNDetails.vendor?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Site:</span>
                    <p className="font-semibold text-foreground">
                      {selectedGRNDetails.site?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delivered Date:</span>
                    <p className="font-mono text-foreground">
                      {new Date(selectedGRNDetails.deliveredAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Received By:</span>
                    <p className="font-semibold text-foreground">
                      {selectedGRNDetails.confirmedUser?.name || "—"}
                    </p>
                  </div>
                  {selectedGRNDetails.invoiceNumber && (
                    <div>
                      <span className="text-muted-foreground">Invoice No:</span>
                      <p className="font-mono font-medium text-foreground">
                        {selectedGRNDetails.invoiceNumber}
                      </p>
                    </div>
                  )}
                  {selectedGRNDetails.dc?.vehicleNo && (
                    <div>
                      <span className="text-muted-foreground">Vehicle:</span>
                      <p className="font-mono font-medium text-foreground">
                        {selectedGRNDetails.dc.vehicleNo}
                      </p>
                    </div>
                  )}
                  {selectedGRNDetails.dc?.driverName && (
                    <div>
                      <span className="text-muted-foreground">Driver:</span>
                      <p className="font-medium text-foreground">
                        {selectedGRNDetails.dc.driverName}
                      </p>
                    </div>
                  )}
                </div>

                {/* Physical Quantity Verification Table */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    Physical Item Verification ({selectedGRNDetails.receivedItems?.length || 0})
                  </h3>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground font-semibold">
                        <tr>
                          <th className="px-3 py-2">Item Name</th>
                          <th className="px-3 py-2 text-right">Dispatched / Expected</th>
                          <th className="px-3 py-2 text-right">Received on Site</th>
                          <th className="px-3 py-2 text-right">Variance</th>
                          <th className="px-3 py-2">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selectedGRNDetails.receivedItems?.map((item: any, idx: number) => {
                          const variance = item.receivedQty - item.expectedQty;
                          const isExact = variance === 0;
                          return (
                            <tr
                              key={idx}
                              className={isExact ? "hover:bg-muted/20" : "bg-[--warning]/5"}
                            >
                              <td className="px-3 py-2 font-medium text-foreground">
                                {item.itemName}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                                {item.expectedQty}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                                {item.receivedQty}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold">
                                {isExact ? (
                                  <span className="text-[--success]">0</span>
                                ) : (
                                  <span className="text-[--warning]">
                                    {variance > 0 ? `+${variance}` : variance}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{item.unit}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Proof Photos Gallery */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-primary" />
                    Unloading Proof Photos ({selectedGRNDetails.photoUrls?.length || 0})
                  </h3>

                  {selectedGRNDetails.photoUrls && selectedGRNDetails.photoUrls.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {selectedGRNDetails.photoUrls.map((photo: any, i: number) => (
                        <div
                          key={i}
                          onClick={() => setLightboxImageUrl(photo.url)}
                          className="relative rounded-lg overflow-hidden border border-border bg-surface aspect-square group cursor-pointer hover:border-primary transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt={`Proof photo ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Eye className="h-5 w-5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No photos available.</p>
                  )}
                </div>

                {/* Remarks */}
                {selectedGRNDetails.remarks && (
                  <div className="p-3 rounded-lg border border-border bg-surface/30">
                    <span className="font-semibold text-foreground block mb-1">
                      Receiver Remarks:
                    </span>
                    <p className="text-muted-foreground italic">
                      {selectedGRNDetails.remarks}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                <span>Loading Goods Receipt Note...</span>
              </div>
            )}

            <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedGRNId(null)}
                className="text-xs"
              >
                Close Certificate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-black">
            <button
              onClick={() => setLightboxImageUrl(null)}
              className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImageUrl}
              alt="Full size proof"
              className="w-auto h-auto max-h-[85vh] max-w-full object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
