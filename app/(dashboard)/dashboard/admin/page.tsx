"use client";
import * as React from "react";
import { useRole } from "../../../../hooks/use-role";
import { Users, Shield, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";

export default function AdminDashboard() {
  const { user } = useRole();

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col gap-1.5 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
            Admin Portal
          </h1>
          <Badge variant="danger">System Admin</Badge>
        </div>
        <p className="text-xs text-muted-foreground select-none">
          Welcome back, {user?.name || "Admin"}. Control system permissions, user directories, and system-wide logs.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              System Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">0</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total registered profiles across all roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              Access Credentials
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">Active</div>
            <p className="text-[10px] text-muted-foreground mt-1">System authorization guards enabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder card */}
      <Card className="border-dashed">
        <CardContent className="h-60 flex flex-col items-center justify-center text-center gap-3.5 p-6">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold">Identity & Controls</CardTitle>
            <CardDescription className="text-xs max-w-sm mt-1 mx-auto">
              This dashboard is currently empty. In Phase 2, you will be able to add new users, update access permissions, and revoke keys from this panel.
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
