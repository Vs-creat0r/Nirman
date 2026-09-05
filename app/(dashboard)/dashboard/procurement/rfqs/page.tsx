"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { StatusBadge } from "@/components/document/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Building, FileText, ArrowRight, Clock, Users, Package } from "lucide-react";

export default function RfqsDirectoryPage() {
  const { token } = useSession();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("all");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const projects = useQuery(api.projects.listAllProjects, token ? { token } : "skip");
  const rfqs = useQuery(
    api.rfqs.listRfqs,
    token
      ? {
          projectId: selectedProjectId !== "all" ? (selectedProjectId as Id<"projects">) : undefined,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          token,
        }
      : "skip"
  );

  const filteredRfqs = React.useMemo(() => {
    if (!rfqs) return [];
    return rfqs.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          r.refNo.toLowerCase().includes(q) ||
          r.projectName.toLowerCase().includes(q) ||
          r.siteName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rfqs, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Request for Quotations (RFQs)</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Collect, compare, and manage vendor price quotes prior to Cost Comparison.
          </p>
        </div>
        <Link href="/dashboard/procurement/rfqs/new">
          <Button size="sm" className="text-xs gap-1.5 font-semibold">
            <Plus className="h-3.5 w-3.5" />
            Create RFQ
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
          <div className="w-full sm:w-48">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full h-8.5 rounded-md border border-input bg-background px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Projects</option>
              {projects?.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-36">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-8.5 rounded-md border border-input bg-background px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Ref #, Project..."
            className="h-8.5 text-xs pl-8 bg-background"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {filteredRfqs.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
            <Building className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="font-semibold text-foreground">No RFQ records found</p>
            <p className="text-[11px] text-muted-foreground">
              Create a new RFQ or adjust filter criteria above.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-xs font-semibold py-3 px-4">Ref No</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3">Project & Site</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3 text-center">Invited Vendors</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3 text-center">Items</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3 text-center">Quotes In</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3">Due Date</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-3 text-center">Status</TableHead>
                <TableHead className="text-xs font-semibold py-3 px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border text-xs">
              {filteredRfqs.map((rfq) => (
                <TableRow key={rfq._id} className="hover:bg-muted/15 transition-colors">
                  <TableCell className="py-3 px-4 font-mono font-bold text-foreground">
                    <Link
                      href={`/dashboard/procurement/rfqs/${rfq._id}`}
                      className="hover:underline text-primary"
                    >
                      {rfq.refNo}
                    </Link>
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <div className="font-semibold text-foreground">{rfq.projectName}</div>
                    <div className="text-[11px] text-muted-foreground">{rfq.siteName}</div>
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center">
                    <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                      <Users className="h-3 w-3" /> {rfq.vendorCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center">
                    <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                      <Package className="h-3 w-3" /> {rfq.itemCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center">
                    <Badge
                      variant={rfq.quotesCount > 0 ? "default" : "secondary"}
                      className="text-[10px] font-mono"
                    >
                      {rfq.quotesCount} quote{rfq.quotesCount === 1 ? "" : "s"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                    {rfq.dueDate || "—"}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center">
                    <StatusBadge status={rfq.status} docType="rfq" />
                  </TableCell>
                  <TableCell className="py-3 px-4 text-right">
                    <Link href={`/dashboard/procurement/rfqs/${rfq._id}`}>
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
