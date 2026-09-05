"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Camera,
  Truck,
  Building2,
  Calendar,
  ArrowRight,
} from "lucide-react";

export default function GRNDirectoryPage() {
  const { token } = useSession();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterMode, setFilterMode] = React.useState<"all" | "exact" | "discrepancy">("all");

  const grns = useQuery(api.grn.listGRNs, token ? { token } : "skip");

  const filteredGRNs = React.useMemo(() => {
    if (!grns) return [];
    return grns.filter((grn) => {
      if (filterMode === "exact" && grn.hasDiscrepancy) return false;
      if (filterMode === "discrepancy" && !grn.hasDiscrepancy) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          grn.refNo?.toLowerCase().includes(q) ||
          grn.poRefNo?.toLowerCase().includes(q) ||
          grn.dcRefNo?.toLowerCase().includes(q) ||
          grn.vendorName?.toLowerCase().includes(q) ||
          grn.siteName?.toLowerCase().includes(q) ||
          grn.confirmedByName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [grns, filterMode, searchQuery]);

  const totalGRNs = grns?.length ?? 0;
  const exactCount = grns?.filter((g) => !g.hasDiscrepancy).length ?? 0;
  const discrepancyCount = grns?.filter((g) => g.hasDiscrepancy).length ?? 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Goods Receipt Notes (GRN)
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[--success]/10 text-[--success]">
              Verified Receipts
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Official records of materials received on site with photographic unloading proof.
          </p>
        </div>

        <Link href="/dashboard/deliveries">
          <Button size="sm" variant="outline" className="text-xs gap-1.5 font-semibold">
            <Truck className="h-3.5 w-3.5" />
            Inspect Pending Deliveries
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={filterMode === "all" ? "default" : "outline"}
            onClick={() => setFilterMode("all")}
            className="text-xs h-8"
          >
            All Receipts ({totalGRNs})
          </Button>
          <Button
            size="sm"
            variant={filterMode === "exact" ? "default" : "outline"}
            onClick={() => setFilterMode("exact")}
            className="text-xs h-8 gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-[--success]" />
            Full Match ({exactCount})
          </Button>
          <Button
            size="sm"
            variant={filterMode === "discrepancy" ? "default" : "outline"}
            onClick={() => setFilterMode("discrepancy")}
            className="text-xs h-8 gap-1.5"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            Discrepancies ({discrepancyCount})
          </Button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Ref, PO, DC, Vendor, Site..."
            className="h-8.5 text-xs pl-8 bg-background"
          />
        </div>
      </div>

      {/* GRN Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {filteredGRNs.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="font-semibold text-foreground">No GRN records found</p>
            <p className="text-[11px] text-muted-foreground">
              Confirm incoming deliveries from the deliveries dashboard to generate GRNs.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-xs font-semibold py-3 px-4">GRN Ref</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3">Linked PO & DC</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3">Vendor & Site</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3 text-center">Items</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3 text-center">Photos</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3">Received By</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3 text-center">Verification</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-4 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border text-xs">
              {filteredGRNs.map((grn) => (
                <TableRow key={grn._id} className="hover:bg-muted/15 transition-colors">
                  <TableCell className="py-3 px-4 font-mono font-bold text-foreground">
                    <Link href={`/dashboard/grn/${grn._id}`} className="hover:underline text-primary">
                      {grn.refNo}
                    </Link>
                  </TableCell>
                  <TableCell className="py-3 px-3 font-mono text-[11px]">
                    <div className="font-bold text-foreground">{grn.poRefNo}</div>
                    <div className="text-muted-foreground">{grn.dcRefNo}</div>
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <div className="font-semibold text-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[140px]">{grn.vendorName}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{grn.siteName}</div>
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center font-mono font-semibold">
                    {grn.itemCount}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center">
                    <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                      <Camera className="h-3 w-3" /> {grn.photoCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 px-3 text-muted-foreground">
                    <div>{grn.confirmedByName}</div>
                    <div className="font-mono text-[10px]">
                      {new Date(grn._creationTime).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center">
                    {grn.hasDiscrepancy ? (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="h-3 w-3" /> Shortfall
                      </Badge>
                    ) : (
                      <Badge variant="default" className="text-[10px] gap-1 bg-[--success]/10 text-[--success] border-[--success]/20">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-right">
                    <Link href={`/dashboard/grn/${grn._id}`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                        View <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
