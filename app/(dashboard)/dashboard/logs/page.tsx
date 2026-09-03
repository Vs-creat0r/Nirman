"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import { StatusBadge } from "@/components/document/status-badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  User,
  Clock,
  FileText,
  FileBarChart2,
  ShoppingBag,
  Truck,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function SystemLogsPage() {
  const { role } = useRole();
  const { token } = useSession();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedDocType, setSelectedDocType] = React.useState("all");
  const [selectedRole, setSelectedRole] = React.useState("all");

  const logs = useQuery(
    api.logs.listAllLogs,
    token
      ? {
          documentType: selectedDocType !== "all" ? selectedDocType : undefined,
          actorRole: selectedRole !== "all" ? selectedRole : undefined,
          referenceId: searchQuery.trim() || undefined,
          token,
        }
      : "skip"
  );

  // Helper to map document reference to the most appropriate destination link
  const getDocumentHref = (docType: string, refId: string) => {
    if (refId.startsWith("MR-") || docType === "material_request") {
      return role === "site_supervisor"
        ? "/dashboard/supervisor/material-requests"
        : "/dashboard/manager/material-requests";
    }
    if (refId.startsWith("CC-") || docType === "cost_comparison") {
      return role === "project_manager"
        ? "/dashboard/manager/cost-comparisons"
        : "/dashboard/procurement/cost-comparisons";
    }
    if (refId.startsWith("PO-") || docType === "purchase_order") {
      return role === "project_manager"
        ? "/dashboard/manager/purchase-orders"
        : "/dashboard/procurement/purchase-orders";
    }
    if (refId.startsWith("DC-") || docType === "delivery_challan") {
      return "/dashboard/deliveries";
    }
    if (refId.startsWith("GRN-") || docType === "grn") {
      return "/dashboard/grn";
    }
    if (docType === "vendors") {
      return "/dashboard/procurement/vendors";
    }
    return null;
  };

  // Helper to get doc icon
  const getDocIcon = (docType: string) => {
    switch (docType) {
      case "material_request":
        return <FileText className="h-3.5 w-3.5 text-[--info]" />;
      case "cost_comparison":
        return <FileBarChart2 className="h-3.5 w-3.5 text-purple-500" />;
      case "purchase_order":
        return <ShoppingBag className="h-3.5 w-3.5 text-[--warning]" />;
      case "delivery_challan":
        return <Truck className="h-3.5 w-3.5 text-[--info]" />;
      case "grn":
        return <ClipboardCheck className="h-3.5 w-3.5 text-[--success]" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const totalLogsCount = logs?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              System Audit Logs
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Immutable Audit Trail
            </span>
          </div>
          <p className="text-xs text-muted-foreground select-none mt-1">
            Complete cryptographic audit trail of all document state changes, manager reviews, and logistics confirmations.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Reference Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by Reference ID (e.g. MR-2026, PO-2026, DC-2026, GRN-2026)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>

          {/* Document Type Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="h-8 px-2.5 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Document Types</option>
              <option value="material_request">Material Requests (MR)</option>
              <option value="cost_comparison">Cost Comparisons (CC)</option>
              <option value="purchase_order">Purchase Orders (PO)</option>
              <option value="delivery_challan">Delivery Challans (DC)</option>
              <option value="grn">Goods Receipts (GRN)</option>
              <option value="vendors">Vendors</option>
              <option value="projects">Projects</option>
            </select>

            {/* Actor Role Filter */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-8 px-2.5 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Roles</option>
              <option value="site_supervisor">Site Supervisor</option>
              <option value="project_manager">Project Manager</option>
              <option value="procurement_officer">Procurement Officer</option>
              <option value="admin">System Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table / Timeline */}
      {logs === undefined ? (
        <div className="p-8 border border-border rounded-xl bg-card space-y-3">
          <div className="h-6 w-1/3 bg-muted animate-pulse rounded" />
          <div className="h-10 w-full bg-muted/60 animate-pulse rounded" />
          <div className="h-10 w-full bg-muted/40 animate-pulse rounded" />
          <div className="h-10 w-full bg-muted/20 animate-pulse rounded" />
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-surface/30 space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Activity className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No audit entries found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery || selectedDocType !== "all" || selectedRole !== "all"
              ? "No system logs match your selected filter criteria."
              : "System audit logs will automatically record here as workflows execute."}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 border-b border-border text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor & Role</th>
                  <th className="px-4 py-3">Document Reference</th>
                  <th className="px-4 py-3">Action / Event</th>
                  <th className="px-4 py-3">State Transition</th>
                  <th className="px-4 py-3">Remarks / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log: any) => {
                  const href = getDocumentHref(log.documentType, log.referenceId);
                  return (
                    <tr key={log._id} className="hover:bg-muted/30 transition-colors">
                      {/* Timestamp */}
                      <td className="px-4 py-3 text-muted-foreground font-mono">
                        <span className="text-foreground font-medium">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-accent text-accent-foreground font-bold text-[10px] flex items-center justify-center shrink-0">
                            {log.actorName?.substring(0, 2).toUpperCase() || "US"}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block">
                              {log.actorName}
                            </span>
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {log.actorRole?.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Document Reference Link */}
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          {getDocIcon(log.documentType)}
                          {href ? (
                            <Link
                              href={href}
                              className="font-semibold text-primary hover:underline flex items-center gap-1 group"
                            >
                              <span>{log.referenceId}</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          ) : (
                            <span className="font-semibold text-foreground">
                              {log.referenceId}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground capitalize block pl-5">
                          {log.documentType?.replace("_", " ")}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-muted text-foreground border border-border/80">
                          {log.action}
                        </span>
                      </td>

                      {/* State Transition Diff */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.fromStatus ? (
                            <>
                              <StatusBadge status={log.fromStatus} />
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            </>
                          ) : null}
                          {log.toStatus ? (
                            <StatusBadge status={log.toStatus} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>

                      {/* Notes / Remarks */}
                      <td className="px-4 py-3 max-w-xs">
                        {log.note ? (
                          <span className="text-muted-foreground text-[11px] line-clamp-2 italic">
                            &ldquo;{log.note}&rdquo;
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
