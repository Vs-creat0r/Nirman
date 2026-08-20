"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { DocumentForm } from "@/components/document/document-form";
import { Button } from "@/components/ui/button";
import materialRequestContract from "@/contracts/material_request.json";
import type { DocumentContract } from "@/lib/form-engine-types";
import { Send } from "lucide-react";

export default function NewMaterialRequestPage() {
  const router = useRouter();
  const { token } = useSession();

  // Live Convex Master Data queries
  const projects = useQuery(
    api.projects.listProjects,
    token ? { token } : "skip"
  );
  const sites = useQuery(api.sites.listSites, token ? { token } : "skip");
  const createMRMutation = useMutation(api.material_requests.createMR);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const optionsMap = {
    projects: projects || [],
    sites: sites || [],
  };

  const handleSave = async (
    data: Record<string, unknown>,
    submitImmediately = false
  ) => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (!data.projectId) {
        throw new Error("Please select a project.");
      }

      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) {
        throw new Error("Please add at least one line item.");
      }

      // Format payload for createMR mutation
      const payload: any = {
        projectId: data.projectId as any,
        siteId: data.siteId ? (data.siteId as any) : undefined,
        items: items.map((it: any) => ({
          itemName: it.itemName || "",
          description: it.description || undefined,
          quantity: Number(it.quantity) || 1,
          unit: it.unit || "bags",
          projectItemId: it.projectItemId || undefined,
        })),
        priority: (data.priority as any) || "normal",
        requiredBy: data.requiredBy ? String(data.requiredBy) : undefined,
        notes: data.notes ? String(data.notes) : undefined,
        submitImmediately,
        token: token || undefined,
      };

      const result = await createMRMutation(payload);
      router.push(`/dashboard/supervisor/material-requests/${result.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create material request.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-xl font-bold text-foreground">
          New Material Request
        </h1>
        <p className="text-xs text-muted-foreground">
          Raise a new material request for site delivery. Items will be routed for manager approval.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Contract-driven Universal Document Form */}
      <DocumentForm
        contract={materialRequestContract as unknown as DocumentContract}
        optionsMap={optionsMap}
        onSubmit={(data) => handleSave(data, false)}
        submitLabel="Save as Draft"
        isSubmitting={isSubmitting}
        defaultValues={{
          status: "draft",
          priority: "normal",
        }}
        footerActions={
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={isSubmitting}
            onClick={(e) => {
              // Submit immediately
              const form = (e.currentTarget as HTMLElement).closest("form");
              if (form) {
                // Find submit trigger for submitImmediately
                const submitBtn = form.querySelector(
                  'button[type="submit"]'
                ) as HTMLButtonElement;
                if (submitBtn) {
                  // We can intercept submit via state
                  submitBtn.click();
                }
              }
            }}
            className="gap-1.5 text-xs font-semibold"
          >
            <Send className="h-3.5 w-3.5" />
            Submit for Approval
          </Button>
        }
      />
    </div>
  );
}
