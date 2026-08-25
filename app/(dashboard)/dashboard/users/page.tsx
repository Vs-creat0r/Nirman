"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UserCog,
  Users,
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  KeyRound,
  Building2,
  HardHat,
  Briefcase,
  ShoppingBag,
} from "lucide-react";

export default function UsersPage() {
  const { role } = useRole();
  const { token } = useSession();

  const [searchQuery, setSearchQuery] = React.useState("");

  const users = useQuery(api.users.list, token ? { token } : "skip");

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const getRoleIcon = (userRole: string) => {
    switch (userRole) {
      case "site_supervisor":
        return <HardHat className="h-4 w-4 text-blue-500" />;
      case "project_manager":
        return <Briefcase className="h-4 w-4 text-purple-500" />;
      case "procurement_officer":
        return <ShoppingBag className="h-4 w-4 text-amber-500" />;
      case "admin":
        return <ShieldCheck className="h-4 w-4 text-emerald-500" />;
      default:
        return <Users className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleBadgeVariant = (userRole: string) => {
    switch (userRole) {
      case "site_supervisor":
        return "processing";
      case "project_manager":
        return "pending";
      case "procurement_officer":
        return "delivery";
      case "admin":
        return "success";
      default:
        return "draft";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              User & Access Control
            </h1>
            <Badge variant="success">RBAC Enforced</Badge>
          </div>
          <p className="text-xs text-muted-foreground select-none mt-1">
            System identity directory with strict server-side role-based access matrix.
          </p>
        </div>
      </div>

      {/* Role Matrix Quick Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">
              Site Supervisor
            </span>
            <HardHat className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-xs font-semibold text-foreground">Raises MRs & Signs GRNs</p>
          <p className="text-[10px] text-muted-foreground font-mono">user: supervisor</p>
        </div>

        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-500 uppercase tracking-wider">
              Project Manager
            </span>
            <Briefcase className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-xs font-semibold text-foreground">Approves MR, CC & PO</p>
          <p className="text-[10px] text-muted-foreground font-mono">user: manager</p>
        </div>

        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">
              Procurement Officer
            </span>
            <ShoppingBag className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xs font-semibold text-foreground">Creates CC, PO & DC</p>
          <p className="text-[10px] text-muted-foreground font-mono">user: procurement</p>
        </div>

        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">
              System Admin
            </span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xs font-semibold text-foreground">Master Control & Config</p>
          <p className="text-[10px] text-muted-foreground font-mono">user: admin</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Active System Accounts ({users?.length || 0})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search users by name, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        {users === undefined ? (
          <div className="p-6 space-y-2">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-8 bg-muted/60 animate-pulse rounded" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No system accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">User & Name</th>
                  <th className="px-4 py-3">Login Username</th>
                  <th className="px-4 py-3">Role & Permissions</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => (
                  <tr key={u._id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-accent text-accent-foreground font-bold text-xs flex items-center justify-center shrink-0">
                          {u.name?.substring(0, 2).toUpperCase() || "US"}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">{u.name}</span>
                          {u.email && (
                            <span className="text-[10px] text-muted-foreground">{u.email}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                      {u.username || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {getRoleIcon(u.role)}
                        <Badge variant={getRoleBadgeVariant(u.role) as any}>
                          {u.role.replace("_", " ")}
                        </Badge>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                      {new Date(u._creationTime).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
