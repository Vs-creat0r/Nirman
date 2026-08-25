"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentForm } from "@/components/document/document-form";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import materialRequestContract from "@/contracts/material_request.json";
import type { DocumentContract } from "@/lib/form-engine-types";

export default function EditQueriedMaterialRequestPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useSession();
  const id = params?.id as Id<"material_request">;

  const mr = useQuery(
    api.material_requests.getMR,
    id && token ? { id, token } : "skip"
  );
  const projects = useQuery(
    api.projects.listProjects,
    token ? { token } : "skip"
  );
  const sites = useQuery(api.sites.listSites, token ? { token } : "skip");
  const resubmitMRMutation = useMutation(api.material_requests.resubmitMR);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
      <div className="p-12 text-center text-xs text-muted-foreground">
        Material request not found.
      </div>
    );
  }

  const optionsMap = {
    projects: projects || [],
    sites: sites || [],
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) {
        throw new Error("Please add at least one line item.");
      }

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.itemName || !it.itemName.trim()) {
          throw new Error(`Item #${i + 1} must have a valid item name.`);
        }
        const qty = Number(it.quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Quantity for "${it.itemName}" must be greater than 0.`);
        }
      }

      await resubmitMRMutation({
        id,
        projectId: data.projectId as any,
        siteId: data.siteId ? (data.siteId as any) : undefined,
        items: items.map((it: any) => ({
          itemName: it.itemName.trim(),
          description: it.description?.trim() || undefined,
          hsnSacCode: it.hsnSacCode?.trim() || undefined,
          quantity: Number(it.quantity),
          unit: it.unit || "bags",
          projectItemId: it.projectItemId || undefined,
        })),
        priority: (data.priority as any) || "normal",
        requiredBy: data.requiredBy ? String(data.requiredBy) : undefined,
        notes: data.notes ? String(data.notes).trim() : undefined,
        token: token || undefined,
      });

      router.push(`/dashboard/supervisor/material-requests/${id}`);
    } catch (err: any) {
      setError(err.message || "Failed to resubmit material request.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <Link
            href={`/dashboard/supervisor/material-requests/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cancel & Back
          </Link>
          <h1 className="text-xl font-bold text-foreground">
            Edit & Resubmit {mr.refNo}
          </h1>
        </div>
      </div>

      {/* Query note from manager */}
      {mr.reviewNote && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold text-amber-500">
              Manager Feedback / Query
            </h3>
            <p className="text-xs text-foreground mt-0.5">
              {mr.reviewNote}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Editable form prefilled with MR data */}
      <DocumentForm
        contract={materialRequestContract as unknown as DocumentContract}
        optionsMap={optionsMap}
        onSubmit={handleSubmit}
        submitLabel="Resubmit for Approval"
        isSubmitting={isSubmitting}
        defaultValues={{
          projectId: mr.projectId,
          siteId: mr.siteId || "",
          items: mr.items,
          priority: mr.priority,
          requiredBy: mr.requiredBy || "",
          notes: mr.notes || "",
        }}
      />
    </div>
  );
}
