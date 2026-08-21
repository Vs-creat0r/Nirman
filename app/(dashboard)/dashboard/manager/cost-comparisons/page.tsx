"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { StatusBadge } from "@/components/document/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  FileBarChart2,
  CheckCircle2,
  Clock,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ManagerCostComparisonsPage() {
  const { token } = useSession();

  const ccs = useQuery(
    api.cost_comparisons.listCCs,
    token ? { token } : "skip"
  );

  const [statusFilter, setStatusFilter] = React.useState<string>("submitted");
  const [searchQuery, setSearchQuery] = React.useState("");

  const pendingCount = (ccs || []).filter((cc) => cc.status === "submitted").length;

  const filteredCCs = (ccs || []).filter((cc) => {
    if (statusFilter !== "all" && cc.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      cc.refNo.toLowerCase().includes(q) ||
      cc.materialRequestRefNo.toLowerCase().includes(q) ||
      cc.projectName.toLowerCase().includes(q) ||
      cc.vendorNames.some((v) => v.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-foreground">
              Cost Comparisons Approval Queue
            </h1>
            {pendingCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                {pendingCount} Pending Review
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review submitted vendor quotation matrices, evaluate commercial terms, and approve winning vendors.
          </p>
        </div>
      </div>

      {/* ── Filters and Search ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border text-xs overflow-x-auto max-w-full">
          {[
            { label: `Pending Review (${pendingCount})`, value: "submitted" },
            { label: "All Comparisons", value: "all" },
            { label: "Approved", value: "approved" },
            { label: "Queried", value: "queried" },
            { label: "Rejected", value: "rejected" },
            { label: "Drafts", value: "draft" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === tab.value
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search box */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search CC ref, MR, vendor…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* ── CCs List Table ── */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-3 px-3.5">Reference</th>
              <th className="py-3 px-3">Material Request</th>
              <th className="py-3 px-3">Project</th>
              <th className="py-3 px-3 text-center">Quotes</th>
              <th className="py-3 px-3 text-right">Lowest Total</th>
              <th className="py-3 px-3">Selected Vendor</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ccs === undefined ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading Cost Comparisons…
                </td>
              </tr>
            ) : filteredCCs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground space-y-2">
                  <FileBarChart2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="font-medium text-foreground">No Cost Comparisons in this queue</p>
                  <p className="text-[11px]">
                    {statusFilter === "submitted"
                      ? "All submitted Cost Comparisons have been reviewed."
                      : `No comparisons matching status "${statusFilter}".`}
                  </p>
                </td>
              </tr>
            ) : (
              filteredCCs.map((cc) => (
                <tr key={cc._id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-3.5 font-mono font-bold text-foreground">
                    <Link
                      href={`/dashboard/manager/cost-comparisons/${cc._id}`}
                      className="hover:underline text-primary"
                    >
                      {cc.refNo}
                    </Link>
                  </td>
                  <td className="py-3 px-3 font-mono text-muted-foreground">
                    {cc.materialRequestRefNo}
                  </td>
                  <td className="py-3 px-3 font-medium text-foreground">
                    {cc.projectName}
                  </td>
                  <td className="py-3 px-3 text-center font-mono">
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                      {cc.quoteCount} vendors
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                    ₹{cc.minTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 font-medium">
                    {cc.selectedVendorName ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {cc.selectedVendorName}
                      </span>
                    ) : (
                      <span className="text-amber-500 text-[11px] font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Selection Required
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={cc.status} />
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <Link href={`/dashboard/manager/cost-comparisons/${cc._id}`}>
                      <Button
                        size="sm"
                        variant={cc.status === "submitted" ? "primary" : "outline"}
                        className="h-7 text-xs px-2.5 font-semibold"
                      >
                        {cc.status === "submitted" ? "Review & Select" : "View"}
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
