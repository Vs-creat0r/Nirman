"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentView } from "@/components/document";
import { Button } from "@/components/ui/button";

export default function SupervisorMRDetailPage() {
  const params = useParams();
  const { token } = useSession();
  const id = params?.id as Id<"material_request">;

  const mr = useQuery(
    api.material_requests.getMR,
    id && token ? { id, token } : "skip"
  );

  const submitMR = useMutation(api.material_requests.submitMR);

  if (mr === undefined) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading Material Request…</span>
      </div>
    );
  }

  if (mr === null) {
    return (
      <div className="p-12 text-center space-y-3">
        <h2 className="text-base font-bold text-foreground">Material Request Not Found</h2>
        <p className="text-xs text-muted-foreground">
          The requested document could not be found or you do not have permission to view it.
        </p>
        <Link href="/dashboard/supervisor/material-requests">
          <Button variant="outline" size="sm" className="text-xs">
            Back to Requests
          </Button>
        </Link>
      </div>
    );
  }

  const handleAction = async (actionName: string) => {
    if (actionName === "submit") {
      await submitMR({ id, token: token || undefined });
    }
  };

  return (
    <DocumentView
      docType="material_request"
      doc={mr}
      userRole={user?.role || "site_supervisor"}
      backHref="/dashboard/supervisor/material-requests"
      backLabel="Back to Material Requests"
      editHref={`/dashboard/supervisor/material-requests/${id}/edit`}
      onAction={handleAction}
      linkedDocs={{
        mr: { id: mr._id, refNo: mr.refNo, status: mr.status },
      }}
    />
  );
}
