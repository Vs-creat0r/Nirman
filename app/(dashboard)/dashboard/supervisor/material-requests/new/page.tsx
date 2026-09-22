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
import type { Id } from "@/convex/_generated/dataModel";

export default function NewMaterialRequestPage() {
  const router = useRouter();
  const { token } = useSession();

  // Track the project the user has selected so the sites query can be scoped.
  const [selectedProjectId, setSelectedProjectId] = React.useState<
    Id<"projects"> | undefined
  >(undefined);

  // Live Convex Master Data queries
  const projects = useQuery(
    api.projects.listProjects,
    token ? { token } : "skip"
  );

  // Re-fetches automatically when selectedProjectId changes.
  // When undefined (nothing selected yet) listSites returns all scoped sites,
  // which is fine for the initial empty state.
  const sites = useQuery(
    api.sites.listSites,
    token ? { token, projectId: selectedProjectId } : "skip"
  );

  const createMRMutation = useMutation(api.material_requests.createMR);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submitImmediatelyRef = React.useRef(false);

  const optionsMap = {
    projects: (projects || []).map((p) => ({
      value: p._id,
      label: `${p.name} (${p.code})`,
    })),
    sites: (sites || []).map((s) => ({
      value: s._id,
      label: `${s.name} (${s.code})`,
    })),
    projectId: (projects || []).map((p) => ({
      value: p._id,
      label: `${p.name} (${p.code})`,
    })),
    siteId: (sites || []).map((s) => ({
      value: s._id,
      label: `${s.name} (${s.code})`,
    })),
  };

  const defaultProjectId = React.useMemo(() => {
    if (projects && projects.length === 1) {
      return projects[0]._id;
    }
    try {
      const saved =
        typeof window !== "undefined"
          ? localStorage.getItem("nirman_selected_project_id")
          : null;
      if (saved && saved !== "all" && projects?.some((p) => p._id === saved)) {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return undefined;
  }, [projects]);

  // Initialise selectedProjectId when a defaultProjectId becomes available
  // (single-project supervisor or localStorage restore) so sites are scoped
  // from the very first render.
  React.useEffect(() => {
    if (defaultProjectId && !selectedProjectId) {
      setSelectedProjectId(defaultProjectId as Id<"projects">);
    }
  }, [defaultProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ref to track the previous project so we can detect a project switch
  // and update selectedProjectId to trigger a scoped listSites refetch.
  const prevProjectIdRef = React.useRef<Id<"projects"> | undefined>(undefined);

  // Called by DocumentForm on every field change (via its internal watch).
  // Drives the selectedProjectId state; DocumentForm itself is responsible
  // for clearing dependent fields via resetFieldsOnChange.
  const handleValuesChange = React.useCallback(
    (values: Record<string, unknown>) => {
      const pid = values.projectId as Id<"projects"> | undefined;
      if (pid !== prevProjectIdRef.current) {
        prevProjectIdRef.current = pid;
        setSelectedProjectId(pid ?? undefined);
      }
    },
    []
  );

  const handleSave = async (data: Record<string, unknown>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const submitImmediately = submitImmediatelyRef.current;
      const items = Array.isArray(data.items) ? data.items : [];

      if (items.length === 0) {
        throw new Error("At least one line item is required.");
      }

      // Pre-validation for line items
      for (const it of items as any[]) {
        if (!it.itemName || !it.itemName.trim()) {
          throw new Error("All line items must have a valid item name.");
        }
        const qty = Number(it.quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error(
            `Quantity for "${it.itemName}" must be greater than 0.`
          );
        }
      }

      // Format payload for createMR mutation
      const payload = {
        projectId: data.projectId as Id<"projects">,
        siteId: data.siteId ? (data.siteId as Id<"sites">) : undefined,
        items: (items as any[]).map((it: any) => ({
          itemName: it.itemName.trim(),
          description: it.description?.trim() || undefined,
          hsnSacCode: it.hsnSacCode?.trim() || undefined,
          quantity: Number(it.quantity),
          unit: it.unit || "bags",
          projectItemId: it.projectItemId || undefined,
        })),
        priority: (data.priority as "low" | "normal" | "urgent") || "normal",
        requiredBy: data.requiredBy ? String(data.requiredBy) : undefined,
        notes: data.notes ? String(data.notes).trim() : undefined,
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
          Raise a new material request for site delivery. Items will be routed
          for manager approval.
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
        onSubmit={handleSave}
        submitLabel="Save as Draft"
        isSubmitting={isSubmitting}
        defaultValues={{
          status: "draft",
          priority: "normal",
          ...(defaultProjectId ? { projectId: defaultProjectId } : {}),
        }}
        onValuesChange={handleValuesChange}
        resetFieldsOnChange={{ projectId: ["siteId"] }}
        footerActions={
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={isSubmitting}
            onClick={(e) => {
              submitImmediatelyRef.current = true;
              const form = (e.currentTarget as HTMLElement).closest("form");
              if (form) {
                const submitBtn = form.querySelector(
                  'button[type="submit"]'
                ) as HTMLButtonElement;
                if (submitBtn) {
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