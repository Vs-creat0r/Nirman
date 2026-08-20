"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  FileText,
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/document/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface DocumentRow {
  _id: string;
  refNo: string;
  projectName?: string;
  siteName?: string;
  priority?: string;
  itemCount?: number;
  status: string;
  creatorName?: string;
  _creationTime: number;
  [key: string]: unknown;
}

interface DocumentTableProps {
  title?: string;
  description?: string;
  data: DocumentRow[] | undefined;
  isLoading?: boolean;
  baseHref: string;
  newHref?: string;
  newButtonLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  showFilters?: boolean;
}

type SortField = "_creationTime" | "refNo" | "priority" | "itemCount";
type SortOrder = "asc" | "desc";

export function DocumentTable({
  title,
  description,
  data,
  isLoading,
  baseHref,
  newHref,
  newButtonLabel = "Create New",
  emptyTitle = "No records found",
  emptyDescription = "Get started by creating a new document.",
  showFilters = true,
}: DocumentTableProps) {
  const router = useRouter();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");

  // Sort state
  const [sortField, setSortField] = React.useState<SortField>("_creationTime");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Priority rank helper
  const priorityRank: Record<string, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  // Filter & Sort Pipeline
  const filteredAndSortedData = React.useMemo(() => {
    if (!data) return [];

    let result = data.filter((row) => {
      // Search text match
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        row.refNo.toLowerCase().includes(q) ||
        (row.projectName && row.projectName.toLowerCase().includes(q)) ||
        (row.siteName && row.siteName.toLowerCase().includes(q)) ||
        (row.creatorName && row.creatorName.toLowerCase().includes(q));

      // Status filter match
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;

      // Priority filter match
      const matchesPriority =
        priorityFilter === "all" ||
        (row.priority && row.priority.toLowerCase() === priorityFilter);

      return matchesSearch && matchesStatus && matchesPriority;
    });

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "_creationTime") {
        comparison = a._creationTime - b._creationTime;
      } else if (sortField === "refNo") {
        comparison = a.refNo.localeCompare(b.refNo);
      } else if (sortField === "itemCount") {
        comparison = (a.itemCount || 0) - (b.itemCount || 0);
      } else if (sortField === "priority") {
        const rankA = priorityRank[a.priority?.toLowerCase() || ""] || 0;
        const rankB = priorityRank[b.priority?.toLowerCase() || ""] || 0;
        comparison = rankA - rankB;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [data, searchTerm, statusFilter, priorityFilter, sortField, sortOrder]);

  // Unique statuses for filter options
  const uniqueStatuses = React.useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.forEach((r) => set.add(r.status));
    return Array.from(set);
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Header with Title and Action Button */}
      {(title || newHref) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {title && (
            <div>
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
          )}
          {newHref && (
            <Link href={newHref}>
              <Button size="sm" className="gap-1.5 h-8 text-xs font-semibold">
                <Plus className="h-3.5 w-3.5" />
                {newButtonLabel}
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      {showFilters && data && data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface shadow-2xs">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search reference, project, site…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8.5 pl-8 pr-7 text-xs bg-background"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            {uniqueStatuses.length > 1 && (
              <div className="flex items-center gap-1">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  {uniqueStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
        {isLoading ? (
          /* High-end Skeleton Rows */
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-10 w-full bg-muted/40 rounded animate-pulse flex items-center px-4 gap-4"
              >
                <div className="h-4 w-24 bg-muted/60 rounded" />
                <div className="h-4 w-40 bg-muted/60 rounded" />
                <div className="h-4 w-16 bg-muted/60 rounded" />
                <div className="h-4 w-20 bg-muted/60 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          /* Empty State */
          <div className="p-14 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">{emptyTitle}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {emptyDescription}
              </p>
            </div>
            {newHref && (
              <Link href={newHref} className="mt-2">
                <Button size="sm" variant="outline" className="text-xs h-8">
                  {newButtonLabel}
                </Button>
              </Link>
            )}
          </div>
        ) : filteredAndSortedData.length === 0 ? (
          /* Search no results */
          <div className="p-10 text-center space-y-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">
              No matching records found
            </p>
            <p>Try adjusting your search or clearing the status filter.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setPriorityFilter("all");
              }}
              className="text-xs mt-2"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  {/* Reference Column Header */}
                  <th
                    onClick={() => handleSort("refNo")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Reference</span>
                      {sortField === "refNo" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  <th className="py-3 px-4">Project & Site</th>

                  {/* Items Count Column Header */}
                  <th
                    onClick={() => handleSort("itemCount")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Items</span>
                      {sortField === "itemCount" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Priority Column Header */}
                  <th
                    onClick={() => handleSort("priority")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Priority</span>
                      {sortField === "priority" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Date Column Header */}
                  <th
                    onClick={() => handleSort("_creationTime")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date</span>
                      {sortField === "_creationTime" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAndSortedData.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => router.push(`${baseHref}/${row._id}`)}
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-foreground tabular-nums">
                      <Link
                        href={`${baseHref}/${row._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline flex items-center gap-1.5 text-primary"
                      >
                        {row.refNo}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">
                        {row.projectName || "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {row.siteName || "—"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-foreground font-mono font-medium tabular-nums">
                      {row.itemCount ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      {row.priority ? (
                        <span
                          className={`capitalize font-semibold text-[11px] ${
                            row.priority === "urgent"
                              ? "text-rose-500 font-bold"
                              : row.priority === "high"
                              ? "text-amber-500"
                              : "text-muted-foreground"
                          }`}
                        >
                          {row.priority}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] tabular-nums">
                      {formatDate(row._creationTime)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="text-muted-foreground group-hover:text-foreground inline-flex items-center">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer with Record Counts */}
        {filteredAndSortedData.length > 0 && data && (
          <div className="py-2.5 px-4 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Showing <strong className="text-foreground">{filteredAndSortedData.length}</strong> of{" "}
              <strong className="text-foreground">{data.length}</strong>{" "}
              {data.length === 1 ? "document" : "documents"}
            </span>
            <span className="font-mono text-[10px]">
              Sorted by {sortField.replace("_", "")} ({sortOrder.toUpperCase()})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
