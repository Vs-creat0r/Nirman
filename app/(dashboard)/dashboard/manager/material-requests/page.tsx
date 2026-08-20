"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { DocumentTable } from "@/components/shared/document-table";

export default function ManagerMaterialRequestsPage() {
  const { token } = useSession();
  const [activeTab, setActiveTab] = React.useState<"pending" | "all">("pending");

  const materialRequests = useQuery(
    api.material_requests.listMRs,
    token ? { token, status: activeTab === "pending" ? "pending" : undefined } : "skip"
  );

  return (
    <div className="space-y-6">
      {/* Header & Filter Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Material Approval Queue
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review, approve, or query material requests raised from construction sites.
          </p>
        </div>

        {/* Tab Filter */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border text-xs">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTab === "pending"
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pending Approval
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTab === "all"
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Requests
          </button>
        </div>
      </div>

      <DocumentTable
        data={materialRequests}
        isLoading={materialRequests === undefined}
        baseHref="/dashboard/manager/material-requests"
        emptyTitle={
          activeTab === "pending"
            ? "No pending approvals"
            : "No material requests recorded"
        }
        emptyDescription={
          activeTab === "pending"
            ? "All material requests have been reviewed and approved."
            : "No material requests have been submitted across your projects."
        }
      />
    </div>
  );
}
