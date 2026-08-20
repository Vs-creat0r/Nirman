"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { DocumentTable } from "@/components/shared/document-table";

export default function SupervisorMaterialRequestsPage() {
  const { token } = useSession();
  const materialRequests = useQuery(
    api.material_requests.listMRs,
    token ? { token } : "skip"
  );

  return (
    <div className="space-y-6">
      <DocumentTable
        title="Material Requests"
        description="All material requests created by you for site delivery."
        data={materialRequests}
        isLoading={materialRequests === undefined}
        baseHref="/dashboard/supervisor/material-requests"
        newHref="/dashboard/supervisor/material-requests/new"
        newButtonLabel="New Material Request"
        emptyTitle="No material requests yet"
        emptyDescription="You have not created any material requests. Click below to raise your first request."
      />
    </div>
  );
}
